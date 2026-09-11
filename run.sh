#!/usr/bin/env bash
# Sobe o servidor do jogo (arquivos + salas online) e mostra o IP da rede.
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "instalando dependencias…"
  npm install --no-audit --no-fund || exit 1
fi

exec node server.js
