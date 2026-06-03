@echo off
REM personal-bookkeeping Windows 起動スクリプト
REM 使い方:
REM   1) ダブルクリックで起動
REM   2) Win+R → shell:startup を開き、本ファイルのショートカットを置くと PC ログイン時に自動起動
REM      （または右クリック→送る→デスクトップ にショートカット作成）

SETLOCAL

REM Node.js への PATH を明示（デフォルトインストール先）
SET PATH=C:\Program Files\nodejs;%PATH%

REM スクリプトのある場所の1つ上（プロジェクトルート）へ移動
cd /d "%~dp0..\"

REM 既に走っていれば二重起動防止（ポート3000を確認）
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
IF %ERRORLEVEL%==0 (
  echo personal-bookkeeping は既に起動しています http://localhost:3000
  timeout /t 3 >nul
  start http://localhost:3000
  exit /b 0
)

REM 依存が未インストールならインストール
IF NOT EXIST "node_modules\next" (
  echo 初回セットアップ: npm install を実行します
  call npm install --no-audit --no-fund
)

REM データベースの初期化（マイグレ未適用なら適用）
call npx prisma migrate deploy
call npx prisma generate

REM ローカルIPv4を取得（スマホからアクセス用URLを案内）
SET LAN_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4.*: 192\." /C:"IPv4.*: 10\." /C:"IPv4.*: 172\."') do (
  if not defined LAN_IP set "LAN_IP=%%a"
)
SET LAN_IP=%LAN_IP: =%

REM 開発サーバー起動（最小化ウィンドウ）
start "personal-bookkeeping" /min cmd /c "npm run dev"

echo.
echo ============================================================
echo  personal-bookkeeping 起動中
echo ============================================================
echo  PC :  http://localhost:3000
IF DEFINED LAN_IP echo  Phone (同一Wi-Fi):  http://%LAN_IP%:3000
echo ============================================================
echo.

REM 起動を待ってブラウザを開く
timeout /t 4 >nul
start http://localhost:3000

ENDLOCAL
exit /b 0
