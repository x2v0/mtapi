package mobile

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const grpcSocketName = "@mtapi.grpc"

var (
	grpcServer   *grpc.Server
	grpcListener net.Listener
)

// unary method list. Each maps 1:1 to dispatch()'s JSON method names.
var grpcUnaryMethods = []string{
	"Ping", "Battery", "Wifi", "Clipboard", "Toast", "Notify",
	"Vibrate", "Torch", "Device", "Location", "TTS", "Share",
	"Camera", "Contacts", "CallLog", "Sms",
}

// dispatch method name (lowercase) per gRPC method.
var grpcMethodName = map[string]string{
	"Ping": "ping", "Battery": "battery", "Wifi": "wifi",
	"Clipboard": "clipboard", "Toast": "toast", "Notify": "notify",
	"Vibrate": "vibrate", "Torch": "torch", "Device": "device",
	"Location": "location", "TTS": "tts", "Share": "share",
	"Camera": "camera", "Contacts": "contacts", "CallLog": "calllog",
	"Sms": "sms",
}

type anyIface interface{}
type grpcServiceImpl struct{}

func newGRPCServer() *grpc.Server {
	s := grpc.NewServer()
	desc := grpc.ServiceDesc{
		ServiceName: "mtapi.Mtapi",
		HandlerType: (*anyIface)(nil),
		Methods:     make([]grpc.MethodDesc, 0, len(grpcUnaryMethods)),
		Streams: []grpc.StreamDesc{
			{
				StreamName:    "Ticker",
				Handler:       tickerStream,
				ServerStreams: true,
			},
		},
		Metadata: "mtapi",
	}
	for _, m := range grpcUnaryMethods {
		desc.Methods = append(desc.Methods, unaryMethod(m))
	}
	s.RegisterService(&desc, &grpcServiceImpl{})
	return s
}

func unaryMethod(name string) grpc.MethodDesc {
	return grpc.MethodDesc{
		MethodName: name,
		Handler: func(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
			var raw json.RawMessage
			if err := dec(&raw); err != nil {
				return nil, err
			}
			auth := authFromMD(ctx)
			mu.RLock()
			expected := token
			mu.RUnlock()
			if auth != expected {
				return nil, status.Error(codes.Unauthenticated, "auth_failed")
			}
			req := &request{Method: grpcMethodName[name], Auth: auth}
			if len(raw) > 0 && string(raw) != "{}" && string(raw) != "null" {
				req.Params = raw
			}
			resp := dispatch(req)
			return &resp, nil
		},
	}
}

// Ticker is a server-streaming demo: emits `count` events, `interval_ms` apart.
// Useful as a heartbeat/subscription primitive over gRPC.
func tickerStream(srv interface{}, stream grpc.ServerStream) error {
	auth := authFromMD(stream.Context())
	mu.RLock()
	expected := token
	mu.RUnlock()
	if auth != expected {
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
		req.Count = 10
	}
	if req.Count > 1000 {
		req.Count = 1000
	}
	if req.IntervalMs <= 0 {
		req.IntervalMs = 1000
	}
	if req.IntervalMs > 60_000 {
		req.IntervalMs = 60_000
	}

	for i := 1; i <= req.Count; i++ {
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		case <-time.After(time.Duration(req.IntervalMs) * time.Millisecond):
			ev := struct {
				Seq int   `json:"seq"`
				TS  int64 `json:"ts"`
			}{Seq: i, TS: time.Now().UnixMilli()}
			if err := stream.SendMsg(&ev); err != nil {
				return err
			}
		}
	}
	return nil
}

func authFromMD(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	if v := md.Get("authorization"); len(v) > 0 {
		return v[0]
	}
	return ""
}

func startGRPC() error {
	ln, err := net.Listen("unix", grpcSocketName)
	if err != nil {
		return fmt.Errorf("grpc listen %s: %w", grpcSocketName, err)
	}
	s := newGRPCServer()
	go func() {
		if err := s.Serve(ln); err != nil {
			log.Printf("grpc serve: %v", err)
		}
	}()
	grpcServer = s
	grpcListener = ln
	return nil
}

func stopGRPC() {
	if grpcServer != nil {
		grpcServer.Stop()
		grpcServer = nil
	}
	if grpcListener != nil {
		grpcListener.Close()
		grpcListener = nil
	}
}
