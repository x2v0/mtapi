package main

import _ "embed"

//go:embed index.html
var indexHTML string

//go:embed manifest.json
var manifestJSON string

//go:embed sw.js
var swJS string
