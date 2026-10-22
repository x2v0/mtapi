"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const SRC = fs.readFileSync(path.resolve(__dirname, "../gocore/cmd/mtapi-server/mtapi-debug.js"), "utf-8");
function mk(){ return new JSDOM("<html><body></body></html>", { url: "http://127.0.0.1:7788/", runScripts: "outside-only" }); }

test("mtapi-debug.js: syntax", function(){ assert.doesNotThrow(function(){ new Function(SRC); }); });

test("mtapi-debug.js: no bare eval(", function(){
  assert.ok(!/(^|[^.\w])eval\s*\(/.test(SRC), "bare eval( found");
});

test("mtapi-debug.js: exposes MtapiDebug", function(){
  var w = mk().window; w.eval(SRC);
  assert.ok(typeof w.MtapiDebug === "object");
  assert.strictEqual(w.MtapiDebug.version, "0.1.0");
});

test("mtapi-debug.js: attach renders card", function(){
  var dom = new JSDOM("<html><body><div id=\"c\"></div></body></html>", { url: "http://127.0.0.1:7788/", runScripts: "outside-only" });
  var w = dom.window; w.eval(SRC);
  var card = w.MtapiDebug.attach({ container: w.document.getElementById("c") });
  assert.ok(card, "no card");
  assert.strictEqual(card.id, "mtapi-debug-card");
  assert.ok(w.document.getElementById("mtapi-debug-jslog"));
});

test("mtapi-debug.js: log + stack in buffer", function(){
  var w = mk().window; w.eval(SRC);
  try { throw new Error("boom42"); } catch(e){ w.MtapiDebug.log("error", "test", e); }
  var buf = w.MtapiDebug.buffer();
  assert.ok(buf.length > 0);
  var last = buf[buf.length-1];
  assert.strictEqual(last.lvl, "error");
  assert.ok(last.m.indexOf("boom42") >= 0);
});

test("mtapi-debug.js: persistent errors", function(){
  var w = mk().window; w.eval(SRC);
  w.MtapiDebug.log("error", "persist-xyz");
  var s = w.MtapiDebug.errors();
  assert.ok(s.length > 0);
  assert.strictEqual(s[0].m, "persist-xyz");
});
