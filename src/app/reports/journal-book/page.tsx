import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFiscalYearRange, yen } from "@/lib/fiscal";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  year?: string;
  from?: string;
  to?: string;
}>;

export default async function JournalBookPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());
  const fy = await getFiscalYearRange(year);
  const start = sp.from ? new Date(sp.from + "T00:00:00") : fy.start;
  const end = sp.to ? new Date(sp.to + "T23:59:59") : fy.end;

  const entries = await prisma.journalEntry.findMany({
    where: {
      status: "active",
      entryDate: { gte: start, lte: end },
    },
    orderBy: [{ entryDate: "asc" }, { voucherNo: "asc" }],
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: "asc" },
      },
    },
  });

  const totalDebit = entries.reduce(
    (s, e) => s + e.lines.reduce((s2, l) => s2 + l.debitAmount, 0),
    0,
  );
  const totalCredit = entries.reduce(
    (s, e) => s + e.lines.reduce((s2, l) => s2 + l.creditAmount, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">仕訳帳</h1>
        <div className="text-sm text-slate-600">
          {format(start, "yyyy-MM-dd")} 〜 {format(end, "yyyy-MM-dd")}
        </div>
      </div>

      <form className="bg-white border border-slate-300 rounded p-4 flex gap-3 items-end text-sm">
        <label>
          <div className="text-xs text-slate-700 mb-1">年度</div>
          <input
            type="number"
            name="year"
            defaultValue={year}
            className="w-24 border border-slate-300 rounded px-2 py-1"
          />
        </label>
        <label>
          <div className="text-xs text-slate-700 mb-1">From（任意・年度に上書き）</div>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="border border-slate-300 rounded px-2 py-1"
          />
        </label>
        <label>
          <div className="text-xs text-slate-700 mb-1">To</div>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="border border-slate-300 rounded px-2 py-1"
          />
        </label>
        <button className="bg-slate-800 text-white rounded px-3 py-1.5 hover:bg-slate-900">
          表示
        </button>
        <Link
          href="/reports/journal-book"
          className="border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100"
        >
          クリア
        </Link>
      </form>

      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-28">日付</th>
              <th className="text-left px-3 py-2 w-14">No</th>
              <th className="text-left px-3 py-2 w-32">借方科目</th>
              <th className="text-left px-3 py-2 w-32">貸方科目</th>
              <th className="text-right px-3 py-2 w-28">借方金額</th>
              <th className="text-right px-3 py-2 w-28">貸方金額</th>
              <th className="text-left px-3 py-2">摘要</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-600 py-8">
                  仕訳がありません
                </td>
              </tr>
            ) : (
              entries.flatMap((e) =>
                e.lines.map((l, idx) => {
                  // 借方明細と貸方明細を1行にしたい場合もあるが、
                  // 複数借方・複数貸方ケース対応のため、行単位で出す
                  return (
                    <tr
                      key={l.id}
                      className="border-t border-slate-200 align-top"
                    >
                      <td className="px-3 py-1.5">
                        {idx === 0 ? format(e.entryDate, "yyyy-MM-dd") : ""}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {idx === 0 ? e.voucherNo : ""}
                      </td>
                      <td className="px-3 py-1.5">
                        {l.debitAmount > 0 ? l.account.name : ""}
                      </td>
                      <td className="px-3 py-1.5">
                        {l.creditAmount > 0 ? l.account.name : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {l.debitAmount > 0 ? yen(l.debitAmount) : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {l.creditAmount > 0 ? yen(l.creditAmount) : ""}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {idx === 0 ? e.description : ""}
                        {l.memo && (
                          <span className="text-slate-500 ml-2">{l.memo}</span>
                        )}
                        {l.counterparty && (
                          <span className="ml-2">[{l.counterparty}]</span>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-medium">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right">
                合計
              </td>
              <td className="px-3 py-2 text-right">{yen(totalDebit)}</td>
              <td className="px-3 py-2 text-right">{yen(totalCredit)}</td>
              <td className="px-3 py-2">
                {totalDebit === totalCredit ? (
                  <span className="text-emerald-700 text-xs">✓ 一致</span>
                ) : (
                  <span className="text-rose-700 text-xs">✗ 不一致</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
