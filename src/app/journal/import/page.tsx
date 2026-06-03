import { prisma } from "@/lib/prisma";
import ImportForm from "./ImportForm";
import { commitImport } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const templates = await prisma.journalTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仕訳の一括取込（CSV）</h1>
        <Link
          href="/journal"
          className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100"
        >
          ← 一覧へ
        </Link>
      </div>

      <details className="bg-white border border-slate-300 rounded p-4">
        <summary className="cursor-pointer font-semibold">CSVフォーマット</summary>
        <div className="mt-3 text-sm space-y-2">
          <p>
            1行目に以下のヘッダーを書いてください（順不同・余分な列は無視）：
          </p>
          <pre className="bg-slate-100 p-3 rounded text-xs overflow-x-auto">
{`entryDate,templateKey,amount,description,counterparty,memo
2026-05-15,sales_invoice,300000,◯◯社 5月分,◯◯株式会社,
2026-05-18,subscription,1500,Notion AI,Notion Labs,
2026-05-20,transport,320,渋谷→品川,, Suica`}
          </pre>
          <ul className="list-disc list-inside text-xs text-slate-700">
            <li><code>entryDate</code>: yyyy-MM-dd</li>
            <li><code>templateKey</code>: 下記のキーから選択</li>
            <li><code>amount</code>: 整数（円）</li>
            <li><code>description</code>: 摘要</li>
            <li><code>counterparty</code> / <code>memo</code>: 任意</li>
          </ul>
          <div className="text-xs">
            <strong>利用可能な templateKey:</strong>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-600">
              {templates.map((t) => (
                <li key={t.key}>
                  <code className="bg-slate-100 px-1 rounded">{t.key}</code> {t.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <ImportForm
        templates={templates.map((t) => ({ key: t.key, label: t.label }))}
        commitAction={commitImport}
      />
    </div>
  );
}
