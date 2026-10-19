package mobile

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

const testToken = "test-token-grpc"

func setGrpcEnv(t *testing.T) {
	t.Helper()
	setup(t) // sets `api` to mockAPI
	mu.Lock()
	token = testToken
	mu.Unlock()
	t.Cleanup(func() {
		mu.Lock()
		token = ""
		mu.Unlock()
	})
}

func dialBufconn(t *testing.T, lis *bufconn.Listener) *grpc.ClientConn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	conn, err := grpc.DialContext(ctx, "bufnet",
		grpc.WithContextDialer(func(c context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(c)
		}),
		grpc.WithInsecure(),
		grpc.WithBlock(),
		grpc.WithDefaultCallOptions(grpc.CallContentSubtype("json")),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func authCtx(auth string) context.Context {
	return metadata.NewOutgoingContext(context.Background(),
		metadata.Pairs("authorization", auth))
}

func TestGRPC_UnaryPing(t *testing.T) {
	setGrpcEnv(t)
	lis := bufconn.Listen(1 << 20)
	s := newGRPCServer()
	go s.Serve(lis)
	defer s.Stop()

	conn := dialBufconn(t, lis)
	ctx, cancel := context.WithTimeout(authCtx(testToken), 2*time.Second)
	defer cancel()

	var resp json.RawMessage
	err := conn.Invoke(ctx, "/mtapi.Mtapi/Ping", json.RawMessage(`{}`), &resp,
		grpc.CallContentSubtype("json"))
	if err != nil {
		t.Fatalf("invoke: %v", err)
	}
	if !strings.Contains(string(resp), "pong") {
		t.Fatalf("resp: %s", resp)
	}
}

func TestGRPC_UnaryBattery(t *testing.T) {
	setGrpcEnv(t)
	lis := bufconn.Listen(1 << 20)
	s := newGRPCServer()
	go s.Serve(lis)
	defer s.Stop()

	conn := dialBufconn(t, lis)
	ctx, cancel := context.WithTimeout(authCtx(testToken), 2*time.Second)
	defer cancel()

	var resp json.RawMessage
	if err := conn.Invoke(ctx, "/mtapi.Mtapi/Battery",
		json.RawMessage(`{}`), &resp,
		grpc.CallContentSubtype("json")); err != nil {
		t.Fatalf("invoke: %v", err)
	}
	if !strings.Contains(string(resp), `"percentage":42`) {
		t.Fatalf("resp: %s", resp)
	}
}

func TestGRPC_BadAuth(t *testing.T) {
	setGrpcEnv(t)
	lis := bufconn.Listen(1 << 20)
	s := newGRPCServer()
	go s.Serve(lis)
	defer s.Stop()

	conn := dialBufconn(t, lis)
	ctx, cancel := context.WithTimeout(authCtx("wrong"), 2*time.Second)
	defer cancel()

	var resp json.RawMessage
	err := conn.Invoke(ctx, "/mtapi.Mtapi/Ping",
		json.RawMessage(`{}`), &resp,
		grpc.CallContentSubtype("json"))
	if err == nil {
		t.Fatal("expected error")
	}
	if st, ok := status.FromError(err); !ok || st.Code() != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %v", err)
	}
}

func TestGRPC_NoAuthHeader(t *testing.T) {
	setGrpcEnv(t)
	lis := bufconn.Listen(1 << 20)
	s := newGRPCServer()
	go s.Serve(lis)
	defer s.Stop()

	conn := dialBufconn(t, lis)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var resp json.RawMessage
	err := conn.Invoke(ctx, "/mtapi.Mtapi/Ping",
		json.RawMessage(`{}`), &resp,
		grpc.CallContentSubtype("json"))
	if err == nil {
		t.Fatal("expected auth error")
	}
}

func TestGRPC_TickerStream(t *testing.T) {
	setGrpcEnv(t)
	lis := bufconn.Listen(1 << 20)
	s := newGRPCServer()
	go s.Serve(lis)
	defer s.Stop()

	conn := dialBufconn(t, lis)
	ctx, cancel := context.WithTimeout(authCtx(testToken), 5*time.Second)
	defer cancel()

	desc := &grpc.StreamDesc{ServerStreams: true}
	stream, err := conn.NewStream(ctx, desc, "/mtapi.Mtapi/Ticker",
		grpc.CallContentSubtype("json"))
	if err != nil {
		t.Fatalf("newstream: %v", err)
	}
	req := struct {
		Count      int `json:"count"`
		IntervalMs int `json:"interval_ms"`
	}{Count: 3, IntervalMs: 20}
	if err := stream.SendMsg(&req); err != nil {
		t.Fatalf("send: %v", err)
	}
	if err := stream.CloseSend(); err != nil {
		t.Fatalf("closesend: %v", err)
	}

	count := 0
	for {
		var ev struct {
			Seq int   `json:"seq"`
			TS  int64 `json:"ts"`
		}
		if err := stream.RecvMsg(&ev); err != nil {
			if err == io.EOF {
				break
			}
			t.Fatalf("recv: %v", err)
		}
		count++
		if ev.Seq != count {
			t.Fatalf("seq mismatch: got %d want %d", ev.Seq, count)
		}
	}
	if count != 3 {
		t.Fatalf("events: got %d want 3", count)
	}
}

func TestGRPC_UnknownMethod(t *testing.T) {
	setGrpcEnv(t)
	lis := bufconn.Listen(1 << 20)
	s := newGRPCServer()
	go s.Serve(lis)
	defer s.Stop()

	conn := dialBufconn(t, lis)
	ctx, cancel := context.WithTimeout(authCtx(testToken), 2*time.Second)
	defer cancel()

	var resp json.RawMessage
	err := conn.Invoke(ctx, "/mtapi.Mtapi/DoesNotExist",
		json.RawMessage(`{}`), &resp,
		grpc.CallContentSubtype("json"))
	if err == nil {
		t.Fatal("expected error for unknown method")
	}
}
