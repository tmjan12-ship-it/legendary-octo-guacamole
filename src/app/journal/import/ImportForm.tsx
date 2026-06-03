"use client";

import { useState, useTransition } from "react";
import { parseCsv } from "@/lib/csv-parse";

type Template = { key: string; label: string };

type Row = {
  entryDate: string;
  templateKey: string;
  amount: number;
  description: string;
  counterparty?: string;
  memo?: string;
  _error?: string;
};

function isDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function ImportForm({
  templates,
  commitAction,
}: {
  templates: Template[];
  commitAction: (formData: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tmplSet = new Set(templates.map((t) => t.key));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) {
      setError("ヘッダー＋データ行が必要です");
      return;
    }
    const header = grid[0].map((h) => h.trim());
    const idx = {
      entryDate: header.indexOf("entryDate"),
      templateKey: header.indexOf("templateKey"),
      amount: header.indexOf("amount"),
      description: header.indexOf("description"),
      counterparty: header.indexOf("counterparty"),
      memo: header.indexOf("memo"),
    };
    if (
      idx.entryDate < 0 ||
      idx.templateKey < 0 ||
      idx.amount < 0 ||
      idx.description < 0
    ) {
      setError(
        "必須列 entryDate / templateKey / amount / description のいずれかが見つかりません",
      );
      return;
    }

    const out: Row[] = [];
    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      const row: Row = {
        entryDate: (r[idx.entryDate] ?? "").trim(),
        templateKey: (r[idx.templateKey] ?? "").trim(),
        amount: Number((r[idx.amount] ?? "").replace(/[,\s¥]/g, "")),
        description: (r[idx.description] ?? "").trim(),
        counterparty:
          idx.counterparty >= 0
            ? (r[idx.counterparty] ?? "").trim() || undefined
            : undefined,
        memo:
          idx.memo >= 0 ? (r[idx.memo] ?? "").trim() || undefined : undefined,
      };
      const errs: string[] = [];
      if (!isDate(row.entryDate)) errs.push("日付");
      if (!tmplSet.has(row.templateKey)) errs.push("テンプレ");
      if (!Number.isFinite(row.amount) || row.amount <= 0) errs.push("金額");
      if (!row.description) errs.push("摘要");
      if (errs.length) row._error = errs.join("/") + "に問題";
      out.push(row);
    }
    setRows(out);
  }

  const validCount = rows.filter((r) => !r._error).length;
  const errCount = rows.length - validCount;

  function onCommit() {
    if (validCount === 0) return;
    if (
      !confirm(
        `エラー行を除く ${validCount} 件を一括登録します。よろしいですか？`,
      )
    )
      return;
    const fd = new FormData();
    fd.append(
      "rows",
      JSON.stringify(rows.filter((r) => !r._error).map(({ _error, ...rest }) => rest)),
    );
    start(async () => {
      try {
        await commitAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "登録失敗");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-300 rounded p-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm"
        />
        {rows.length > 0 && (
          <div className="text-sm">
            <span className="text-emerald-700">有効 {validCount}件</span>
            {errCount > 0 && (
              <span className="text-rose-700 ml-3">エラー {errCount}件</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="bg-white border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-2 py-1 w-10">#</th>
                  <th className="text-left px-2 py-1 w-24">日付</th>
                  <th className="text-left px-2 py-1 w-40">テンプレ</th>
                  <th className="text-right px-2 py-1 w-24">金額</th>
                  <th className="text-left px-2 py-1">摘要</th>
                  <th className="text-left px-2 py-1 w-32">取引先</th>
                  <th className="text-left px-2 py-1 w-24">状態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-200 ${
                      r._error ? "bg-rose-50" : ""
                    }`}
                  >
                    <td className="px-2 py-1 text-slate-500">{i + 1}</td>
                    <td className="px-2 py-1">{r.entryDate}</td>
                    <td className="px-2 py-1">{r.templateKey}</td>
                    <td className="px-2 py-1 text-right">
                      {Number.isFinite(r.amount)
                        ? r.amount.toLocaleString("ja-JP")
                        : "-"}
                    </td>
                    <td className="px-2 py-1">{r.description}</td>
                    <td className="px-2 py-1 text-slate-600">
                      {r.counterparty ?? ""}
                    </td>
                    <td className="px-2 py-1">
                      {r._error ? (
                        <span className="text-rose-700">{r._error}</span>
                      ) : (
                        <span className="text-emerald-700">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={onCommit}
            disabled={validCount === 0 || pending}
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:bg-slate-300"
          >
            {pending ? "登録中..." : `${validCount}件を一括登録`}
          </button>
        </>
      )}
    </div>
  );
}
