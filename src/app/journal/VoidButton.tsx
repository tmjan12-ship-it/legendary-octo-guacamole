"use client";

import { useTransition } from "react";

export default function VoidButton({
  id,
  action,
}: {
  id: string;
  action: (id: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この仕訳を取消（void）しますか？\n物理削除はされず、訂正履歴に記録されます。")) return;
        start(async () => {
          await action(id);
        });
      }}
      className="text-xs text-rose-600 hover:underline disabled:text-slate-500"
    >
      {pending ? "..." : "取消"}
    </button>
  );
}
