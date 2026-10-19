// devserver — mock mtapi server for CLI smoke test.
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/encoding"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type jsonCodec struct{}

func (jsonCodec) Marshal(v any) ([]byte, error) {
	if raw, ok := v.(json.RawMessage); ok {
		return raw, nil
	}
	if raw, ok := v.(*json.RawMessage); ok {
		return *raw, nil
	}
	return json.Marshal(v)
}
func (jsonCodec) Unmarshal(b []byte, v any) error {
	if raw, ok := v.(*json.RawMessage); ok {
		*raw = append((*raw)[:0], b...)
		return nil
	}
	return json.Unmarshal(b, v)
}
func (jsonCodec) Name() string { return "json" }

func init() { encoding.RegisterCodec(jsonCodec{}) }

var token = "dev-token"

func respond(method string, params json.RawMessage) (bool, json.RawMessage, string) {
	switch method {
	case "ping":
		return true, json.RawMessage(`{"pong":true}`), ""
	case "battery":
		return true, json.RawMessage(`{"percentage":77,"charging":true}`), ""
	case "wifi":
		return true, json.RawMessage(`{"ssid":"mock","rssi":-42,"link_speed":433}`), ""
	case "device":
		return true, json.RawMessage(`{"manufacturer":"mock","model":"devserver","sdk":34}`), ""
	case "location":
		return true, json.RawMessage(`{"lat":0.0,"lon":0.0,"acc":5.0,"provider":"mock","ts":0}`), ""
	case "clipboard":
		var p struct{ Op, Text string }
		json.Unmarshal(params, &p)
		if p.Op == "set" {
			return true, json.RawMessage(`null`), ""
		}
		b, _ := json.Marshal(map[string]string{"text": "mock clipboard"})
		return true, b, ""
	case "toast", "notify", "vibrate", "torch", "tts", "share":
		return true, json.RawMessage(`null`), ""
	case "contacts":
		return true, json.RawMessage(`[{"name":"Alice","phone":"+100"},{"name":"Bob","phone":"+200"}]`), ""
	case "calllog":
		return true, json.RawMessage(`[{"number":"+100","type":1,"ts":0,"duration":10}]`), ""
	case "sms":
		var p struct{ Op string }
		json.Unmarshal(params, &p)
		if p.Op == "send" {
			return true, json.RawMessage(`null`), ""
		}
		return true, json.RawMessage(`[{"address":"+100","body":"hi","ts":0,"type":1}]`), ""
	case "camera":
		return true, json.RawMessage(`"/data/local/tmp/mock.jpg"`), ""
	}
	return false, nil, "unknown method: " + method
}

