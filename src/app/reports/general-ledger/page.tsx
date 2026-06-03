import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFiscalYearRange, yen } from "@/lib/fiscal";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  year?: string;
  account?: string;
}>;

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());
  const { start, end } = await getFiscalYearRange(year);

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const accountCode = sp.account ?? accounts[0]?.code ?? "";
  const account = accounts.find((a) => a.code === accountCode);

  // 期首残高（期首より前の累積）
  const before = await prisma.journalLine.aggregate({
    where: {
      accountCode,
      journal: { status: "active", entryDate: { lt: start } },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const openingBalance =
    (before._sum.debitAmount ?? 0) - (before._sum.creditAmount ?? 0);

  const lines = await prisma.journalLine.findMany({
    where: {
      accountCode,
      journal: { status: "active", entryDate: { gte: start, lte: end } },
    },
    include: {
      journal: true,
    },
    orderBy: [
      { journal: { entryDate: "asc" } },
      { journal: { voucherNo: "asc" } },
    ],
  });

  // 残高の累積計算（資産・費用は借方残、負債・純資産・収益は貸方残として表示するため、
  // 表示上は「借方−貸方」の累積をシンプルに出す）
  let running = openingBalance;
  const rows = lines.map((l) => {
    running += l.debitAmount - l.creditAmount;
    return {
      id: l.id,
      date: l.journal.entryDate,
      voucherNo: l.journal.voucherNo,
      description: l.journal.description,
      counterparty: l.counterparty,
      memo: l.memo,
      debit: l.debitAmount,
      credit: l.creditAmount,
      balance: running,
    };
  });

  const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">総勘定元帳</h1>

      <form className="bg-white border border-slate-300 rounded p-4 flex gap-3 items-end text-sm flex-wrap">
        <label>
          <div className="text-xs text-slate-700 mb-1">年度</div>
          <input
            type="number"
            name="year"
            defaultValue={year}
            className="w-24 border border-slate-300 rounded px-2 py-1"
          />
        </label>
        <label className="flex-1 min-w-48">
          <div className="text-xs text-slate-700 mb-1">勘定科目</div>
          <select
            name="account"
            defaultValue={accountCode}
            className="w-full border border-slate-300 rounded px-2 py-1"
          >
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </label>
        <button className="bg-slate-800 text-white rounded px-3 py-1.5 hover:bg-slate-900">
          表示
        </button>
      </form>

      {account && (
        <div className="grid grid-cols-4 gap-3 text-sm">
          <Stat label="期首残高" value={yen(openingBalance)} />
          <Stat label="期中借方合計" value={yen(totalDebit)} accent="text-blue-700" />
          <Stat label="期中貸方合計" value={yen(totalCredit)} accent="text-rose-700" />
          <Stat
            label="期末残高"
            value={yen(closingBalance)}
            accent="text-emerald-700 font-bold"
          />
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-28">日付</th>
              <th className="text-left px-3 py-2 w-14">No</th>
              <th className="text-left px-3 py-2">摘要</th>
              <th className="text-right px-3 py-2 w-28">借方</th>
              <th className="text-right px-3 py-2 w-28">貸方</th>
              <th className="text-right px-3 py-2 w-28">残高</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-300 bg-slate-50 italic">
              <td colSpan={5} className="px-3 py-1.5 text-right text-slate-600">
                期首繰越
              </td>
              <td className="px-3 py-1.5 text-right">{yen(openingBalance)}</td>
            </tr>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-600 py-8">
                  この期間に該当する取引がありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="px-3 py-1.5">
                    {format(r.date, "yyyy-MM-dd")}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{r.voucherNo}</td>
                  <td className="px-3 py-1.5 text-slate-700">
                    {r.description}
                    {r.counterparty && (
                      <span className="ml-2 text-slate-500">
                        [{r.counterparty}]
                      </span>
                    )}
                    {r.memo && (
                      <span className="ml-2 text-slate-500">{r.memo}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {r.debit > 0 ? yen(r.debit) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {r.credit > 0 ? yen(r.credit) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">{yen(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-700">
        ※ 残高欄は「借方−貸方」の累積です。資産・費用は正の値、負債・純資産・収益は負の値で表示されます。
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-slate-300 rounded p-3">
      <div className="text-xs text-slate-700">{label}</div>
      <div className={`text-lg mt-0.5 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
