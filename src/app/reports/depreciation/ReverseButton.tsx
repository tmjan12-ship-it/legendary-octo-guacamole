"use client";

import { useTransition } from "react";

export default function ReverseButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "この資産の減価償却計上を取消します。\n仕訳はvoid化され、訂正履歴に記録されます。よろしいですか？",
          )
        )
          return;
        start(async () => {
          await action();
        });
      }}
      className="text-xs text-rose-600 hover:underline disabled:text-slate-500"
    >
      {pending ? "..." : "取消"}
    </button>
  );
}
