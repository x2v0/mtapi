---
title: "DOM inspector"
weight: 40
bookToc: false
---

<h1>🌳 DOM floating</h1>
<p>Кнопка 🌳 в Console Eval → floating окно (DOM tree + info panel).</p>
<h2>Возможности</h2>
<table><thead><tr><th>Feature</th><th>Как</th></tr></thead><tbody>
<tr><td>Select element</td><td><code>domInspect()</code> → клик по странице → info</td></tr>
<tr><td>Root toggle</td><td>▣ (overlay) / 🌐 (page) — auto при открытии/закрытии debug</td></tr>
<tr><td>Auto-refresh</td><td>3с (skip если не изменилось, save open+scroll)</td></tr>
<tr><td>8-edge resize</td><td>Тянуть любой край/угол (n/s/e/w + 4 corners)</td></tr>
<tr><td>Splitter</td><td>⋮⋮ между tree и info (dblclick — reset)</td></tr>
<tr><td>Minimize</td><td>– (свернуть до header)</td></tr>
<tr><td>Drag</td><td>Header (mouse + touch)</td></tr>
<tr><td>Select U+25A3</td><td>▣ (toggle, magenta когда ON)</td></tr>
<tr><td>Copy HTML</td><td>📋 (outerHTML → clipboard, toast)</td></tr>
<tr><td>AI Snap</td><td>✨ (markdown: selector, HTML, CSS 24, parent, children, task)</td></tr>
</tbody></table>
<h2>DOM tree</h2>
<p>Клик по <code>&lt;summary&gt;</code> — toggle. data-tag на каждом узле. Клик по узлу (inspect ON) — подсветка в дереве.</p>
