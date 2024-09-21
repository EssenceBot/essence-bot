#!/bin/bash
if ! [ -x "$(command -v convert)" ]; then
  echo 'Error: convert command not found. Please install ImageMagick.' >&2
  exit 1
fi

cd "$(dirname "$0")/.."

convert assets/logo-ttb-frame-essence-bot.png -define icon:auto-resize=64,48,32,16 dashboard/public/favicon.ico