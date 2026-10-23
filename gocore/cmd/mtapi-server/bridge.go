package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// bridge talks to the Java side via stdin/stdout pipes.
// Go writes REQUESTS to stdout; Java writes RESPONSES to stdin.
type bridge struct {
	mu   sync.Mutex // protects writer
	w    *bufio.Writer
	pend sync.Map // id -> chan *response
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

func bridgeTimeout(method string) time.Duration {
	switch method {
	case "cameraPhoto":
		return 35 * time.Second
	case "microphoneRecord":
		return 65 * time.Second
	case "netPing":
		return 35 * time.Second
	case "audioPlay":
		return 15 * time.Second
	case "sensorRead":
		return 15 * time.Second
	}
	return 5 * time.Second
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

	var r *response
	select {
	case r = <-ch:
	case <-time.After(bridgeTimeout(method)): // per-method timeout (security audit B.3)
		b.pend.Delete(id)
		return nil, fmt.Errorf("bridge timeout: %s", method)
	}
	if r == nil {
		b.pend.Delete(id)
		return nil, fmt.Errorf("bridge reset: %s", method)
	}
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

// ─── MTAPI_CACHE_71: TTL cache for hot endpoints ─────────
type cacheEntry struct {
	data   []byte
	expire time.Time
}

var ttlCache sync.Map

func (b *bridge) cached(key string, ttl time.Duration, fn func() (string, error)) (string, error) {
	if v, ok := ttlCache.Load(key); ok {
		e := v.(cacheEntry)
		if time.Now().Before(e.expire) {
			return string(e.data), nil
		}
	}
	s, err := fn()
	if err == nil {
		ttlCache.Store(key, cacheEntry{[]byte(s), time.Now().Add(ttl)})
	}
	return s, err
}

// MTAPI_252: Reset bridge — clear pending, ttlCache, seq
func (b *bridge) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.pend.Range(func(k, v any) bool {
		ch := v.(chan *response)
		select {
		case ch <- &response{OK: false, Error: "reset"}:
		default:
		}
		b.pend.Delete(k)
		return true
	})
	ttlCache.Range(func(k, v any) bool {
		ttlCache.Delete(k)
		return true
	})
	b.seq.Store(0)
	log.Printf("[mtapi] bridge: RESET — pend=0, seq=0, ttlCache=0")
}
