#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Экспорт не запущен."
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
  exit 69
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Нужен Node.js 22 или новее. Текущая версия: $(node -v)."
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
  exit 69
fi

echo "MindMap — безопасный экспорт legacy-базы"
echo "Режим: только чтение · без AI · без миграции"
echo "Старое приложение и базу инструмент не изменяет."
echo

exec node tools/browser-legacy-exporter/server.mjs
