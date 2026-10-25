package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// proxyWhitelist — allowed localhost ports for /proxy/PORT/* (security)
var proxyWhitelist = map[string]bool{
	"5555": true,
	"3000": true,
	"8080": true,
}

// proxyHandler proxies /proxy/PORT/path → http://127.0.0.1:PORT/path
// Same-origin as mtapi (7788) → iframe.contentDocument available → full debug.
func (s *apiServer) proxyHandler(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/proxy/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, "usage: /proxy/PORT/path", http.StatusBadRequest)
		return
	}
	port := parts[0]
	if !proxyWhitelist[port] {
		http.Error(w, "port not allowed: "+port, http.StatusForbidden)
		return
	}
	path := "/"
	if len(parts) > 1 && parts[1] != "" {
		path = "/" + parts[1]
	}

	target, err := url.Parse("http://127.0.0.1:" + port)
	if err != nil {
		http.Error(w, "bad port", http.StatusBadRequest)
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "proxy error: "+err.Error()+" (is localhost:"+port+" running?)", http.StatusBadGateway)
	}
	r.URL.Path = path
	r.Host = target.Host
	// Same-origin: allow iframe to read contentDocument
	w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:7788")
	proxy.ServeHTTP(w, r)
}
