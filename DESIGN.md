# 設計書 — personal-bookkeeping

最終更新: 2026-05-18

---

## 0. 確定要件

| 項目 | 内容 |
|---|---|
| 申告区分 | 青色申告65万円控除 |
| 課税区分 | 免税事業者（消費税申告なし、税込経理） |
| 取引規模 | 月数件〜10件程度 |
| 設置場所 | `C:\Users\TakuyaMatsumoto\Documents\personal-bookkeeping` |
| 配布形態 | Next.jsローカルサーバー＋自動起動（ブラウザ利用） |
| 出力ゴール | 月次集計／仕訳帳／総勘定元帳／青色申告決算書PDF／e-Tax XTX |
| 電子帳簿保存法対応 | 訂正履歴ログ＋検索機能（取引日・金額・取引先） |

---

## 1. データモデル

### 1.1 勘定科目（accounts）
個人事業主の青色申告に必要な最小限のセット。

| code | name | type | 用途例 |
|---|---|---|---|
| 101 | 現金 | 資産 | 小口現金 |
| 102 | 普通預金 | 資産 | 事業用口座 |
| 103 | 売掛金 | 資産 | 業務委託の未入金 |
| 106 | 事業主貸 | 資産 | プライベートへの支出 |
| 160 | 工具器具備品 | 資産 | PC等10万円以上 |
| 161 | 減価償却累計額 | 資産（マイナス） | |
| 202 | 未払金 | 負債 | 月末締めの未払い |
| 206 | 事業主借 | 負債 | プライベート資金からの立替 |
| 301 | 元入金 | 純資産 | 期首資本 |
| 401 | 売上高 | 収益 | 業務委託売上 |
| 408 | 雑収入 | 収益 | |
| 501 | 租税公課 | 費用 | 印紙税等 |
| 502 | 地代家賃 | 費用 | 家賃の事業按分 |
| 503 | 水道光熱費 | 費用 | 按分 |
| 504 | 通信費 | 費用 | サブスク・通信 |
| 505 | 旅費交通費 | 費用 | 出張・交通費 |
| 506 | 消耗品費 | 費用 | 文具・10万円未満の備品 |
| 507 | 新聞図書費 | 費用 | 書籍・新聞 |
| 508 | 接待交際費 | 費用 | 会食 |
| 509 | 会議費 | 費用 | 1人5,000円以下の会食 |
| 510 | 外注工賃 | 費用 | |
| 511 | 減価償却費 | 費用 | |
| 599 | 雑費 | 費用 | その他少額 |

### 1.2 主要テーブル

```prisma
// 仕訳ヘッダ
model JournalEntry {
  id          String   @id @default(cuid())
  entryDate   DateTime              // 取引年月日
  description String                // 摘要
  voucherNo   Int      @unique      // 伝票番号（自動採番）
  templateKey String?               // 使ったテンプレート（例: "rent_apportioned"）
  status      String   @default("active") // active / void
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lines       JournalLine[]
  attachments Attachment[]
  audits      AuditLog[]
}

// 仕訳明細（複式簿記）
model JournalLine {
  id             String       @id @default(cuid())
  journal        JournalEntry @relation(fields: [journalId], references: [id])
  journalId      String
  accountCode    String                          // 例: "401"
  account        Account      @relation(fields: [accountCode], references: [code])
  debitAmount    Int          @default(0)        // 借方（円、整数）
  creditAmount   Int          @default(0)        // 貸方
  counterparty   String?                         // 取引先名
  memo           String?
  lineOrder      Int
}

// 勘定科目マスタ
model Account {
  code      String @id           // "401"
  name      String               // "売上高"
  type      String               // "asset" / "liability" / "equity" / "revenue" / "expense"
  category  String               // 決算書区分（例: "経常費用_販管費"）
  isActive  Boolean @default(true)
  lines     JournalLine[]
}

// 訂正履歴（電子帳簿保存法対応）
model AuditLog {
  id          String       @id @default(cuid())
  journal     JournalEntry @relation(fields: [journalId], references: [id])
  journalId   String
  action      String       // "create" / "update" / "delete"
  beforeJson  String?      // 変更前スナップショット
  afterJson   String?      // 変更後スナップショット
  changedAt   DateTime     @default(now())
}

// 領収書添付（電子帳簿保存法対応）
model Attachment {
  id          String       @id @default(cuid())
  journal     JournalEntry @relation(fields: [journalId], references: [id])
  journalId   String
  filename    String
  storagePath String                            // ./data/attachments/yyyy/mm/...
  fileHash    String                            // SHA-256（改ざん検知）
  uploadedAt  DateTime     @default(now())
}

// 仕訳テンプレート（複式簿記の負担軽減）
model JournalTemplate {
  key         String @id              // "rent_apportioned"
  label       String                  // "家賃支払（按分）"
  pattern     String                  // JSON: 借方/貸方の科目とフィールド
}

// 設定（事業主情報・按分率・口座など）
model Setting {
  key   String @id
  value String                        // JSON
}
```

### 1.3 仕訳テンプレートの例

`pattern`にJSONで保存：

