"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-slate-800 text-white rounded px-3 py-1 text-sm hover:bg-slate-900"
    >
      印刷 / PDF保存
    </button>
  );
}
