#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

if ! docker compose version >/dev/null; then
    echo 'Instale o Docker com o plugin Compose para executar o MyCity.' >&2
    exit 1
fi

if [[ ! -e .env && ! -L .env ]]; then
    docker compose --env-file .env.example run --rm --no-deps -T --user "$(id -u):$(id -g)" setup
fi

exec docker compose up -d --build --wait web
