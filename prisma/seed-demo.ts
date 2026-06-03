/**
 * デモ用サンプル仕訳を投入するスクリプト。
 * 動作確認用。本番運用前には不要。
 *
 *   npm run db:seed:demo
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { evaluateTemplate, parsePattern } from "../src/lib/templates";

const prisma = new PrismaClient();

type DemoEntry = {
  date: string;
  description: string;
  templateKey: string;
  amount: number;
  counterparty?: string;
  memo?: string;
};

const demoEntries: DemoEntry[] = [
  {
    date: "2026-04-30",
    description: "株式会社サンプル 業務委託 4月分",
    templateKey: "sales_invoice",
    amount: 500000,
    counterparty: "株式会社サンプル",
  },
  {
    date: "2026-05-10",
    description: "株式会社サンプル 4月分 入金（プライベート口座）",
    templateKey: "sales_receipt_personal_account",
    amount: 451045,
    counterparty: "株式会社サンプル",
    memo: "源泉所得税 48,955円差引後",
  },
  {
    date: "2026-04-25",
    description: "5月分 家賃",
    templateKey: "rent_apportioned",
    amount: 120000,
  },
  {
    date: "2026-05-01",
    description: "Notion AI サブスク",
    templateKey: "subscription",
    amount: 1500,
    counterparty: "Notion Labs",
  },
  {
    date: "2026-05-08",
    description: "渋谷→品川 打合せ",
    templateKey: "transport",
    amount: 320,
    memo: "Suica",
  },
  {
    date: "2026-05-12",
    description: "技術書 購入",
    templateKey: "books",
    amount: 3850,
    counterparty: "Amazon",
    memo: "Next.js本",
  },
];

async function main() {
  const templates = await prisma.journalTemplate.findMany();
  const tmplMap = new Map(templates.map((t) => [t.key, t]));

  const ratios = await prisma.setting.findMany({
    where: { key: { startsWith: "ratio_" } },
  });
  const ratioMap = new Map<string, number>(
    ratios.map((r) => [r.key, Number(r.value)]),
  );

  const maxBefore = await prisma.journalEntry.aggregate({
    _max: { voucherNo: true },
  });
  let voucherNo = (maxBefore._max.voucherNo ?? 0) + 1;

  for (const d of demoEntries) {
    const t = tmplMap.get(d.templateKey);
    if (!t) {
      console.warn(`template missing: ${d.templateKey}`);
      continue;
    }
    const pattern = parsePattern(t.pattern);
    const ratio = pattern.settingKey ? (ratioMap.get(pattern.settingKey) ?? 1) : 1;
    const lines = evaluateTemplate(pattern, { amount: d.amount, ratio });

    const entry = await prisma.journalEntry.create({
      data: {
        entryDate: new Date(d.date + "T00:00:00"),
        description: d.description,
        voucherNo: voucherNo++,
        templateKey: d.templateKey,
        lines: {
          create: lines.map((l, idx) => ({
            accountCode: l.accountCode,
            debitAmount: l.side === "debit" ? l.amount : 0,
            creditAmount: l.side === "credit" ? l.amount : 0,
            counterparty: d.counterparty ?? null,
            memo: l.memo ?? d.memo ?? null,
            lineOrder: idx,
            taxCategory: l.taxCategory ?? null,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        journalId: entry.id,
        action: "create",
        afterJson: JSON.stringify({ demo: true, ...d }),
      },
    });
  }

  const total = await prisma.journalEntry.count();
  console.log(`Inserted ${demoEntries.length} demo entries. Total in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