func jsonLoop(conn net.Conn) {
	defer conn.Close()
	sc := bufio.NewScanner(conn)
	sc.Buffer(make([]byte, 64<<10), 16<<20)
	enc := json.NewEncoder(conn)
	for sc.Scan() {
		var req struct {
			Auth   string          `json:"auth"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
		}
		if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
			enc.Encode(map[string]any{"ok": false, "error": "bad request"})
			continue
		}
		if req.Auth != token {
			enc.Encode(map[string]any{"ok": false, "error": "auth_failed"})
			continue
		}
		ok, data, errMsg := respond(req.Method, req.Params)
		if ok {
			log.Printf("json  %s -> ok", req.Method)
			enc.Encode(map[string]any{"ok": true, "data": data})
		} else {
			log.Printf("json  %s -> %s", req.Method, errMsg)
			enc.Encode(map[string]any{"ok": false, "error": errMsg})
		}
	}
}

func startJSON() error {
	ln, err := net.Listen("unix", "@mtapi")
	if err != nil {
		return err
	}
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go jsonLoop(c)
		}
	}()
	log.Println("json  listening on @mtapi")
	return nil
}

func authOK(ctx context.Context) bool {
	md, _ := metadata.FromIncomingContext(ctx)
	v := md.Get("authorization")
	return len(v) > 0 && v[0] == token
}

func mkUnary(name string) grpc.MethodDesc {
	return grpc.MethodDesc{
		MethodName: name,
		Handler: func(_ any, ctx context.Context, dec func(any) error, _ grpc.UnaryServerInterceptor) (any, error) {
			if !authOK(ctx) {
				return nil, status.Error(codes.Unauthenticated, "auth_failed")
			}
			var raw json.RawMessage
			if err := dec(&raw); err != nil {
				return nil, err
			}
			lower := map[string]string{
				"Ping": "ping", "Battery": "battery", "Wifi": "wifi",
				"Clipboard": "clipboard", "Toast": "toast", "Notify": "notify",
				"Vibrate": "vibrate", "Torch": "torch", "Device": "device",
				"Location": "location", "TTS": "tts", "Share": "share",
				"Camera": "camera", "Contacts": "contacts", "CallLog": "calllog",
				"Sms": "sms",
			}[name]
			ok, data, errMsg := respond(lower, raw)
			if !ok {
				return &struct {
					OK    bool            `json:"ok"`
					Data  json.RawMessage `json:"data,omitempty"`
					Error string          `json:"error,omitempty"`
				}{Error: errMsg}, nil
			}
			log.Printf("grpc  %s -> ok", name)
			return &struct {
				OK    bool            `json:"ok"`
				Data  json.RawMessage `json:"data,omitempty"`
				Error string          `json:"error,omitempty"`
			}{OK: true, Data: data}, nil
		},
	}
}

func mkTicker() grpc.StreamDesc {
	return grpc.StreamDesc{
		StreamName:    "Ticker",
		ServerStreams: true,
		Handler: func(_ any, stream grpc.ServerStream) error {
			if !authOK(stream.Context()) {
				return status.Error(codes.Unauthenticated, "auth_failed")
			}
			var req struct {
				Count      int `json:"count"`
				IntervalMs int `json:"interval_ms"`
			}
			if err := stream.RecvMsg(&req); err != nil {
				return err
			}
			if req.Count <= 0 {
				req.Count = 3
			}
			if req.IntervalMs <= 0 {
				req.IntervalMs = 500
			}
			log.Printf("grpc  Ticker count=%d interval=%dms", req.Count, req.IntervalMs)
			for i := 1; i <= req.Count; i++ {
				time.Sleep(time.Duration(req.IntervalMs) * time.Millisecond)
				ev := map[string]any{"seq": i, "ts": time.Now().UnixMilli()}
				if err := stream.SendMsg(&ev); err != nil {
					return err
				}
			}
			return nil
		},
	}
}

func startGRPC() error {
	ln, err := net.Listen("unix", "@mtapi.grpc")
	if err != nil {
		return err
	}
	srv := grpc.NewServer()
	desc := grpc.ServiceDesc{
		ServiceName: "mtapi.Mtapi",
		HandlerType: (*any)(nil),
		Methods: []grpc.MethodDesc{
			mkUnary("Ping"), mkUnary("Battery"), mkUnary("Wifi"),
			mkUnary("Clipboard"), mkUnary("Toast"), mkUnary("Notify"),
			mkUnary("Vibrate"), mkUnary("Torch"), mkUnary("Device"),
			mkUnary("Location"), mkUnary("TTS"), mkUnary("Share"),
			mkUnary("Camera"), mkUnary("Contacts"), mkUnary("CallLog"),
			mkUnary("Sms"),
		},
		Streams:  []grpc.StreamDesc{mkTicker()},
		Metadata: "mtapi",
	}
	var impl struct{}
	srv.RegisterService(&desc, &impl)
	go func() {
		if err := srv.Serve(ln); err != nil {
			log.Printf("grpc serve: %v", err)
		}
	}()
	log.Println("grpc  listening on @mtapi.grpc")
	return nil
}

func main() {
	if t := os.Getenv("MTAPI_TOKEN"); t != "" {
		token = t
	}
	log.Printf("devserver token=%q", token)

	if err := startJSON(); err != nil {
		fmt.Fprintf(os.Stderr, "json: %v\n", err)
		os.Exit(1)
	}
	if err := startGRPC(); err != nil {
		fmt.Fprintf(os.Stderr, "grpc: %v\n", err)
		os.Exit(1)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("bye")
}
