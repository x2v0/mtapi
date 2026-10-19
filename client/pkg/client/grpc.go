package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

func grpcSockAddr() string {
	if s := os.Getenv("MTAPI_GRPC_SOCK"); s != "" {
		return s
	}
	return "@mtapi.grpc"
}

type GRPCClient struct {
	conn  *grpc.ClientConn
	token string
}

func NewGRPC(token string, dialTimeout time.Duration) (*GRPCClient, error) {
	if dialTimeout <= 0 {
		dialTimeout = 3 * time.Second
	}
	addr := grpcSockAddr()

	dialer := func(c context.Context, _ string) (net.Conn, error) {
		var d net.Dialer
		return d.DialContext(c, "unix", addr)
	}

	ctx, cancel := context.WithTimeout(context.Background(), dialTimeout)
	defer cancel()

	conn, err := grpc.DialContext(ctx, "unix",
		grpc.WithContextDialer(dialer),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithDefaultCallOptions(grpc.CallContentSubtype("json")),
	)
	if err != nil {
		return nil, fmt.Errorf("grpc dial %s: %w", addr, err)
	}
	return &GRPCClient{conn: conn, token: token}, nil
}

func (c *GRPCClient) Close() error { return c.conn.Close() }

func (c *GRPCClient) Call(method string, params interface{}) (json.RawMessage, error) {
	if method == "" {
		return nil, errors.New("empty method")
	}
	m := strings.ToUpper(method[:1]) + method[1:]

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	ctx = metadata.NewOutgoingContext(ctx,
		metadata.Pairs("authorization", c.token))

	var payload json.RawMessage
	if params == nil {
		payload = json.RawMessage(`{}`)
	} else {
		b, err := json.Marshal(params)
		if err != nil {
			return nil, err
		}
		payload = b
	}

	var resp struct {
		OK    bool            `json:"ok"`
		Data  json.RawMessage `json:"data,omitempty"`
		Error string          `json:"error,omitempty"`
	}
	if err := c.conn.Invoke(ctx, "/mtapi.Mtapi/"+m, payload, &resp,
		grpc.CallContentSubtype("json")); err != nil {
		return nil, err
	}
	if !resp.OK {
		return nil, errors.New(resp.Error)
	}
	return resp.Data, nil
}

func (c *GRPCClient) Ticker(count, intervalMs int, cb func(seq int, ts int64)) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	ctx = metadata.NewOutgoingContext(ctx,
		metadata.Pairs("authorization", c.token))

	desc := &grpc.StreamDesc{ServerStreams: true}
	stream, err := c.conn.NewStream(ctx, desc, "/mtapi.Mtapi/Ticker",
		grpc.CallContentSubtype("json"))
	if err != nil {
		return err
	}
	req := struct {
		Count      int `json:"count"`
		IntervalMs int `json:"interval_ms"`
	}{Count: count, IntervalMs: intervalMs}
	if err := stream.SendMsg(&req); err != nil {
		return err
	}
	if err := stream.CloseSend(); err != nil {
		return err
	}
	for {
		var ev struct {
			Seq int   `json:"seq"`
			TS  int64 `json:"ts"`
		}
		if err := stream.RecvMsg(&ev); err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		cb(ev.Seq, ev.TS)
	}
}