```json
{
  "label": "家賃支払（按分70%事業）",
  "lines": [
    {"side": "debit", "accountCode": "502", "formula": "amount * ratio"},
    {"side": "debit", "accountCode": "106", "formula": "amount * (1 - ratio)"},
    {"side": "credit", "accountCode": "102", "formula": "amount"}
  ],
  "params": {"ratio": 0.7}
}
```

ユーザーは「家賃 12万円」と入れるだけで、`地代家賃 84,000 / 事業主貸 36,000 / 普通預金 120,000`の仕訳が自動生成される。

---

## 2. 画面構成

| 画面 | URL | 主機能 |
|---|---|---|
| ダッシュボード | `/` | 当月収支サマリー、未入金売掛、最近の仕訳 |
| 仕訳入力 | `/journal/new` | テンプレ選択→金額・日付・摘要入力→保存 |
| 仕訳一覧 | `/journal` | 検索（日付/金額/取引先/科目）、訂正・削除（履歴付き） |
| 領収書アップロード | `/journal/:id/attach` | PDF/画像をローカル保存、SHA-256記録 |
| 月次レポート | `/reports/monthly` | 月別×科目別マトリクス |
| 仕訳帳 | `/reports/journal-book` | 期間指定で出力（PDF/CSV） |
| 総勘定元帳 | `/reports/general-ledger` | 科目別の取引推移 |
| 決算書 | `/reports/final` | 青色申告決算書4枚PDF |
| e-Tax出力 | `/reports/etax` | XTXファイル生成・ダウンロード |
| 設定 | `/settings` | 事業主情報、按分率、勘定科目、テンプレ管理 |

---

## 3. 電子帳簿保存法の要件対応

国税庁「電子帳簿等保存制度」の要件と本ツールの対応：

| 要件 | 本ツールの対応 |
|---|---|
| 真実性確保（訂正削除履歴） | `AuditLog`で全変更を記録、UIから閲覧可能 |
| 可視性確保（検索機能） | 取引年月日・金額・取引先で検索、組合せ検索可能 |
| 可視性確保（見読可能装置） | ブラウザで一覧表示、PDF出力 |
| 関係書類（マニュアル） | `docs/manual.md`として整備 |
| 電子取引データ保存 | PDFをローカル保存、SHA-256ハッシュで改ざん検知 |

> 出典: 国税庁「電子帳簿保存法一問一答（電子計算機を使用して作成する帳簿書類関係）」

---

## 4. e-Tax連携（XTXファイル出力）

### 4.1 方針
- e-Taxソフト（または確定申告書等作成コーナー）に取り込める「組み込み型」XTXファイルを生成
- 対象は**青色申告決算書（一般用）**と**所得税確定申告書B**の数値部分
- ファイル仕様は国税庁公開の「組み込み型ソフトウェア用 仕様書」に従う（年度別）

### 4.2 注意点
- **仕様書は年度ごとに更新される**（毎年1月に新仕様公開）
- v1リリース時点では令和8年分（2026年分=2027年3月申告）の仕様で実装
- マイナンバー入力等は手動とし、ツール内では持たない（情報漏洩リスク低減）

### 4.3 出力対象項目（最小セット）
- 売上金額、売上原価、各経費科目の合計
- 青色申告特別控除前の所得金額、所得金額
- 貸借対照表の各科目残高（期首・期末）

---

## 5. 開発フェーズ

| フェーズ | 内容 | 想定工数 |
|---|---|---|
| F1 | プロジェクト初期化＋DB＋勘定科目マスタ | 1セッション |
| F2 | 仕訳入力UI＋テンプレ機能 | 1-2セッション |
| F3 | 月次レポート＋仕訳帳＋総勘定元帳 | 1セッション |
| F4 | 領収書添付＋訂正履歴＋検索機能（電帳法対応） | 1セッション |
| F5 | 青色申告決算書PDF | 1-2セッション |
| F6 | e-Tax XTX出力 | 2セッション（仕様調査含む） |
| F7 | Windows自動起動セットアップ | 0.5セッション |

合計：7-9セッション。月1回ペースで取り組めば年内完成、初回申告（2027年2-3月）に間に合う。

---

## 6. 仮置きデフォルト（設定画面で変更可能）

1. **按分率**：家賃70% ／ 通信費80% ／ 水道光熱費50%
2. **事業用口座**：分けない前提。プライベート口座からの支払いは `事業主借`、プライベートへの支出は `事業主貸` で処理
3. **減価償却**：F1には含めず、必要時に追加

## 7. クロスプラットフォーム対応（Mac引き継ぎ）

- Next.js + SQLite + Prisma 構成は Windows/macOS どちらでも動作
- データは `./data/bookkeeping.db`（SQLite単一ファイル）＋ `./data/attachments/` ディレクトリ
- 引き継ぎ手順：プロジェクトディレクトリごとコピー → `npm install` → `npm run dev`
- iCloud Drive / Dropbox 等で同期する場合は、書き込み中の競合を避けるため**両方同時起動はしない**
- 自動起動スクリプトは Windows用（`.bat` + スタートアップ登録）と Mac用（`.command` + LaunchAgent plist）の2本立て

## 8. 残オープン課題

- **令和8年分XTX仕様書**：2027年1月公開予定。それまでは令和7年分仕様で仮実装、本実装は12月以降
