#!/usr/bin/env python3
import os, sys
os.chdir(os.path.expanduser("~/dwn/mtapi"))
"""End-to-end: python mock server on unix socket + real Go client binary."""
import json, socket, subprocess, tempfile, threading, time
from pathlib import Path

ROOT = Path(os.environ.get("PWD", os.getcwd()))
CLIENT = ROOT / "client" / "dist" / "mtapi-linux-amd64"
TMPHOME = Path.home() / "tmp"

def mock_server(sock_path, stop):
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(sock_path)
    srv.listen(4)
    srv.settimeout(0.5)
    try:
        while not stop.is_set():
            try:
                conn, _ = srv.accept()
            except socket.timeout:
                continue
            threading.Thread(target=handle, args=(conn,), daemon=True).start()
    finally:
        srv.close()

def handle(conn):
    buf = b""
    with conn:
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                return
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                try:
                    req = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if req.get("auth") != "tok":
                    resp = {"ok": False, "error": "auth_failed"}
                elif req["method"] == "ping":
                    resp = {"ok": True, "data": {"pong": True}}
                elif req["method"] == "battery":
                    resp = {"ok": True, "data": {"percentage": 42, "charging": True}}
                else:
                    resp = {"ok": False, "error": "unknown"}
                conn.sendall((json.dumps(resp) + "\n").encode())

def run():
    if not CLIENT.exists():
        print(f"skip: {CLIENT} not built (run `make client`)")
        return 0

    TMPHOME.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=TMPHOME) as d:
        sp = os.path.join(d, "s.sock")
        stop = threading.Event()
        t = threading.Thread(target=mock_server, args=(sp, stop), daemon=True)
        t.start()
        for _ in range(100):
            if os.path.exists(sp):
                break
            time.sleep(0.02)

        env = dict(os.environ, MTAPI_TOKEN="tok", MTAPI_SOCK=sp)

        r = subprocess.run([str(CLIENT), "ping"], env=env, capture_output=True, text=True)
        assert r.returncode == 0, f"ping rc={r.returncode} stderr={r.stderr}"
        assert "pong" in r.stdout, r.stdout
        print("  ok ping")

        r = subprocess.run([str(CLIENT), "battery"], env=env, capture_output=True, text=True)
        assert r.returncode == 0, f"battery rc={r.returncode} stderr={r.stderr}"
        assert "42" in r.stdout, r.stdout
        print("  ok battery")

        r = subprocess.run([str(CLIENT), "ping"], env=dict(env, MTAPI_TOKEN="bad"),
                           capture_output=True, text=True)
        assert r.returncode != 0, "bad token should fail"
        assert "auth_failed" in r.stderr, r.stderr
        print("  ok bad-token rejected")

        stop.set(); t.join(timeout=1)
    print("integration: OK")
    return 0

if __name__ == "__main__":
    sys.exit(run())
