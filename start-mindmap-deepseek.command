#!/bin/bash

set -u
cd "$(dirname "$0")"

export OLLAMA_MODEL="deepseek-r1:8b"
exec ./start-mindmap.command
