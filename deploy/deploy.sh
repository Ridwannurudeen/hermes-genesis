#!/bin/bash
set -e

VPS="root@75.119.153.252"
REMOTE_DIR="/opt/genesis"

echo "=== Hermes Genesis Deployment ==="

# Push to GitHub
echo "[1/4] Pushing to GitHub..."
git push origin master

# SSH to VPS and deploy
echo "[2/4] Pulling code on VPS..."
ssh $VPS "cd $REMOTE_DIR && git pull origin master"

echo "[3/4] Building Docker container..."
ssh $VPS "cd $REMOTE_DIR && docker compose build"

echo "[4/4] Restarting container..."
ssh $VPS "cd $REMOTE_DIR && docker compose down && docker compose up -d"

echo ""
echo "=== Deployment complete ==="
echo "API: https://genesis.hermes-ouroboros.online/api/health"
echo "App: https://genesis.hermes-ouroboros.online"
