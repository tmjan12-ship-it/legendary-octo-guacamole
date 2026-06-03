import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/fiscal";
import { calculateYearlySchedule } from "@/lib/depreciation";
import { format } from "date-fns";
import DisposeForm from "./DisposeForm";
import { disposeAsset, undisposeAsset } from "./actions";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const assets = await prisma.fixedAsset.findMany({
    orderBy: { acquisitionDate: "desc" },
    include: { depreciations: true },
  });

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">固定資産</h1>
        <Link
          href="/assets/new"
          className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
        >
          + 固定資産を登録
        </Link>
      </div>

      <div className="text-sm text-slate-600">
        10万円以上の備品・PCなどを登録すると、減価償却費が自動計算されます。期末処理で
        <Link
          href={`/reports/depreciation?year=${currentYear}`}
          className="text-blue-600 hover:underline mx-1"
        >
          年度別の減価償却スケジュール
        </Link>
        を確認し、ボタン1つで仕訳を生成できます。
      </div>

      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">名称</th>
              <th className="text-left px-3 py-2 w-28">取得日</th>
              <th className="text-right px-3 py-2 w-28">取得価額</th>
              <th className="text-center px-3 py-2 w-16">耐用年数</th>
              <th className="text-right px-3 py-2 w-20">事業按分</th>
              <th className="text-right px-3 py-2 w-28">{currentYear}年 償却額</th>
              <th className="text-center px-3 py-2 w-24">状態</th>
              <th className="text-right px-3 py-2 w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-slate-600 py-8">
                  まだ固定資産がありません
                </td>
              </tr>
            ) : (
              assets.map((a) => {
                const schedule = calculateYearlySchedule({
                  acquisitionDate: a.acquisitionDate,
                  acquisitionCost: a.acquisitionCost,
                  usefulLifeYears: a.usefulLifeYears,
                  businessUseRatio: a.businessUseRatio,
                  isDisposed: a.isDisposed,
                  disposalDate: a.disposalDate,
                });
                const thisYear = schedule.find(
                  (s) => s.fiscalYear === currentYear,
                );
                return (
                  <tr key={a.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      <Link
                        href={`/assets/${a.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                      {a.notes && (
                        <div className="text-xs text-slate-700">{a.notes}</div>
                      )}
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
                      {(a.businessUseRatio * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {thisYear ? yen(thisYear.businessAmount) : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.isDisposed ? (
                        <span className="text-xs text-rose-700">
                          廃棄
                          {a.disposalDate && (
                            <div className="text-slate-500">
                              {format(a.disposalDate, "yyyy-MM-dd")}
                            </div>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700">使用中</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.isDisposed ? (
                        <form action={undisposeAsset.bind(null, a.id)}>
                          <button className="text-xs text-slate-700 hover:underline">
                            廃棄取消
                          </button>
                        </form>
                      ) : (
                        <DisposeForm action={disposeAsset.bind(null, a.id)} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
