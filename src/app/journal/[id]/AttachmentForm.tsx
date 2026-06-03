"use client";

import { useRef, useState, useTransition } from "react";

export default function AttachmentForm({
  action,
}: {
  journalId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await action(fd);
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "アップロード失敗");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* カメラ撮影ボタン（モバイル用） */}
        <label className="flex-1 cursor-pointer">
          <input
            type="file"
            name="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                e.target.form?.requestSubmit();
              }
            }}
          />
          <span className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 active:bg-blue-50">
            📷 カメラで撮影
          </span>
        </label>

        {/* カメラロール・ファイル選択 */}
        <label className="flex-1 cursor-pointer">
          <input
            type="file"
            name="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                e.target.form?.requestSubmit();
              }
            }}
          />
          <span className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 active:bg-blue-50">
            🖼️ カメラロールから選択
          </span>
        </label>
      </div>

      {pending && (
        <p className="text-sm text-slate-500 text-center">アップロード中...</p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
