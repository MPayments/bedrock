#!/bin/sh
set -e

DATA_FILE="/data/0_0.tigerbeetle"

if [ ! -f "$DATA_FILE" ]; then
  echo "Data file not found — formatting..."
  tigerbeetle format --cluster=1 --replica=0 --replica-count=1 "$DATA_FILE"
  echo "Format complete."
fi

echo "Starting TigerBeetle..."
exec tigerbeetle start --addresses=0.0.0.0:3000 "$DATA_FILE"
