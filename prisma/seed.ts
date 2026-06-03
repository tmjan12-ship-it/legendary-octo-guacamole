import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AccountSeed = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  category: string;
  sortOrder: number;
};

const accounts: AccountSeed[] = [
  // 資産
  { code: "101", name: "現金", type: "asset", category: "流動資産", sortOrder: 1 },
  { code: "102", name: "普通預金", type: "asset", category: "流動資産", sortOrder: 2 },
  { code: "103", name: "売掛金", type: "asset", category: "流動資産", sortOrder: 3 },
  { code: "106", name: "事業主貸", type: "asset", category: "流動資産", sortOrder: 4 },
  { code: "160", name: "工具器具備品", type: "asset", category: "固定資産", sortOrder: 10 },
  { code: "161", name: "減価償却累計額", type: "asset", category: "固定資産", sortOrder: 11 },
  // 負債
  { code: "202", name: "未払金", type: "liability", category: "流動負債", sortOrder: 20 },
  { code: "206", name: "事業主借", type: "liability", category: "流動負債", sortOrder: 21 },
  // 純資産
  { code: "301", name: "元入金", type: "equity", category: "純資産", sortOrder: 30 },
  // 収益
  { code: "401", name: "売上高", type: "revenue", category: "売上", sortOrder: 40 },
  { code: "408", name: "雑収入", type: "revenue", category: "営業外収益", sortOrder: 48 },
  // 費用
  { code: "501", name: "租税公課", type: "expense", category: "経費", sortOrder: 50 },
  { code: "502", name: "地代家賃", type: "expense", category: "経費", sortOrder: 51 },
  { code: "503", name: "水道光熱費", type: "expense", category: "経費", sortOrder: 52 },
  { code: "504", name: "通信費", type: "expense", category: "経費", sortOrder: 53 },
  { code: "505", name: "旅費交通費", type: "expense", category: "経費", sortOrder: 54 },
  { code: "506", name: "消耗品費", type: "expense", category: "経費", sortOrder: 55 },
  { code: "507", name: "新聞図書費", type: "expense", category: "経費", sortOrder: 56 },
  { code: "508", name: "接待交際費", type: "expense", category: "経費", sortOrder: 57 },
  { code: "509", name: "会議費", type: "expense", category: "経費", sortOrder: 58 },
  { code: "510", name: "外注工賃", type: "expense", category: "経費", sortOrder: 59 },
  { code: "511", name: "減価償却費", type: "expense", category: "経費", sortOrder: 60 },
  { code: "599", name: "雑費", type: "expense", category: "経費", sortOrder: 99 },
];

type TemplateCategory = "sales" | "expense_apportioned" | "expense_other";
type TaxCategory =
  | "standard_10"
  | "reduced_8"
  | "non_taxable"
  | "untaxed"
  | "exempt";

type TemplateSeed = {
  key: string;
  label: string;
  sortOrder: number;
  pattern: {
    description: string;
    category: TemplateCategory;
    inputs: { name: string; label: string; type: "amount" | "text" | "date" }[];
    lines: {
      side: "debit" | "credit";
      accountCode: string;
      formula: string;
      memo?: string;
      taxCategory?: TaxCategory;
    }[];
    settingKey?: string;
  };
};

