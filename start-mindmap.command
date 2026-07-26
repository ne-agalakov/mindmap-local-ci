#!/bin/bash

set -u
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "MindMap — локальный запуск"
echo "MindMap v0.6-alpha.19 candidate.5"
echo

MODEL_NAME="${OLLAMA_MODEL:-qwen3:8b}"
export OLLAMA_MODEL="${MODEL_NAME}"

if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js 22 или новее."
  echo "Установите Node.js и повторно запустите этот файл."
  open "https://nodejs.org/en/download" >/dev/null 2>&1 || true
  read -r -p "Нажмите Enter для выхода."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Текущая версия Node.js слишком старая: $(node -v). Нужна 22 или новее."
  open "https://nodejs.org/en/download" >/dev/null 2>&1 || true
  read -r -p "Нажмите Enter для выхода."
  exit 1
fi

MODEL_JSON="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$MODEL_NAME")"
printf 'export const CONFIGURED_SEMANTIC_MODEL = %s;\n' "$MODEL_JSON" > "$PROJECT_DIR/app/lib/runtime-config.ts"
echo "Выбранная модель смыслового ядра: ${MODEL_NAME}"
echo "Серверная конфигурация модели записана до запуска."
echo "AI-этап автоматически не запускается."
echo

# В candidate.5 node_modules намеренно не упакован: зависимости ставятся
# непосредственно на Mac, поэтому npm выбирает корректные Darwin/ARM-модули.
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Первый запуск: устанавливаю компоненты MindMap для этого Mac…"
  echo "Это безопасная локальная установка; AI не вызывается."
  if ! npm ci; then
    echo
    echo "Не удалось установить компоненты MindMap."
    echo "Пришлите последние строки из этого окна."
    read -r -p "Нажмите Enter для выхода."
    exit 1
  fi
fi

# Снимаем карантин только с нативных библиотек зависимостей этой сборки.
if [ "$(uname -s)" = "Darwin" ] && command -v xattr >/dev/null 2>&1; then
  find "$PROJECT_DIR/node_modules" -type f \( -name "*.node" -o -name "*.dylib" \) \
    -exec xattr -d com.apple.quarantine {} + 2>/dev/null || true
fi

# Проверяем нативный модуль после установки, а не до неё.
if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
  if ! node -e 'require("@rolldown/binding-darwin-arm64")' >/dev/null 2>&1; then
    echo
    echo "Не удалось загрузить компонент Rolldown для Apple Silicon."
    echo "AI не вызывался. Пришлите последние строки из этого окна."
    read -r -p "Нажмите Enter для выхода."
    exit 1
  fi
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "MindMap уже запущен в другом окне Терминала."
  echo "Закройте старое окно MindMap и повторно запустите этот файл."
  read -r -p "Нажмите Enter для выхода."
  exit 1
fi

echo
echo "MindMap запускается. Не закрывайте это окно во время работы."
echo "Браузер откроется автоматически."
echo
if ! npm run dev -- --open --host 127.0.0.1 --port 5173 --strictPort; then
  echo
  echo "MindMap завершился с ошибкой. AI не вызывался автоматически."
  echo "Пришлите последние строки из этого окна."
  read -r -p "Нажмите Enter для выхода."
  exit 1
fi
