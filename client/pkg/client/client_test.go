package client

import (
	"bufio"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

type mockServer struct {
	ln    net.Listener
	path  string
	token string
	mu    sync.Mutex
	calls []string
}

func startMock(t *testing.T, token string,
	responder func(method string, params json.RawMessage) any) *mockServer {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "s.sock")
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	s := &mockServer{ln: ln, path: path, token: token}
	go s.serve(responder)
	t.Cleanup(func() { ln.Close() })
	return s
}

func (s *mockServer) serve(responder func(string, json.RawMessage) any) {
	for {
		c, err := s.ln.Accept()
		if err != nil {
			return
		}
		go func(c net.Conn) {
			defer c.Close()
			sc := bufio.NewScanner(c)
			enc := json.NewEncoder(c)
			for sc.Scan() {
				var req struct {
					Auth   string          `json:"auth"`
					Method string          `json:"method"`
					Params json.RawMessage `json:"params"`
				}
				if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
					continue
				}
				s.mu.Lock()
				s.calls = append(s.calls, req.Method)
				s.mu.Unlock()
				if req.Auth != s.token {
					enc.Encode(map[string]any{"ok": false, "error": "auth_failed"})
					continue
				}
				enc.Encode(map[string]any{"ok": true, "data": responder(req.Method, req.Params)})
			}
		}(c)
	}
}

func withSock(t *testing.T, path string) {
	t.Helper()
	old := os.Getenv("MTAPI_SOCK")
	os.Setenv("MTAPI_SOCK", path)
	t.Cleanup(func() { os.Setenv("MTAPI_SOCK", old) })
}

func TestCall_Basic(t *testing.T) {
	s := startMock(t, "tok", func(m string, p json.RawMessage) any {
		return map[string]bool{"pong": true}
	})
	withSock(t, s.path)

	c, err := New("tok")
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	defer c.Close()

	data, err := c.Call("ping", nil)
	if err != nil {
		t.Fatalf("call: %v", err)
	}
	if !strings.Contains(string(data), "pong") {
		t.Fatalf("data: %s", data)
	}
}

func TestCall_BadAuth(t *testing.T) {
	s := startMock(t, "right", func(m string, p json.RawMessage) any { return nil })
	withSock(t, s.path)

	c, err := New("wrong")
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	defer c.Close()

	_, err = c.Call("ping", nil)
	if err == nil || !strings.Contains(err.Error(), "auth_failed") {
		t.Fatalf("expected auth_failed, got %v", err)
	}
}

func TestCall_MultipleOnOneConn(t *testing.T) {
	s := startMock(t, "tok", func(m string, p json.RawMessage) any {
		return map[string]string{"echo": m}
	})
	withSock(t, s.path)

	c, err := New("tok")
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	defer c.Close()

	for _, m := range []string{"a", "b", "c"} {
		if _, err := c.Call(m, nil); err != nil {
			t.Fatalf("%s: %v", m, err)
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.calls) != 3 {
		t.Fatalf("calls: %d", len(s.calls))
	}
}

func TestCall_DialFail(t *testing.T) {
	withSock(t, filepath.Join(t.TempDir(), "nope.sock"))
	if _, err := New("tok"); err == nil {
		t.Fatal("expected dial error")
	}
}
