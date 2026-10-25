---
title: "Архитектура"
weight: 2
---

# Архитектура

    WebView (HTML/CSS/JS)
       ↓ fetch("/battery")
    Go HTTP server (:7788)
       ↓ JNI
    Java (MainActivity) → Android API
       ↑ JSON
