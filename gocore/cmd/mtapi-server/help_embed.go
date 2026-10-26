package main

import (
	"bytes"
	"embed"
	"path"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
)

//go:embed help_docs/*.md
var helpDocsFS embed.FS

var helpMD = goldmark.New(
	goldmark.WithExtensions(extension.GFM),
	goldmark.WithParserOptions(parser.WithAutoHeadingID()),
)

var helpDocCache = map[string][2]string{}

// renderHelpDoc loads help_docs/<slug>.md, extracts frontmatter title,
// converts markdown -> HTML (goldmark GFM).
func renderHelpDoc(slug string) (string, string) {
	if v, ok := helpDocCache[slug]; ok {
		return v[0], v[1]
	}
	raw, err := helpDocsFS.ReadFile(path.Join("help_docs", slug+".md"))
	if err != nil {
		return slug, `<p class="hint" style="color:#c00">doc not found: ` + slug + `</p>`
	}
	title, md := parseFrontmatter(raw)
	if title == "" {
		title = slug
	}
	var buf bytes.Buffer
	if err := helpMD.Convert(md, &buf); err != nil {
		return title, `<p class="hint" style="color:#c00">md error: ` + err.Error() + `</p>`
	}
	html := buf.String()
	helpDocCache[slug] = [2]string{title, html}
	return title, html
}

// parseFrontmatter splits YAML frontmatter (--- ... ---), extracts "title:".
func parseFrontmatter(raw []byte) (title string, body []byte) {
	s := string(raw)
	if !strings.HasPrefix(s, "---") {
		for _, line := range strings.Split(s, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "# ") {
				return strings.TrimPrefix(line, "# "), []byte(s)
			}
		}
		return "", []byte(s)
	}
	rest := s[3:]
	if strings.HasPrefix(rest, "\n") {
		rest = rest[1:]
	}
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return "", []byte(s)
	}
	fm := rest[:end]
	body = []byte(strings.TrimPrefix(rest[end+4:], "\n"))
	for _, line := range strings.Split(fm, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "title:") {
			t := strings.TrimSpace(strings.TrimPrefix(line, "title:"))
			t = strings.Trim(t, `"'`)
			return t, body
		}
	}
	return "", body
}
