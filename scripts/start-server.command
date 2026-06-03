#!/usr/bin/env bash
# personal-bookkeeping macOS / Linux 起動スクリプト
# 使い方:
#   1) Finder でダブルクリック（初回は chmod +x が必要、後述）
#   2) 自動起動したい場合は LaunchAgent plist を ~/Library/LaunchAgents に配置
#      （同階層の com.matsutaku.personal-bookkeeping.plist を参考にしてください）

set -e

# Node.js PATH（~/local/node にインストール済み）
export PATH="$HOME/local/node/bin:$PATH"

cd "$(dirname "$0")/.."

# 既に走っていれば二重起動防止（lsof で 3000 を確認）
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "personal-bookkeeping は既に起動しています: http://localhost:3000"
  open http://localhost:3000 2>/dev/null || true
  exit 0
fi

# 初回 npm install
if [ ! -d "node_modules/next" ]; then
  echo "初回セットアップ: npm install を実行します"
  npm install --no-audit --no-fund
fi

# DB マイグレーション
npx prisma migrate deploy
npx prisma generate

# 起動（バックグラウンド + ログをファイルへ）
LOG="$(pwd)/data/dev-server.log"
mkdir -p "$(dirname "$LOG")"
nohup npm run dev >"$LOG" 2>&1 &
PID=$!
echo "personal-bookkeeping を起動しました (PID=$PID)"
echo "ログ: $LOG"

# ローカルIP取得（スマホ向け案内）
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "============================================================"
echo "  personal-bookkeeping 起動中"
echo "============================================================"
echo "  PC :  http://localhost:3000"
[ -n "$LAN_IP" ] && echo "  Phone (同一Wi-Fi):  http://$LAN_IP:3000"
echo "============================================================"
echo ""

# Cloudflare Tunnel（外出先からiPhoneでアクセス用）
TUNNEL_LOG="$(pwd)/data/tunnel.log"
if command -v cloudflared >/dev/null 2>&1; then
  nohup cloudflared tunnel --url http://localhost:3000 >"$TUNNEL_LOG" 2>&1 &
  echo "Cloudflare Tunnel 起動中... URLは $TUNNEL_LOG に記録されます"
  sleep 6
  TUNNEL_URL=$(grep -o 'https://[a-z0-9\-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo "============================================================"
    echo "  外出先からのアクセス URL（iPhoneのSafariで開く）"
    echo "  $TUNNEL_URL"
    echo "============================================================"
    echo ""
  fi
fi

# 起動を待ってブラウザを開く
sleep 2
open http://localhost:3000 2>/dev/null || true
