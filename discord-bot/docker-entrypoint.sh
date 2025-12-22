#!/bin/sh
set -e

echo "Installing dependencies..."
cd /app
bun install --production

echo "Starting bot..."
cd /app
exec bun run start:discord-bot
