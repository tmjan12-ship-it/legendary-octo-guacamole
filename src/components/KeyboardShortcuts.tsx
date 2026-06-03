"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Shortcut = {
  key: string; // 単発 "n" or 連続 "g j"
  label: string;
  action: (router: ReturnType<typeof useRouter>) => void;
};

const SHORTCUTS: Shortcut[] = [
  { key: "n", label: "仕訳を新規作成", action: (r) => r.push("/journal/new") },
  { key: "g d", label: "ダッシュボード", action: (r) => r.push("/") },
  { key: "g j", label: "仕訳一覧", action: (r) => r.push("/journal") },
  { key: "g a", label: "固定資産", action: (r) => r.push("/assets") },
  { key: "g m", label: "月次レポート", action: (r) => r.push("/reports/monthly") },
  { key: "g b", label: "仕訳帳", action: (r) => r.push("/reports/journal-book") },
  {
    key: "g l",
    label: "総勘定元帳",
    action: (r) => r.push("/reports/general-ledger"),
  },
  { key: "g f", label: "決算書", action: (r) => r.push("/reports/final") },
  { key: "g e", label: "e-Tax", action: (r) => r.push("/reports/etax") },
  {
    key: "g p",
    label: "減価償却",
    action: (r) => r.push("/reports/depreciation"),
  },
  { key: "g s", label: "設定", action: (r) => r.push("/settings") },
];

const SEQ_PREFIX = "g";
const SEQ_TIMEOUT_MS = 1000;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [seqActive, setSeqActive] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      const key = e.key;

      if (showHelp && key === "Escape") {
        e.preventDefault();
        setShowHelp(false);
        return;
      }

      if (!seqActive) {
        if (key === "?") {
          e.preventDefault();
          setShowHelp((v) => !v);
          return;
        }
        if (key === SEQ_PREFIX) {
          e.preventDefault();
          setSeqActive(true);
          setTimeout(() => setSeqActive(false), SEQ_TIMEOUT_MS);
          return;
        }
        const single = SHORTCUTS.find((s) => s.key === key);
        if (single) {
          e.preventDefault();
          single.action(router);
          return;
        }
      } else {
        // 連続キー "g X"
        const combo = `${SEQ_PREFIX} ${key}`;
        const match = SHORTCUTS.find((s) => s.key === combo);
        if (match) {
          e.preventDefault();
          match.action(router);
        }
        setSeqActive(false);
      }
    },
    [router, seqActive, showHelp],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <>
      {seqActive && (
        <div className="fixed bottom-4 left-4 bg-slate-800 text-white rounded px-3 py-1 text-xs shadow z-40">
          g …（次のキーを入力 / ?でヘルプ）
        </div>
      )}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">キーボードショートカット</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-600 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {SHORTCUTS.map((s) => (
                  <tr key={s.key} className="border-t border-slate-200">
                    <td className="py-1.5 w-24">
                      <kbd className="font-mono bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs">
                        {s.key}
                      </kbd>
                    </td>
                    <td className="py-1.5 text-slate-700">{s.label}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td className="py-1.5">
                    <kbd className="font-mono bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs">
                      ?
                    </kbd>
                  </td>
                  <td className="py-1.5 text-slate-700">
                    このヘルプを開く / 閉じる
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="text-xs text-slate-700 mt-4">
              ※ 入力フィールドにフォーカスがあるときは無効。`g` を押すと連続入力モード（1秒以内に次のキー）
            </div>
          </div>
        </div>
      )}
    </>
  );
}
