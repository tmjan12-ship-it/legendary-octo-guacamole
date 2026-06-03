import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFiscalYearRange, yen } from "@/lib/fiscal";
import { innerTax, type TaxCategory } from "@/lib/templates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string }>;

export default async function MonthlyReport({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());
  const { start, end } = await getFiscalYearRange(year);

  const lines = await prisma.journalLine.findMany({
    where: {
      journal: {
        status: "active",
        entryDate: { gte: start, lte: end },
      },
    },
    include: {
      account: true,
      journal: { select: { entryDate: true } },
    },
  });

  const accounts = await prisma.account.findMany({
    where: {
      type: { in: ["revenue", "expense"] },
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  // month index = 0..11 (相対) — 会計年度の開始月から12ヶ月
  const startMonth = start.getMonth();
  function monthIndex(d: Date): number {
    const m = d.getMonth() + (d.getFullYear() - start.getFullYear()) * 12;
    return m - startMonth;
  }
  function monthLabel(idx: number): string {
    const m = (startMonth + idx) % 12;
    return `${m + 1}月`;
  }

  // matrix[accountCode][monthIndex] = signed amount
  const matrix: Record<string, number[]> = {};
  for (const a of accounts) {
    matrix[a.code] = Array(12).fill(0);
  }
  for (const l of lines) {
    const idx = monthIndex(l.journal.entryDate);
    if (idx < 0 || idx >= 12) continue;
    if (!matrix[l.accountCode]) continue;
    const type = l.account.type;
    if (type === "revenue") {
      matrix[l.accountCode][idx] += l.creditAmount - l.debitAmount;
    } else if (type === "expense") {
      matrix[l.accountCode][idx] += l.debitAmount - l.creditAmount;
    }
  }

  const revenueAccts = accounts.filter((a) => a.type === "revenue");
  const expenseAccts = accounts.filter((a) => a.type === "expense");

  const monthlyRevenue = Array(12).fill(0) as number[];
  const monthlyExpense = Array(12).fill(0) as number[];
  for (const a of revenueAccts) {
    for (let i = 0; i < 12; i++) monthlyRevenue[i] += matrix[a.code][i];
  }
  for (const a of expenseAccts) {
    for (let i = 0; i < 12; i++) monthlyExpense[i] += matrix[a.code][i];
  }
  const monthlyProfit = monthlyRevenue.map(
    (r, i) => r - monthlyExpense[i],
  );

  const totalRevenue = monthlyRevenue.reduce((s, v) => s + v, 0);
  const totalExpense = monthlyExpense.reduce((s, v) => s + v, 0);
  const totalProfit = totalRevenue - totalExpense;

  // 消費税相当額の集計（税区分付き明細のみ）
  type TaxBucket = { taxableAmount: number; taxAmount: number };
  const emptyBucket = (): TaxBucket => ({ taxableAmount: 0, taxAmount: 0 });
  const taxSummary: Record<
    "sales" | "purchase",
    Record<TaxCategory | "other", TaxBucket>
  > = {
    sales: {
      standard_10: emptyBucket(),
      reduced_8: emptyBucket(),
      non_taxable: emptyBucket(),
      untaxed: emptyBucket(),
      exempt: emptyBucket(),
      other: emptyBucket(),
    },
    purchase: {
      standard_10: emptyBucket(),
      reduced_8: emptyBucket(),
      non_taxable: emptyBucket(),
      untaxed: emptyBucket(),
      exempt: emptyBucket(),
      other: emptyBucket(),
    },
  };

  for (const l of lines) {
    const cat = (l.taxCategory ?? "other") as TaxCategory | "other";
    const type = l.account.type;
    if (type === "revenue") {
      // 収益（売上）= 貸方計上 → 課税売上
      const amt = l.creditAmount - l.debitAmount;
      if (amt === 0) continue;
      const bucket = taxSummary.sales[cat];
      bucket.taxableAmount += amt;
      bucket.taxAmount += innerTax(amt, l.taxCategory as TaxCategory);
    } else if (type === "expense") {
      // 費用（経費）= 借方計上 → 課税仕入
      const amt = l.debitAmount - l.creditAmount;
      if (amt === 0) continue;
      const bucket = taxSummary.purchase[cat];
      bucket.taxableAmount += amt;
      bucket.taxAmount += innerTax(amt, l.taxCategory as TaxCategory);
    }
  }

  const salesTaxTotal =
    taxSummary.sales.standard_10.taxAmount + taxSummary.sales.reduced_8.taxAmount;
  const purchaseTaxTotal =
    taxSummary.purchase.standard_10.taxAmount +
    taxSummary.purchase.reduced_8.taxAmount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          月次収支（{year}年度）
        </h1>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/reports/monthly?year=${year - 1}`}
            className="border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100 whitespace-nowrap"
          >
            ← {year - 1}
          </Link>
          <Link
            href={`/reports/monthly?year=${year + 1}`}
            className="border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100 whitespace-nowrap"
          >
            {year + 1} →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card label="売上 合計" value={yen(totalRevenue)} accent="text-blue-700" />
        <Card label="経費 合計" value={yen(totalExpense)} accent="text-rose-700" />
        <Card
          label="所得（売上−経費）"
          value={yen(totalProfit)}
          accent={totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"}
        />
      </div>

      <section className="bg-white border border-slate-300 rounded p-4 sm:p-5 space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-slate-900">消費税相当額（参考）</h2>
          <p className="text-xs text-slate-700">
            免税事業者のうちは納付不要。将来課税事業者になった場合の概算
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TaxTable
            title="課税売上（受取消費税）"
            buckets={taxSummary.sales}
            total={salesTaxTotal}
            accent="text-blue-700"
          />
          <TaxTable
            title="課税仕入（支払消費税）"
            buckets={taxSummary.purchase}
            total={purchaseTaxTotal}
            accent="text-rose-700"
          />
        </div>
        <div className="border-t border-slate-300 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
          <span className="text-slate-700">差引（課税事業者の場合の納付額目安）</span>
          <span
            className={`text-lg font-bold ${
              salesTaxTotal - purchaseTaxTotal >= 0
                ? "text-amber-700"
                : "text-slate-600"
            }`}
          >
            {yen(salesTaxTotal - purchaseTaxTotal)}
          </span>
        </div>
      </section>

      <div className="bg-white border border-slate-300 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-slate-100 w-40">
                勘定科目
              </th>
              {Array.from({ length: 12 }).map((_, i) => (
                <th key={i} className="text-right px-2 py-2 w-20">
                  {monthLabel(i)}
                </th>
              ))}
              <th className="text-right px-3 py-2 w-24">合計</th>
            </tr>
          </thead>
          <tbody>
            <SectionLabel label="売上" />
            {revenueAccts.map((a) => {
              const total = matrix[a.code].reduce((s, v) => s + v, 0);
              return (
                <Row key={a.code} name={a.name} values={matrix[a.code]} total={total} />
              );
            })}
            <SubTotal label="売上 計" values={monthlyRevenue} />

            <SectionLabel label="経費" />
            {expenseAccts.map((a) => {
              const total = matrix[a.code].reduce((s, v) => s + v, 0);
              return (
                <Row key={a.code} name={a.name} values={matrix[a.code]} total={total} />
              );
            })}
            <SubTotal label="経費 計" values={monthlyExpense} />

            <SubTotal label="所得" values={monthlyProfit} accent />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxTable({
  title,
  buckets,
  total,
  accent,
}: {
  title: string;
  buckets: Record<string, { taxableAmount: number; taxAmount: number }>;
  total: number;
  accent: string;
}) {
  const rows: { label: string; key: string }[] = [
    { label: "標準税率 10%", key: "standard_10" },
    { label: "軽減税率 8%", key: "reduced_8" },
    { label: "非課税", key: "non_taxable" },
    { label: "不課税", key: "untaxed" },
    { label: "未分類", key: "other" },
  ];
  return (
    <div className="border border-slate-300 rounded p-3 bg-white">
      <div className="font-semibold text-sm mb-2 text-slate-900">{title}</div>
      <table className="w-full text-xs">
        <thead className="text-slate-700">
          <tr className="border-b border-slate-300">
            <th className="text-left py-1 font-medium">区分</th>
            <th className="text-right py-1 font-medium">対象金額</th>
            <th className="text-right py-1 font-medium">内消費税</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {rows.map((r) => {
            const b = buckets[r.key];
            if (!b || (b.taxableAmount === 0 && b.taxAmount === 0)) return null;
            return (
              <tr key={r.key} className="border-t border-slate-200">
                <td className="py-1">{r.label}</td>
                <td className="text-right py-1">{yen(b.taxableAmount)}</td>
                <td className="text-right py-1">{yen(b.taxAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-slate-400 font-semibold">
          <tr>
            <td className="py-1.5 text-slate-800" colSpan={2}>
              消費税合計
            </td>
            <td className={`text-right py-1.5 ${accent}`}>{yen(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-slate-300 rounded p-4">
      <div className="text-xs text-slate-700 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <tr className="bg-slate-50">
      <td colSpan={14} className="px-3 py-1 text-xs font-semibold text-slate-600">
        {label}
      </td>
    </tr>
  );
}

function Row({
  name,
  values,
  total,
}: {
  name: string;
  values: number[];
  total: number;
}) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-1 sticky left-0 bg-white">{name}</td>
      {values.map((v, i) => (
        <td key={i} className="text-right px-2 py-1 text-slate-700">
          {v === 0 ? "" : yen(v)}
        </td>
      ))}
      <td className="text-right px-3 py-1 font-medium">{yen(total)}</td>
    </tr>
  );
}

function SubTotal({
  label,
  values,
  accent,
}: {
  label: string;
  values: number[];
  accent?: boolean;
}) {
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <tr
      className={`border-t-2 ${
        accent
          ? "border-slate-400 bg-amber-50 font-bold"
          : "border-slate-300 bg-slate-50 font-medium"
      }`}
    >
      <td className="px-3 py-1.5 sticky left-0 bg-inherit">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="text-right px-2 py-1.5">
          {v === 0 ? "" : yen(v)}
        </td>
      ))}
      <td className="text-right px-3 py-1.5">{yen(total)}</td>
    </tr>
  );
}
