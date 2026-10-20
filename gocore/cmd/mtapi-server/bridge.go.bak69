package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"sync/atomic"
)

// bridge talks to the Java side via stdin/stdout pipes.
// Go writes REQUESTS to stdout; Java writes RESPONSES to stdin.
type bridge struct {
	mu   sync.Mutex   // protects writer
	w    *bufio.Writer
	pend sync.Map      // id -> chan *response
	seq  atomic.Int64
}

type bridgeReq struct {
	ID     int64          `json:"id"`
	Method string         `json:"method"`
	Params map[string]any `json:"params,omitempty"`
}

type response struct {
	ID    int64           `json:"id"`
	OK    bool            `json:"ok"`
	Data  json.RawMessage `json:"data,omitempty"`
	Error string          `json:"error,omitempty"`
}

func newBridge() *bridge {
	return &bridge{w: bufio.NewWriter(os.Stdout)}
}

func (b *bridge) start() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 64<<10), 4<<20)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var r response
		if err := json.Unmarshal(line, &r); err != nil {
			log.Printf("bridge: bad response: %v", err)
			continue
		}
		if ch, ok := b.pend.Load(r.ID); ok {
			ch.(chan *response) <- &r
			b.pend.Delete(r.ID)
		}
	}
}

func (b *bridge) call(method string, params map[string]any) (*response, error) {
	id := b.seq.Add(1)
	ch := make(chan *response, 1)
	b.pend.Store(id, ch)

	b.mu.Lock()
	enc := json.NewEncoder(b.w)
	err := enc.Encode(bridgeReq{ID: id, Method: method, Params: params})
	b.w.Flush()
	b.mu.Unlock()

	if err != nil {
		b.pend.Delete(id)
		return nil, err
	}

	r := <-ch
	if !r.OK {
		if r.Error == "" {
			r.Error = "unknown error"
		}
		return nil, fmt.Errorf("%s", r.Error)
	}
	return r, nil
}

func (b *bridge) callStr(method string, params map[string]any) (string, error) {
	r, err := b.call(method, params)
	if err != nil {
		return "", err
	}
	return string(r.Data), nil
}

func (b *bridge) callVoid(method string, params map[string]any) error {
	_, err := b.call(method, params)
	return err
}
