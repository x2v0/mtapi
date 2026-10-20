# mtapi tests

Тесты app.js (frontend JS из gocore/cmd/mtapi-server/app.js).

## Файлы

- mtapi-app.test.js — exports, ENDPOINTS, esc, isStatic, render* (34 теста)
- mtapi-jsdom.test.js — DOM таблицы, details.sub (5 тестов)
- mtapi-acorn.test.js — parse, function declarations (2 теста)
- mtapi-eslint.test.js — no-undef, no-shadow (1 тест)
- run-all.sh — всё вместе

## Запуск

    cd ~/mtapi/test
    ./run-all.sh

## Требования

- node 18+
- jsdom, acorn в ~/dwn/localhost-dashboard/node_modules/
- eslint (опционально)
