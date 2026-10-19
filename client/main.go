package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"mtapi/client/pkg/client"
)

func usage() {
	fmt.Fprint(os.Stderr, `mtapi - Go client for @mtapi

  mtapi ping
  mtapi battery
  mtapi wifi
  mtapi device
  mtapi location
  mtapi clipboard get
  mtapi clipboard set <text>
  mtapi toast <text>
  mtapi notify <title> <body>
  mtapi vibrate <ms>
  mtapi torch on|off
  mtapi tts <text>
  mtapi share --title <t> --text <x>
  mtapi contacts [limit]
  mtapi calllog  [limit]
  mtapi sms list [limit]
  mtapi sms send <number> <text>
  mtapi camera --out <path>
`)
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}
	c, err := client.New(client.ResolveToken())
	if err != nil {
		fmt.Fprintln(os.Stderr, "err:", err)
		os.Exit(1)
	}
	defer c.Close()

	method := os.Args[1]
	args := os.Args[2:]

	var params interface{}
	switch method {
	case "ping", "battery", "wifi", "device", "location":
	case "clipboard":
		if len(args) < 1 { usage(); os.Exit(1) }
		p := map[string]string{"op": args[0]}
		if args[0] == "set" && len(args) >= 2 {
			p["text"] = args[1]
		}
		params = p
	case "toast":
		params = map[string]string{"text": joinArgs(args)}
	case "notify":
		if len(args) < 2 { usage(); os.Exit(1) }
		params = map[string]string{"title": args[0], "body": args[1]}
	case "vibrate":
		ms, _ := strconv.Atoi(args[0])
		params = map[string]int{"ms": ms}
	case "torch":
		params = map[string]bool{"on": len(args) > 0 && args[0] == "on"}
	case "tts":
		params = map[string]string{"text": joinArgs(args)}
	case "share":
		var title, text string
		for i := 0; i < len(args)-1; i++ {
			if args[i] == "--title" { title = args[i+1] }
			if args[i] == "--text"  { text = args[i+1] }
		}
		params = map[string]string{"title": title, "text": text}
	case "camera":
		var out string
		for i := 0; i < len(args)-1; i++ {
			if args[i] == "--out" { out = args[i+1] }
		}
		params = map[string]string{"path": out}
	case "contacts":
		limit := 20
		if len(args) > 0 { limit, _ = strconv.Atoi(args[0]) }
		params = map[string]int{"limit": limit}
	case "calllog":
		limit := 20
		if len(args) > 0 { limit, _ = strconv.Atoi(args[0]) }
		params = map[string]int{"limit": limit}
	case "sms":
		if len(args) < 1 { usage(); os.Exit(1) }
		if args[0] == "send" {
			if len(args) < 3 { usage(); os.Exit(1) }
			params = map[string]string{"op": "send", "to": args[1], "text": args[2]}
		} else {
			limit := 20
			if len(args) > 1 { limit, _ = strconv.Atoi(args[1]) }
			params = map[string]interface{}{"op": "list", "limit": limit}
		}
	default:
		usage()
		os.Exit(1)
	}

	data, err := c.Call(method, params)
	if err != nil {
		fmt.Fprintln(os.Stderr, "err:", err)
		os.Exit(1)
	}
	if len(data) > 0 && string(data) != "null" {
		var pretty interface{}
		if json.Unmarshal(data, &pretty) == nil {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			enc.Encode(pretty)
		} else {
			os.Stdout.Write(data)
		}
	}
}

func joinArgs(a []string) string {
	out := ""
	for i, s := range a {
		if i > 0 { out += " " }
		out += s
	}
	return out
}
