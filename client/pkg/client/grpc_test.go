package client

import (
	"context"
	"encoding/json"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

func newMockGRPCServer(t *testing.T, token string) (*grpc.Server, *bufconn.Listener) {
	t.Helper()
	lis := bufconn.Listen(1 << 20)
	s := grpc.NewServer()

	authOK := func(ctx context.Context) bool {
		md, _ := metadata.FromIncomingContext(ctx)
		v := md.Get("authorization")
		return len(v) > 0 && v[0] == token
	}

	mkUnary := func(name string, respFn func(params json.RawMessage) (any, error)) grpc.MethodDesc {
		return grpc.MethodDesc{
			MethodName: name,
			Handler: func(_ interface{}, ctx context.Context,
				dec func(interface{}) error, _ grpc.UnaryServerInterceptor,
			) (interface{}, error) {
				if !authOK(ctx) {
					return nil, status.Error(codes.Unauthenticated, "auth_failed")
				}
				var raw json.RawMessage
				if err := dec(&raw); err != nil {
					return nil, err
				}
				data, err := respFn(raw)
				if err != nil {
					return &struct {
						OK    bool            `json:"ok"`
						Data  json.RawMessage `json:"data,omitempty"`
						Error string          `json:"error,omitempty"`
					}{Error: err.Error()}, nil
				}
				b, _ := json.Marshal(data)
				return &struct {
					OK    bool            `json:"ok"`
					Data  json.RawMessage `json:"data,omitempty"`
					Error string          `json:"error,omitempty"`
				}{OK: true, Data: b}, nil
			},
		}
	}

	desc := grpc.ServiceDesc{
		ServiceName: "mtapi.Mtapi",
		HandlerType: (*interface{})(nil),
		Methods: []grpc.MethodDesc{
			mkUnary("Ping", func(json.RawMessage) (any, error) {
				return map[string]bool{"pong": true}, nil
			}),
			mkUnary("Battery", func(json.RawMessage) (any, error) {
				return map[string]any{"percentage": 42, "charging": true}, nil
			}),
			mkUnary("Boom", func(json.RawMessage) (any, error) {
				return nil, &mockErr{"kaboom"}
			}),
		},
		Streams: []grpc.StreamDesc{
			{
				StreamName:    "Ticker",
				ServerStreams: true,
				Handler: func(_ interface{}, stream grpc.ServerStream) error {
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
					if req.IntervalMs <= 0 {
						req.IntervalMs = 5
					}
					for i := 1; i <= req.Count; i++ {
						time.Sleep(time.Duration(req.IntervalMs) * time.Millisecond)
						if err := stream.SendMsg(&struct {
							Seq int   `json:"seq"`
							TS  int64 `json:"ts"`
						}{Seq: i, TS: time.Now().UnixMilli()}); err != nil {
							return err
						}
					}
					return nil
				},
			},
		},
	}
	s.RegisterService(&desc, &struct{}{})

	go s.Serve(lis)
	t.Cleanup(func() { s.Stop() })
	return s, lis
}

type mockErr struct{ msg string }

func (e *mockErr) Error() string { return e.msg }

func dialMock(t *testing.T, lis *bufconn.Listener) *GRPCClient {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	conn, err := grpc.DialContext(ctx, "bufnet",
		grpc.WithContextDialer(func(c context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(c)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithDefaultCallOptions(grpc.CallContentSubtype("json")),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return &GRPCClient{conn: conn, token: "tok"}
}

func TestGRPCClient_Ping(t *testing.T) {
	_, lis := newMockGRPCServer(t, "tok")
	c := dialMock(t, lis)

	data, err := c.Call("ping", nil)
	if err != nil {
		t.Fatalf("call: %v", err)
	}
	if !strings.Contains(string(data), "pong") {
		t.Fatalf("data: %s", data)
	}
}

func TestGRPCClient_Battery(t *testing.T) {
	_, lis := newMockGRPCServer(t, "tok")
	c := dialMock(t, lis)

	data, err := c.Call("battery", nil)
	if err != nil {
		t.Fatalf("call: %v", err)
	}
	if !strings.Contains(string(data), "42") {
		t.Fatalf("data: %s", data)
	}
}

func TestGRPCClient_BadAuth(t *testing.T) {
	_, lis := newMockGRPCServer(t, "right")
	c := dialMock(t, lis)
	c.token = "wrong"

	_, err := c.Call("ping", nil)
	if err == nil || !strings.Contains(err.Error(), "Unauthenticated") {
		t.Fatalf("expected Unauthenticated, got %v", err)
	}
}

func TestGRPCClient_ServerError(t *testing.T) {
	_, lis := newMockGRPCServer(t, "tok")
	c := dialMock(t, lis)

	_, err := c.Call("boom", nil)
	if err == nil || !strings.Contains(err.Error(), "kaboom") {
		t.Fatalf("expected kaboom, got %v", err)
	}
}

func TestGRPCClient_Ticker(t *testing.T) {
	_, lis := newMockGRPCServer(t, "tok")
	c := dialMock(t, lis)

	var mu sync.Mutex
	var seqs []int
	err := c.Ticker(3, 5, func(seq int, _ int64) {
		mu.Lock()
		seqs = append(seqs, seq)
		mu.Unlock()
	})
	if err != nil {
		t.Fatalf("ticker: %v", err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(seqs) != 3 || seqs[0] != 1 || seqs[2] != 3 {
		t.Fatalf("seqs: %v", seqs)
	}
}

func TestGRPCClient_DialFail(t *testing.T) {
	t.Setenv("MTAPI_GRPC_SOCK", "/nonexistent/sock")
	_, err := NewGRPC("tok", 300*time.Millisecond)
	if err == nil {
		t.Fatal("expected dial failure")
	}
}
