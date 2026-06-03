"use client";

import { useState, useTransition } from "react";

type Entry = { id: string; voucherNo: number; description: string };

export default function BulkVoidPanel({
  entries,
  action,
}: {
  entries: Entry[];
  action: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      selected.size === entries.length
        ? new Set()
        : new Set(entries.map((e) => e.id)),
    );

  const handleVoid = () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `選択した ${selected.size} 件を取消しますか？\n（物理削除ではなく void になります）`,
      )
    )
      return;
    const ids = [...selected];
    start(async () => {
      await action(ids);
      setSelected(new Set());
    });
  };

  return (
    <div className="bg-amber-50 border border-amber-300 rounded p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-amber-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected.size === entries.length && entries.length > 0}
            onChange={toggleAll}
            className="accent-amber-600"
          />
          全選択（{entries.length} 件）
        </label>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          onClick={handleVoid}
          className="text-sm bg-rose-600 text-white rounded px-3 py-1 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "処理中..." : `選択した ${selected.size} 件を取消`}
        </button>
      </div>
      <div className="divide-y divide-amber-200">
        {entries.map((e) => (
          <label
            key={e.id}
            className="flex items-center gap-2 text-sm py-1 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={selected.has(e.id)}
              onChange={() => toggle(e.id)}
              className="accent-amber-600"
            />
            <span className="text-slate-500 w-8">#{e.voucherNo}</span>
            <span>{e.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
