package client

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
)

// sockAddr resolves the unix socket. Abstract "@mtapi" by default;
// can be overridden via MTAPI_SOCK (file path or "@name").
func sockAddr() string {
	if s := os.Getenv("MTAPI_SOCK"); s != "" {
		return s
	}
	return "@mtapi"
}

type Request struct {
	Auth   string      `json:"auth"`
	Method string      `json:"method"`
	Params interface{} `json:"params,omitempty"`
}

type Response struct {
	OK    bool            `json:"ok"`
	Data  json.RawMessage `json:"data,omitempty"`
	Error string          `json:"error,omitempty"`
}

type Client struct {
	conn  net.Conn
	rd    *bufio.Reader
	token string
}

func New(token string) (*Client, error) {
	addr := sockAddr()
	c, err := net.Dial("unix", addr)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	return &Client{conn: c, rd: bufio.NewReader(c), token: token}, nil
}

func (c *Client) Close() error { return c.conn.Close() }

func (c *Client) Call(method string, params interface{}) (json.RawMessage, error) {
	req := Request{Auth: c.token, Method: method, Params: params}
	if err := json.NewEncoder(c.conn).Encode(req); err != nil {
		return nil, err
	}
	line, err := c.rd.ReadBytes('\n')
	if err != nil {
		return nil, err
	}
	var r Response
	if err := json.Unmarshal(line, &r); err != nil {
		return nil, err
	}
	if !r.OK {
		return nil, errors.New(r.Error)
	}
	return r.Data, nil
}

func ResolveToken() string {
	if t := os.Getenv("MTAPI_TOKEN"); t != "" {
		return t
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return ""
	}
	b, err := os.ReadFile(home + "/.config/mtapi/token")
	if err != nil {
		return ""
	}
	return string(b)
}
