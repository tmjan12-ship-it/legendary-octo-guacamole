import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import VoidButton from "./VoidButton";
import { voidJournal, voidManyJournals } from "./actions";
import SearchForm from "./SearchForm";
import BulkVoidPanel from "./BulkVoidPanel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  q?: string;
  counterparty?: string;
  amount?: string;
  showVoid?: string;
  highlight?: string;
  bulkVoid?: string;
}>;

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default async function JournalListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const where: Parameters<typeof prisma.journalEntry.findMany>[0] = {
    where: {},
  };
  // narrow `where` type for cleaner mutation
  const filter = where.where!;
  if (sp.showVoid !== "1") filter.status = "active";
  if (sp.from || sp.to) {
    filter.entryDate = {
      ...(sp.from ? { gte: new Date(sp.from + "T00:00:00") } : {}),
      ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}),
    };
  }
  if (sp.q) filter.description = { contains: sp.q };
  if (sp.counterparty) {
    filter.lines = {
      some: { counterparty: { contains: sp.counterparty } },
    };
  }
  if (sp.amount) {
    const amt = Number(sp.amount);
    if (Number.isFinite(amt) && amt > 0) {
      filter.lines = {
        ...(filter.lines ?? {}),
        some: {
          ...(filter.lines && "some" in filter.lines ? filter.lines.some : {}),
          OR: [{ debitAmount: amt }, { creditAmount: amt }],
        },
      };
    }
  }

  const entries = await prisma.journalEntry.findMany({
    where: filter,
    orderBy: [{ entryDate: "desc" }, { voucherNo: "desc" }],
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: "asc" },
      },
    },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仕訳一覧</h1>
        <div className="flex gap-2">
          <Link
            href={sp.bulkVoid === "1" ? "/journal" : "/journal?bulkVoid=1"}
            className={`text-sm border rounded px-3 py-1.5 ${
              sp.bulkVoid === "1"
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            一括取消
          </Link>
          <Link
            href="/journal/new"
            className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
          >
            + 仕訳を追加
          </Link>
        </div>
      </div>

      <SearchForm />

      {sp.bulkVoid === "1" && entries.filter((e) => e.status === "active").length > 0 && (
        <BulkVoidPanel
          entries={entries
            .filter((e) => e.status === "active")
            .map((e) => ({ id: e.id, voucherNo: e.voucherNo, description: e.description }))}
          action={voidManyJournals}
        />
      )}

      {/* スマホ: カード表示 */}
      <div className="lg:hidden space-y-2">
        {entries.length === 0 ? (
          <div className="text-center text-slate-600 py-8 bg-white border border-slate-300 rounded">
            該当する仕訳がありません
          </div>
        ) : (
          entries.map((j) => {
            const debitTotal = j.lines.reduce((s, l) => s + l.debitAmount, 0);
            const isHighlight = sp.highlight === j.id;
            return (
              <div
                key={j.id}
                className={`bg-white border rounded p-3 ${
                  isHighlight ? "border-amber-300 bg-amber-50" : "border-slate-300"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/journal/${j.id}`}
                    className="font-medium hover:underline truncate"
                  >
                    {j.description}
                  </Link>
                  <span className="text-right font-bold whitespace-nowrap">
                    {yen(debitTotal)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-700">
                  <span>{format(j.entryDate, "yyyy-MM-dd")}</span>
                  <span>#{j.voucherNo}</span>
                  {j.status === "active" ? (
                    <span className="text-emerald-700">有効</span>
                  ) : (
                    <span className="text-rose-700">取消</span>
                  )}
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-slate-700">
                  {j.lines.map((l) => (
                    <div key={l.id} className="flex gap-2">
                      <span
                        className={`w-6 ${
                          l.debitAmount > 0
                            ? "text-blue-700"
                            : "text-rose-700"
                        }`}
                      >
                        {l.debitAmount > 0 ? "借" : "貸"}
                      </span>
                      <span className="flex-1 truncate">{l.account.name}</span>
                      <span className="whitespace-nowrap">
                        {yen(
                          l.debitAmount > 0 ? l.debitAmount : l.creditAmount,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {j.status === "active" && (
                  <div className="mt-2 flex justify-end">
                    <VoidButton id={j.id} action={voidJournal} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* PC: テーブル表示 */}
      <div className="hidden lg:block bg-white border border-slate-300 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-28">日付</th>
              <th className="text-left px-3 py-2 w-14">No</th>
              <th className="text-left px-3 py-2">摘要 / 仕訳</th>
              <th className="text-right px-3 py-2 w-32">金額</th>
              <th className="text-center px-3 py-2 w-24">状態</th>
              <th className="text-right px-3 py-2 w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-600 py-8">
                  該当する仕訳がありません
                </td>
              </tr>
            ) : (
              entries.map((j) => {
                const debitTotal = j.lines.reduce(
                  (s, l) => s + l.debitAmount,
                  0,
                );
                const isHighlight = sp.highlight === j.id;
                return (
                  <tr
                    key={j.id}
                    className={`border-t border-slate-200 ${
                      isHighlight ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-3 py-3 align-top">
                      {format(j.entryDate, "yyyy-MM-dd")}
                    </td>
                    <td className="px-3 py-3 align-top text-slate-600">
                      {j.voucherNo}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Link
                        href={`/journal/${j.id}`}
                        className="font-medium hover:underline"
                      >
                        {j.description}
                      </Link>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-700">
                        {j.lines.map((l) => (
                          <div key={l.id} className="flex gap-3">
                            <span className="w-8 text-slate-500">
                              {l.debitAmount > 0 ? "借" : "貸"}
                            </span>
                            <span className="w-28">{l.account.name}</span>
                            <span className="w-24 text-right">
                              {yen(
                                l.debitAmount > 0
                                  ? l.debitAmount
                                  : l.creditAmount,
                              )}
                            </span>
                            {l.counterparty && (
                              <span className="text-slate-600">
                                {l.counterparty}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-right font-medium">
                      {yen(debitTotal)}
                    </td>
                    <td className="px-3 py-3 align-top text-center">
                      {j.status === "active" ? (
                        <span className="text-xs text-emerald-700">有効</span>
                      ) : (
                        <span className="text-xs text-rose-700">取消</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      {j.status === "active" && (
                        <VoidButton id={j.id} action={voidJournal} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-700">
        ※ 電子帳簿保存法の要件により、仕訳の物理削除は行いません（取消＝void状態）。全変更は訂正履歴に記録されています。
      </div>
    </div>
  );
}
