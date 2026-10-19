package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

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

func handleJSON(conn net.Conn) {
	defer conn.Close()
	sc := bufio.NewScanner(conn)
	enc := json.NewEncoder(conn)
	for sc.Scan() {
		var req struct {
			Auth   string `json:"auth"`
			Method string `json:"method"`
		}
		if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
			continue
		}
		var resp map[string]any
		if req.Auth != "tok" {
			resp = map[string]any{"ok": false, "error": "auth_failed"}
		} else {
			switch req.Method {
			case "ping":
				resp = map[string]any{"ok": true, "data": map[string]bool{"pong": true}}
			case "battery":
				resp = map[string]any{"ok": true, "data": map[string]any{
					"percentage": 42, "charging": true,
				}}
			default:
				resp = map[string]any{"ok": false, "error": "unknown"}
			}
		}
		enc.Encode(resp)
	}
}

func mockServer(sockPath string, done chan struct{}) {
	ln, err := net.Listen("unix", sockPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen %s: %v\n", sockPath, err)
		return
	}
	defer ln.Close()
	go func() {
		<-done
		ln.Close()
	}()
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go handleJSON(conn)
	}
}

func main() {
	root := findRoot()
	if root == "" {
		fmt.Fprintln(os.Stderr, "repo root not found")
		os.Exit(1)
	}

	tmp, err := os.MkdirTemp("", "mtapi-integ-*")
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

	sockPath := filepath.Join(tmp, "s.sock")
	done := make(chan struct{})
	go mockServer(sockPath, done)
	defer close(done)

	for i := 0; i < 100; i++ {
		if _, err := os.Stat(sockPath); err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	env := append(os.Environ(),
		"MTAPI_TOKEN=tok",
		"MTAPI_SOCK="+sockPath,
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

	badEnv := append(os.Environ(),
		"MTAPI_TOKEN=bad",
		"MTAPI_SOCK="+sockPath,
	)
	_, se, code = run(badEnv, "ping")
	check("bad-token", code != 0 && strings.Contains(se, "auth_failed"),
		fmt.Sprintf("rc=%d err=%q", code, se))

	if failed {
		fmt.Println("\nintegration: FAIL")
		os.Exit(1)
	}
	fmt.Println("\nintegration: OK")
}
