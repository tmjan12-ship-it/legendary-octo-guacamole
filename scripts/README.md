# 起動・自動起動セットアップ

## 通常起動

### Windows
`scripts\start-server.bat` をダブルクリック

起動後、自動でブラウザが `http://localhost:3000` を開きます。

### macOS / Linux
```bash
chmod +x scripts/start-server.command  # 初回のみ
./scripts/start-server.command
```

Finderからダブルクリックでも起動可（初回 chmod 必要）。

---

## PCログイン時の自動起動

### Windows（スタートアップフォルダ方式）

1. `Win + R` → `shell:startup` → Enter
2. 開いたフォルダに `start-server.bat` の **ショートカット** をコピー
   （右クリック → 送る → ショートカット作成、で生成 → スタートアップフォルダへ移動）
3. 次回PCログインから自動起動

停止：タスクマネージャーで `node.exe` を終了 or 起動した最小化ウィンドウを閉じる

### macOS（LaunchAgent 方式）

1. `scripts/com.matsutaku.personal-bookkeeping.plist` をテキストエディタで開く
2. 3箇所の `PROJECT_PATH` を自身のフルパスに書き換え（例: `/Users/yourname/Documents/personal-bookkeeping`）
3. plist を LaunchAgents へコピー：
   ```bash
   cp scripts/com.matsutaku.personal-bookkeeping.plist ~/Library/LaunchAgents/
   ```
4. ロード：
   ```bash
   launchctl load ~/Library/LaunchAgents/com.matsutaku.personal-bookkeeping.plist
   ```
5. 次回PCログインから自動起動

停止・アンロード：
```bash
launchctl unload ~/Library/LaunchAgents/com.matsutaku.personal-bookkeeping.plist
```

---

## Mac へ引き継ぐ場合

1. プロジェクトフォルダごとコピー（USBメモリ・iCloud Drive・Dropbox 等）
2. ターミナルで以下を実行：
   ```bash
   cd /path/to/personal-bookkeeping
   npm install
   npx prisma generate
   ./scripts/start-server.command
   ```
3. データ（`data/bookkeeping.db` と `data/attachments/`）は同梱コピーされるため、これまでの仕訳がそのまま参照可能

> ⚠ Windows と Mac で同時に同じDBに書き込まないこと。書き込み中の競合で破損するリスクあり。
