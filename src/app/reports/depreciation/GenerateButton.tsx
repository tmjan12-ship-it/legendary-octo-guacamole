"use client";

import { useTransition } from "react";

export default function GenerateButton({
  year,
  action,
}: {
  year: number;
  action: () => Promise<{ created: number; skipped: number }>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            `${year}年度の減価償却仕訳を一括生成します。\n12月31日付で仕訳を作成します。よろしいですか？`,
          )
        )
          return;
        start(async () => {
          const r = await action();
          alert(`${r.created} 件を計上しました（スキップ: ${r.skipped} 件）`);
        });
      }}
      className="text-sm bg-amber-600 text-white rounded px-3 py-1.5 hover:bg-amber-700 disabled:bg-slate-300"
    >
      {pending ? "生成中..." : "期末仕訳を一括生成"}
    </button>
  );
}
