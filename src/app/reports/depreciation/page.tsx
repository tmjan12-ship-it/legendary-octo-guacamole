import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/fiscal";
import { calculateYearlySchedule } from "@/lib/depreciation";
import { format } from "date-fns";
import GenerateButton from "./GenerateButton";
import ReverseButton from "./ReverseButton";
import { generateDepreciationJournals, reverseDepreciation } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string }>;

export default async function DepreciationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());

  const assets = await prisma.fixedAsset.findMany({
    include: { depreciations: { where: { fiscalYear: year } } },
    orderBy: { acquisitionDate: "asc" },
  });

  const rows = assets.map((a) => {
    const schedule = calculateYearlySchedule({
      acquisitionDate: a.acquisitionDate,
      acquisitionCost: a.acquisitionCost,
      usefulLifeYears: a.usefulLifeYears,
      businessUseRatio: a.businessUseRatio,
      isDisposed: a.isDisposed,
      disposalDate: a.disposalDate,
    });
    const target = schedule.find((s) => s.fiscalYear === year);
    const generated = a.depreciations[0] ?? null;
    return { asset: a, target, generated };
  });

  const totalBusinessAmount = rows.reduce(
    (s, r) => s + (r.target?.businessAmount ?? 0),
    0,
  );
  const pendingCount = rows.filter(
    (r) => r.target && r.target.businessAmount > 0 && !r.generated,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">減価償却（{year}年度）</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/reports/depreciation?year=${year - 1}`}
            className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-100"
          >
            ← {year - 1}
          </Link>
          <Link
            href={`/reports/depreciation?year=${year + 1}`}
            className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-100"
          >
            {year + 1} →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="登録資産数" value={`${assets.length} 件`} />
        <Stat
          label={`${year}年度 償却額合計`}
          value={yen(totalBusinessAmount)}
          accent="text-blue-700"
        />
        <Stat
          label="未計上"
          value={`${pendingCount} 件`}
          accent={pendingCount > 0 ? "text-amber-700" : "text-emerald-700"}
        />
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 flex items-center justify-between">
          <div className="text-sm text-amber-900">
            {pendingCount} 件の資産で {year}年度の減価償却仕訳が未計上です。「期末仕訳を一括生成」で
            12月31日付の仕訳が自動作成されます。
          </div>
          <GenerateButton
            year={year}
            action={generateDepreciationJournals.bind(null, year)}
          />
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">資産名</th>
              <th className="text-left px-3 py-2 w-28">取得日</th>
              <th className="text-right px-3 py-2 w-28">取得価額</th>
              <th className="text-center px-3 py-2 w-14">耐用</th>
              <th className="text-right px-3 py-2 w-16">月数</th>
              <th className="text-right px-3 py-2 w-28">当年償却額</th>
              <th className="text-center px-3 py-2 w-32">状態</th>
              <th className="text-right px-3 py-2 w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-slate-600 py-8">
                  固定資産がまだありません。
                  <Link
                    href="/assets/new"
                    className="text-blue-600 hover:underline ml-1"
                  >
                    登録する
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map(({ asset: a, target, generated }) => (
                <tr key={a.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <Link
                      href={`/assets/${a.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {format(a.acquisitionDate, "yyyy-MM-dd")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {yen(a.acquisitionCost)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {a.usefulLifeYears}年
                  </td>
                  <td className="px-3 py-2 text-right">
                    {target?.monthsInYear ?? 0}/12
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {target ? yen(target.businessAmount) : "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {generated ? (
                      <Link
                        href={`/journal/${generated.journalId}`}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        計上済 → 仕訳
                      </Link>
                    ) : target && target.businessAmount > 0 ? (
                      <span className="text-xs text-amber-700">未計上</span>
                    ) : (
                      <span className="text-xs text-slate-500">対象外</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {generated && (
                      <ReverseButton
                        action={reverseDepreciation.bind(null, a.id, year)}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-700">
        ※ 仕訳は「減価償却費 / 減価償却累計額」で12月31日付で計上されます。事業按分後の金額です。再計算したい場合は「取消」してから一括生成してください。
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
