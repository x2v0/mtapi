package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/encoding"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	token    = "e2e-token"
	sockName = "@mtapi.grpc.e2e"
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
func (jsonCodec) Unmarshal(data []byte, v any) error {
	if raw, ok := v.(*json.RawMessage); ok {
		*raw = append((*raw)[:0], data...)
		return nil
	}
	return json.Unmarshal(data, v)
}
func (jsonCodec) Name() string { return "json" }

func init() { encoding.RegisterCodec(jsonCodec{}) }

func findRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "client", "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func authOK(ctx context.Context) bool {
	md, _ := metadata.FromIncomingContext(ctx)
	v := md.Get("authorization")
	return len(v) > 0 && v[0] == token
}

func mkUnary(name string, fn func(json.RawMessage) (any, error)) grpc.MethodDesc {
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
			data, err := fn(raw)
			if err != nil {
				return nil, err
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
				req.IntervalMs = 100
			}
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

func buildServer() *grpc.Server {
	srv := grpc.NewServer()
	desc := grpc.ServiceDesc{
		ServiceName: "mtapi.Mtapi",
		HandlerType: (*any)(nil),
		Methods: []grpc.MethodDesc{
			mkUnary("Ping", func(json.RawMessage) (any, error) {
				return map[string]bool{"pong": true}, nil
			}),
			mkUnary("Battery", func(json.RawMessage) (any, error) {
				return map[string]any{"percentage": 42, "charging": true}, nil
			}),
		},
		Streams:  []grpc.StreamDesc{mkTicker()},
		Metadata: "mtapi",
	}
	var impl struct{}
	srv.RegisterService(&desc, &impl)
	return srv
}

func main() {
	root := findRoot()
	if root == "" {
		fmt.Fprintln(os.Stderr, "repo root not found")
		os.Exit(1)
	}

	tmp, err := os.MkdirTemp("", "mtapi-grpce2e-*")
	if err != nil {
		fmt.Fprintln(os.Stderr, "mktemp:", err)
		os.Exit(1)
	}
	defer os.RemoveAll(tmp)

	bin := filepath.Join(tmp, "mtapi")
	build := exec.Command("go", "build", "-o", bin, ".")
	build.Dir = filepath.Join(root, "client")
	build.Stdout, build.Stderr = os.Stderr, os.Stderr
	if err := build.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "client build failed: %v\n", err)
		os.Exit(1)
	}

	ln, err := net.Listen("unix", sockName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen %s: %v\n", sockName, err)
		os.Exit(1)
	}
	srv := buildServer()
	go srv.Serve(ln)
	defer srv.Stop()

	env := append(os.Environ(),
		"MTAPI_PROTO=grpc",
		"MTAPI_TOKEN="+token,
		"MTAPI_GRPC_SOCK="+sockName,
	)

	failed := false
	check := func(name string, ok bool, detail string) {
		if ok {
			fmt.Printf("  ok %s\n", name)
		} else {
			fmt.Printf("  FAIL %s %s\n", name, detail)
			failed = true
		}
	}

	run := func(env2 []string, args ...string) (string, string, int) {
		var so, se bytes.Buffer
		cmd := exec.Command(bin, args...)
		cmd.Env = env2
		cmd.Stdout, cmd.Stderr = &so, &se
		err := cmd.Run()
		code := 0
		if err != nil {
			if ee, ok := err.(*exec.ExitError); ok {
				code = ee.ExitCode()
			} else {
				code = -1
			}
		}
		return so.String(), se.String(), code
	}

	so, se, code := run(env, "ping")
	check("ping", code == 0 && strings.Contains(so, "pong"),
		fmt.Sprintf("rc=%d out=%q err=%q", code, so, se))

	so, se, code = run(env, "battery")
	check("battery", code == 0 && strings.Contains(so, "42"),
		fmt.Sprintf("rc=%d out=%q err=%q", code, so, se))

	so, se, code = run(env, "ticker", "--count", "3", "--interval", "20")
	lines := 0
	for _, l := range strings.Split(so, "\n") {
		if strings.TrimSpace(l) != "" {
			lines++
		}
	}
	check("ticker", code == 0 && lines == 3,
		fmt.Sprintf("rc=%d lines=%d out=%q err=%q", code, lines, so, se))

	badEnv := append(os.Environ(),
		"MTAPI_PROTO=grpc",
		"MTAPI_TOKEN=wrong",
		"MTAPI_GRPC_SOCK="+sockName,
	)
	_, se, code = run(badEnv, "ping")
	check("bad-token", code != 0 && strings.Contains(se, "Unauthenticated"),
		fmt.Sprintf("rc=%d err=%q", code, se))

	if failed {
		fmt.Println("\ngrpc-e2e: FAIL")
		os.Exit(1)
	}
	fmt.Println("\ngrpc-e2e: OK")
}
