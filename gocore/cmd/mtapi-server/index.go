package main

import _ "embed"

//go:embed index.html
var indexHTML string

//go:embed manifest.json
var manifestJSON string

//go:embed sw.js
var swJS string

//go:embed app.js
var appJS string

//go:embed style.css
var styleCSS string

//go:embed me.jpg
var meJPG []byte
