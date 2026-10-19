package mobile

import "encoding/json"

func json_NewEncoder(w interface{ Write([]byte) (int, error) }) *json.Encoder {
	return json.NewEncoder(w)
}
func json_Unmarshal(b []byte, v interface{}) error { return json.Unmarshal(b, v) }
func json_Marshal(v interface{}) ([]byte, error)  { return json.Marshal(v) }