const templates: TemplateSeed[] = [
  {
    key: "sales_invoice",
    label: "売上の発生（請求書発行時）",
    sortOrder: 1,
    pattern: {
      description: "売掛金 / 売上高",
      category: "sales",
      inputs: [
        { name: "amount", label: "売上金額", type: "amount" },
        { name: "counterparty", label: "請求先", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "103", formula: "amount", memo: "売掛計上", taxCategory: "untaxed" },
        { side: "credit", accountCode: "401", formula: "amount", memo: "売上計上", taxCategory: "standard_10" },
      ],
    },
  },
  {
    key: "sales_receipt_personal_account",
    label: "売上入金（源泉差引後の入金額）",
    sortOrder: 2,
    pattern: {
      description: "事業主貸 / 売掛金",
      category: "sales",
      inputs: [
        { name: "amount", label: "入金額", type: "amount" },
        { name: "counterparty", label: "入金元", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "106", formula: "amount", taxCategory: "untaxed" },
        { side: "credit", accountCode: "103", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "rent_apportioned",
    label: "家賃（按分あり）",
    sortOrder: 10,
    pattern: {
      description: "地代家賃 + 事業主貸 / 事業主借",
      category: "expense_apportioned",
      inputs: [{ name: "amount", label: "家賃総額", type: "amount" }],
      settingKey: "ratio_rent",
      lines: [
        { side: "debit", accountCode: "502", formula: "round(amount * ratio)", memo: "事業按分", taxCategory: "non_taxable" },
        { side: "debit", accountCode: "106", formula: "amount - round(amount * ratio)", memo: "家事按分", taxCategory: "untaxed" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "telecom_apportioned",
    label: "通信費（按分あり）",
    sortOrder: 11,
    pattern: {
      description: "通信費 + 事業主貸 / 事業主借",
      category: "expense_apportioned",
      inputs: [{ name: "amount", label: "支払額", type: "amount" }],
      settingKey: "ratio_telecom",
      lines: [
        { side: "debit", accountCode: "504", formula: "round(amount * ratio)", memo: "事業按分", taxCategory: "standard_10" },
        { side: "debit", accountCode: "106", formula: "amount - round(amount * ratio)", memo: "家事按分", taxCategory: "untaxed" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "utilities_apportioned",
    label: "水道光熱費(按分あり)",
    sortOrder: 12,
    pattern: {
      description: "水道光熱費 + 事業主貸 / 事業主借",
      category: "expense_apportioned",
      inputs: [{ name: "amount", label: "支払額", type: "amount" }],
      settingKey: "ratio_utilities",
      lines: [
        { side: "debit", accountCode: "503", formula: "round(amount * ratio)", memo: "事業按分", taxCategory: "standard_10" },
        { side: "debit", accountCode: "106", formula: "amount - round(amount * ratio)", memo: "家事按分", taxCategory: "untaxed" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "subscription",
    label: "サブスク（通信費）",
    sortOrder: 20,
    pattern: {
      description: "通信費 / 事業主借",
      category: "expense_other",
      inputs: [
        { name: "amount", label: "支払額", type: "amount" },
        { name: "counterparty", label: "サービス名", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "504", formula: "amount", taxCategory: "standard_10" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "transport",
    label: "旅費交通費",
    sortOrder: 21,
    pattern: {
      description: "旅費交通費 / 事業主借",
      category: "expense_other",
      inputs: [
        { name: "amount", label: "金額", type: "amount" },
        { name: "memo", label: "区間・目的", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "505", formula: "amount", taxCategory: "standard_10" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "supplies",
    label: "消耗品費",
    sortOrder: 22,
    pattern: {
      description: "消耗品費 / 事業主借",
      category: "expense_other",
      inputs: [
        { name: "amount", label: "金額", type: "amount" },
        { name: "counterparty", label: "購入先", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "506", formula: "amount", taxCategory: "standard_10" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "books",
    label: "新聞図書費",
    sortOrder: 23,
    pattern: {
      description: "新聞図書費 / 事業主借",
      category: "expense_other",
      inputs: [
        { name: "amount", label: "金額", type: "amount" },
        { name: "counterparty", label: "購入先", type: "text" },
        { name: "memo", label: "タイトル", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "507", formula: "amount", taxCategory: "standard_10" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "meeting",
    label: "会議費（1人5,000円以下の会食）",
    sortOrder: 24,
    pattern: {
      description: "会議費 / 事業主借",
      category: "expense_other",
      inputs: [
        { name: "amount", label: "金額", type: "amount" },
        { name: "counterparty", label: "店舗", type: "text" },
        { name: "memo", label: "目的・相手", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "509", formula: "amount", taxCategory: "standard_10" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
  {
    key: "entertainment",
    label: "接待交際費",
    sortOrder: 25,
    pattern: {
      description: "接待交際費 / 事業主借",
      category: "expense_other",
      inputs: [
        { name: "amount", label: "金額", type: "amount" },
        { name: "counterparty", label: "店舗", type: "text" },
        { name: "memo", label: "目的・相手", type: "text" },
      ],
      lines: [
        { side: "debit", accountCode: "508", formula: "amount", taxCategory: "standard_10" },
        { side: "credit", accountCode: "206", formula: "amount", taxCategory: "untaxed" },
      ],
    },
  },
];

const settings: { key: string; value: string }[] = [
  { key: "ratio_rent", value: "0.7" },
  { key: "ratio_telecom", value: "0.8" },
  { key: "ratio_utilities", value: "0.5" },
  {
    key: "business_profile",
    value: JSON.stringify({
      name: "",
      tradeName: "",
      address: "",
      taxOffice: "",
      fiscalYearStart: "01-01",
      fiscalYearEnd: "12-31",
    }),
  },
];

async function main() {
  for (const a of accounts) {
    await prisma.account.upsert({
      where: { code: a.code },
      create: a,
      update: a,
    });
  }

  const seedKeys = new Set(templates.map((t) => t.key));
  for (const t of templates) {
    await prisma.journalTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        label: t.label,
        sortOrder: t.sortOrder,
        pattern: JSON.stringify(t.pattern),
      },
      update: {
        label: t.label,
        sortOrder: t.sortOrder,
        pattern: JSON.stringify(t.pattern),
      },
    });
  }

  // seedに無いテンプレは削除（既存使用中はjournalEntry.templateKeyに残るが、参照は文字列なのでOK）
  const existing = await prisma.journalTemplate.findMany({
    select: { key: true },
  });
  const toDelete = existing.filter((e) => !seedKeys.has(e.key)).map((e) => e.key);
  if (toDelete.length > 0) {
    await prisma.journalTemplate.deleteMany({
      where: { key: { in: toDelete } },
    });
  }

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value },
    });
  }
  console.log(
    `Seeded: ${accounts.length} accounts, ${templates.length} templates (deleted ${toDelete.length}), ${settings.length} settings`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
