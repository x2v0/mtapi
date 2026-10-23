package mobile

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
)

// AndroidAPI is implemented in Kotlin (AndroidApiImpl).
// gomobile maps (string, error) -> String (throws), error -> void (throws).
type AndroidAPI interface {
	BatteryStatus() (string, error)
	WifiInfo() (string, error)
	ClipboardGet() (string, error)
	ClipboardSet(text string) error
	Toast(text string) error
	Notify(title, body string) error
	Vibrate(ms int32) error
	Torch(on bool) error
	DeviceInfo() (string, error)
	LocationLast() (string, error)
	TTS(text string) error
	Share(title, text string) error
	CameraPhoto(path string) (string, error)
	ContactsList(limit int32) (string, error)
	CallLogList(limit int32) (string, error)
	SmsList(limit int32) (string, error)
	SmsSend(to, text string) error
}

type request struct {
	V      int             `json:"v,omitempty"`
	Auth   string          `json:"auth,omitempty"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

type response struct {
	OK    bool            `json:"ok"`
	Data  json.RawMessage `json:"data,omitempty"`
	Error string          `json:"error,omitempty"`
}

var (
	mu       sync.RWMutex
	api      AndroidAPI
	token    string
	listener net.Listener
)

const socketName = "@mtapi"

func Start(tok string, a AndroidAPI) error {
	mu.Lock()
	api = a
	token = tok
	mu.Unlock()

	ln, err := net.Listen("unix", socketName)
	if err != nil {
		return fmt.Errorf("listen %s: %w", socketName, err)
	}
	mu.Lock()
	listener = ln
	mu.Unlock()
	go acceptLoop()

	if err := startGRPC(); err != nil {
		log.Printf("mtapi grpc: %v (JSON still available)", err)
	}
	return nil
}

func Stop() error {
	stopGRPC()
	mu.Lock()
	defer mu.Unlock()
	if listener != nil {
		err := listener.Close()
		listener = nil
		return err
	}
	return nil
}

func acceptLoop() {
	mu.RLock()
	ln := listener
	mu.RUnlock()
	if ln == nil {
		return
	}
	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("mtapi accept: %v", err)
			return
		}
		go handle(conn)
	}
}

func handle(conn net.Conn) {
	defer conn.Close()
	defer func() {
		if r := recover(); r != nil {
			log.Printf("mtapi panic: %v", r)
		}
	}()

	sc := bufio.NewScanner(conn)
	sc.Buffer(make([]byte, 64<<10), 16<<20)
	enc := json.NewEncoder(conn)

	for sc.Scan() {
		line := sc.Bytes()
		if len(strings.TrimSpace(string(line))) == 0 {
			continue
		}
		var req request
		if err := json.Unmarshal(line, &req); err != nil {
			_ = enc.Encode(response{Error: "bad request: " + err.Error()})
			continue
		}
		if req.Auth != token {
			_ = enc.Encode(response{Error: "auth_failed"})
			continue
		}
		_ = enc.Encode(dispatch(&req))
	}
}

func dispatch(req *request) response {
	mu.RLock()
	a := api
	mu.RUnlock()
	if a == nil {
		return response{Error: "not_initialized"}
	}

	ok := func(s string, err error) response {
		if err != nil {
			return response{Error: err.Error()}
		}
		return response{OK: true, Data: []byte(s)}
	}
	done := func(err error) response {
		if err != nil {
			return response{Error: err.Error()}
		}
		return response{OK: true, Data: []byte("null")}
	}
	get := func(dst interface{}) {
		_ = json.Unmarshal(req.Params, dst)
	}

	switch req.Method {
	case "ping":
		return response{OK: true, Data: []byte(`{"pong":true}`)}
	case "battery":
		s, err := a.BatteryStatus()
		return ok(s, err)
	case "wifi":
		s, err := a.WifiInfo()
		return ok(s, err)
	case "device":
		s, err := a.DeviceInfo()
		return ok(s, err)
	case "location":
		s, err := a.LocationLast()
		return ok(s, err)
	case "clipboard":
		var p struct{ Op, Text string }
		get(&p)
		switch p.Op {
		case "get":
			s, err := a.ClipboardGet()
			if err != nil {
				return response{Error: err.Error()}
			}
			b, _ := json.Marshal(map[string]string{"text": s})
			return response{OK: true, Data: b}
		case "set":
			return done(a.ClipboardSet(p.Text))
		}
		return response{Error: "clipboard: bad op"}
	case "toast":
		var p struct{ Text string }
		get(&p)
		return done(a.Toast(p.Text))
	case "notify":
		var p struct{ Title, Body string }
		get(&p)
		return done(a.Notify(p.Title, p.Body))
	case "vibrate":
		var p struct{ Ms int32 }
		get(&p)
		return done(a.Vibrate(p.Ms))
	case "torch":
		var p struct{ On bool }
		get(&p)
		return done(a.Torch(p.On))
	case "tts":
		var p struct{ Text string }
		get(&p)
		return done(a.TTS(p.Text))
	case "share":
		var p struct{ Title, Text string }
		get(&p)
		return done(a.Share(p.Title, p.Text))
	case "camera":
		var p struct{ Path string }
		get(&p)
		s, err := a.CameraPhoto(p.Path)
		return ok(s, err)
	case "contacts":
		var p struct{ Limit int32 }
		get(&p)
		if p.Limit <= 0 {
			p.Limit = 20
		}
		s, err := a.ContactsList(p.Limit)
		return ok(s, err)
	case "calllog":
		var p struct{ Limit int32 }
		get(&p)
		if p.Limit <= 0 {
			p.Limit = 20
		}
		s, err := a.CallLogList(p.Limit)
		return ok(s, err)
	case "sms":
		var p struct {
			Op    string
			To    string
			Text  string
			Limit int32
		}
		get(&p)
		if p.Op == "send" {
			return done(a.SmsSend(p.To, p.Text))
		}
		if p.Limit <= 0 {
			p.Limit = 20
		}
		s, err := a.SmsList(p.Limit)
		return ok(s, err)
	}
	return response{Error: "unknown method: " + req.Method}
}
