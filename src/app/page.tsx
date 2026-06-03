import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, format } from "date-fns";
import MonthlyChart from "@/components/MonthlyChart";
import { getFiscalYearRange } from "@/lib/fiscal";

export const dynamic = "force-dynamic";

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default async function Dashboard() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const linesThisMonth = await prisma.journalLine.findMany({
    where: {
      journal: {
        status: "active",
        entryDate: { gte: monthStart, lte: monthEnd },
      },
    },
    include: { account: true, journal: true },
  });

  const sales = linesThisMonth
    .filter((l) => l.account.type === "revenue")
    .reduce((s, l) => s + l.creditAmount - l.debitAmount, 0);

  const expense = linesThisMonth
    .filter((l) => l.account.type === "expense")
    .reduce((s, l) => s + l.debitAmount - l.creditAmount, 0);

  const receivables = await prisma.journalLine.findMany({
    where: {
      accountCode: "103",
      journal: { status: "active" },
    },
    include: { journal: true },
  });
  const receivableBalance = receivables.reduce(
    (s, l) => s + l.debitAmount - l.creditAmount,
    0,
  );

  // 年度内の月別収支
  const fy = await getFiscalYearRange(now.getFullYear());
  const fyLines = await prisma.journalLine.findMany({
    where: {
      journal: {
        status: "active",
        entryDate: { gte: fy.start, lte: fy.end },
      },
    },
    include: { account: true, journal: true },
  });
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}月`,
    revenue: 0,
    expense: 0,
    profit: 0,
  }));
  for (const l of fyLines) {
    const m = l.journal.entryDate.getMonth();
    if (l.account.type === "revenue") {
      monthlyData[m].revenue += l.creditAmount - l.debitAmount;
    } else if (l.account.type === "expense") {
      monthlyData[m].expense += l.debitAmount - l.creditAmount;
    }
  }
  for (const d of monthlyData) {
    d.profit = d.revenue - d.expense;
  }

  const recent = await prisma.journalEntry.findMany({
    where: { status: "active" },
    orderBy: { entryDate: "desc" },
    take: 10,
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: "asc" },
      },
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">
        ダッシュボード（{format(now, "yyyy年M月")}）
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          label="今月の売上"
          value={yen(sales)}
          accent="text-blue-700"
          href={`/reports/general-ledger?year=${now.getFullYear()}&account=401`}
          hint="売上高の総勘定元帳へ"
        />
        <Card
          label="今月の経費"
          value={yen(expense)}
          accent="text-rose-700"
          href={`/reports/monthly?year=${now.getFullYear()}`}
          hint="科目別の月次内訳へ"
        />
        <Card
          label="売掛金 残高"
          value={yen(receivableBalance)}
          accent="text-amber-700"
          href={`/reports/general-ledger?year=${now.getFullYear()}&account=103`}
          hint="売掛金の元帳へ"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          月別 収支推移（{now.getFullYear()}年度）
        </h2>
        <div className="bg-white border border-slate-300 rounded p-4">
          <MonthlyChart data={monthlyData} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近の仕訳</h2>
          <div className="flex gap-3">
            <Link
              href="/journal/new"
              className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
            >
              + 仕訳を追加
            </Link>
            <Link
              href="/journal"
              className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100"
            >
              一覧へ
            </Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="text-slate-600 text-sm bg-white border border-slate-300 rounded p-6 text-center">
            まだ仕訳が登録されていません。「+ 仕訳を追加」から始めましょう。
          </div>
        ) : (
          <div className="bg-white border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 w-28">日付</th>
                  <th className="text-left px-3 py-2 w-16">No</th>
                  <th className="text-left px-3 py-2">摘要</th>
                  <th className="text-right px-3 py-2 w-32">借方合計</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((j) => {
                  const total = j.lines.reduce((s, l) => s + l.debitAmount, 0);
                  return (
                    <tr key={j.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        {format(j.entryDate, "yyyy-MM-dd")}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{j.voucherNo}</td>
                      <td className="px-3 py-2">{j.description}</td>
                      <td className="px-3 py-2 text-right">{yen(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
  href,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <div className="text-xs text-slate-700 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      {hint && (
        <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
          {hint}
          <span aria-hidden>→</span>
        </div>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block bg-white border border-slate-300 rounded p-4 hover:border-slate-400 hover:bg-slate-50 transition"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="bg-white border border-slate-300 rounded p-4">{inner}</div>
  );
}
