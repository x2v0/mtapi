package mobile

import (
	"encoding/json"

	"google.golang.org/grpc/encoding"
)

func init() {
	encoding.RegisterCodec(jsonCodec{})
}

// jsonCodec lets us use gRPC without protoc: same wire format
// as the existing JSON-over-UDS, but with grpc-go framing
// (streams, deadlines, HTTP/2 multiplexing).
type jsonCodec struct{}

func (jsonCodec) Marshal(v interface{}) ([]byte, error) {
	if raw, ok := v.(json.RawMessage); ok {
		return raw, nil
	}
	if raw, ok := v.(*json.RawMessage); ok {
		return *raw, nil
	}
	return json.Marshal(v)
}

func (jsonCodec) Unmarshal(data []byte, v interface{}) error {
	if raw, ok := v.(*json.RawMessage); ok {
		*raw = append((*raw)[:0], data...)
		return nil
	}
	return json.Unmarshal(data, v)
}

func (jsonCodec) Name() string { return "json" }
