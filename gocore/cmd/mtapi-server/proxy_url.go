package main

import (
	"io"
	"net/http"
	"net/url"
	"strings"
)

// /proxy-url?url=https://example.com
// Fetch → strip X-Frame-Options/CSP (server-side) → inject <base> + nav → return HTML
func (s *apiServer) proxyURLHandler(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Query().Get("url")
	if target == "" {
		http.Error(w, "usage: /proxy-url?url=...", http.StatusBadRequest)
		return
	}
	u, err := url.Parse(target)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		http.Error(w, "bad url", http.StatusBadRequest)
		return
	}
	req, err := http.NewRequest("GET", target, nil)
	if err != nil {
		http.Error(w, "req: "+err.Error(), http.StatusBadRequest)
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "fetch: "+err.Error()+" (site down or blocked)", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	html := string(body)

	// Inject <base> for relative links
	base := "<base href=\"" + target + "\">"
	if strings.Contains(html, "<head>") {
		html = strings.Replace(html, "<head>", "<head>"+base, 1)
	} else if strings.Contains(html, "<HEAD>") {
		html = strings.Replace(html, "<HEAD>", "<HEAD>"+base, 1)
	} else {
		html = base + html
	}

	// Navigation interceptor: links → postMessage to parent
	script := `<script>(function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a){var h=a.href;if(h&&h.indexOf("javascript:")!==0){e.preventDefault();try{parent.postMessage({type:"mtapi-nav",url:h},"*");}catch(x){}}}},true);})();</script>`
	if strings.Contains(html, "</body>") {
		html = strings.Replace(html, "</body>", script+"</body>", 1)
	} else {
		html = html + script
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:7788")
	w.Header().Set("X-Frame-Options", "ALLOWALL") // strip (we are the proxy)
	w.Write([]byte(html))
}
