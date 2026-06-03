"use client";

import { useState } from "react";

export default function DisposeForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [showDate, setShowDate] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (!showDate) {
    return (
      <button
        onClick={() => setShowDate(true)}
        className="text-xs text-rose-600 hover:underline"
      >
        廃棄
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2 justify-end">
      <input
        type="date"
        name="disposalDate"
        defaultValue={today}
        className="border border-slate-300 rounded px-1 py-0.5 text-xs"
        required
      />
      <button
        type="submit"
        className="text-xs bg-rose-600 text-white rounded px-2 py-0.5 hover:bg-rose-700"
      >
        確定
      </button>
      <button
        type="button"
        onClick={() => setShowDate(false)}
        className="text-xs text-slate-700"
      >
        ×
      </button>
    </form>
  );
}
