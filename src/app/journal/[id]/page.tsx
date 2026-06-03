import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/fiscal";
import { format } from "date-fns";
import AttachmentForm from "./AttachmentForm";
import { uploadAttachment, deleteAttachment } from "./actions";
import { notFound } from "next/navigation";
import { diffEntries } from "@/lib/audit-diff";
import { innerTax, TAX_CATEGORY_LABEL, type TaxCategory } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: { include: { account: true }, orderBy: { lineOrder: "asc" } },
      attachments: { orderBy: { uploadedAt: "desc" } },
      audits: { orderBy: { changedAt: "desc" } },
    },
  });

  if (!entry) notFound();

  const debitTotal = entry.lines.reduce((s, l) => s + l.debitAmount, 0);
  const creditTotal = entry.lines.reduce((s, l) => s + l.creditAmount, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          仕訳 #{entry.voucherNo}
          {entry.status === "void" && (
            <span className="ml-3 text-sm bg-rose-100 text-rose-700 rounded px-2 py-0.5">
              取消済み
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          {entry.status === "active" && (
            <Link
              href={`/journal/${entry.id}/edit`}
              className="text-sm bg-amber-600 text-white rounded px-3 py-1.5 hover:bg-amber-700"
            >
              編集
            </Link>
          )}
          <Link
            href="/journal"
            className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100"
          >
            ← 一覧へ
          </Link>
        </div>
      </div>

      <section className="bg-white border border-slate-300 rounded p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-700">取引日</div>
            <div>{format(entry.entryDate, "yyyy-MM-dd")}</div>
          </div>
          <div>
            <div className="text-xs text-slate-700">摘要</div>
            <div>{entry.description}</div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full text-xs sm:text-sm mt-3 min-w-[640px]">
          <thead className="text-slate-600">
            <tr>
              <th className="text-left py-1 w-12">区分</th>
              <th className="text-left py-1">勘定科目</th>
              <th className="text-left py-1">取引先</th>
              <th className="text-left py-1">メモ</th>
              <th className="text-right py-1 w-20">金額</th>
              <th className="text-left py-1 w-16">税区分</th>
              <th className="text-right py-1 w-20">内消費税</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((l) => {
              const amount = l.debitAmount > 0 ? l.debitAmount : l.creditAmount;
              const tax = innerTax(amount, l.taxCategory as TaxCategory | null);
              return (
                <tr key={l.id} className="border-t border-slate-200">
                  <td className="py-1">
                    {l.debitAmount > 0 ? "借方" : "貸方"}
                  </td>
                  <td className="py-1">{l.account.name}</td>
                  <td className="py-1 text-slate-600">{l.counterparty ?? ""}</td>
                  <td className="py-1 text-slate-600">{l.memo ?? ""}</td>
                  <td className="py-1 text-right">{yen(amount)}</td>
                  <td className="py-1 text-xs">
                    {l.taxCategory
                      ? TAX_CATEGORY_LABEL[l.taxCategory as TaxCategory]
                      : ""}
                  </td>
                  <td className="py-1 text-right text-slate-600">
                    {tax > 0 ? yen(tax) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-medium border-t-2 border-slate-300">
            <tr>
              <td colSpan={4} className="py-1.5 text-right">
                借方/貸方 合計
              </td>
              <td className="py-1.5 text-right">
                {yen(debitTotal)} / {yen(creditTotal)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </section>

      <section className="bg-white border border-slate-300 rounded p-5 space-y-3">
        <h2 className="font-semibold">領収書・証憑（電子帳簿保存法対応）</h2>
        {entry.attachments.length === 0 ? (
          <div className="text-sm text-slate-600">まだ添付ファイルがありません</div>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {entry.attachments.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">{a.filename}</div>
                  <div className="text-xs text-slate-700 font-mono">
                    SHA-256: {a.fileHash.slice(0, 16)}…
                    <span className="ml-2">
                      {format(a.uploadedAt, "yyyy-MM-dd HH:mm")}
                    </span>
                  </div>
                </div>
                <DetachButton
                  attachmentId={a.id}
                  journalId={entry.id}
                  action={deleteAttachment}
                />
              </li>
            ))}
          </ul>
        )}
        <AttachmentForm
          journalId={entry.id}
          action={uploadAttachment.bind(null, entry.id)}
        />
        <div className="text-xs text-slate-700">
          ※ 添付すると SHA-256 ハッシュを記録し、改ざん検知の根拠とします。リンクを外しても物理ファイルは
          <code>./data/attachments/</code> に残り続けます。
        </div>
      </section>

      <section className="bg-white border border-slate-300 rounded p-5 space-y-3">
        <h2 className="font-semibold">訂正履歴（AuditLog）</h2>
        <p className="text-xs text-slate-700">
          電子帳簿保存法の真実性確保要件のため、本仕訳に対するすべての変更がここに記録されます。
        </p>
        <table className="w-full text-sm">
          <thead className="text-slate-600">
            <tr>
              <th className="text-left py-1 w-44">日時</th>
              <th className="text-left py-1 w-24">操作</th>
              <th className="text-left py-1">変更内容</th>
            </tr>
          </thead>
          <tbody>
            {entry.audits.map((a) => {
              const diffs = diffEntries(a.beforeJson, a.afterJson);
              return (
                <tr key={a.id} className="border-t border-slate-200 align-top">
                  <td className="py-2 text-xs">
                    {format(a.changedAt, "yyyy-MM-dd HH:mm:ss")}
                  </td>
                  <td className="py-2">
                    <ActionBadge action={a.action} />
                  </td>
                  <td className="py-2 text-xs">
                    {a.action === "create" && (
                      <span className="text-slate-600">新規作成</span>
                    )}
                    {a.action === "attach" && a.afterJson && (
                      <AttachLog json={a.afterJson} />
                    )}
                    {a.action === "detach" && a.beforeJson && (
                      <DetachLog json={a.beforeJson} />
                    )}
                    {(a.action === "update" || a.action === "void") &&
                      diffs.length > 0 && (
                        <div className="space-y-1.5">
                          {diffs.map((d, i) => (
                            <div key={i}>
                              <div className="text-slate-600">{d.label}</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-rose-50 border border-rose-100 rounded px-2 py-1 whitespace-pre-line">
                                  {d.before ?? <span className="text-slate-500">なし</span>}
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1 whitespace-pre-line">
                                  {d.after ?? <span className="text-slate-500">なし</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    {(a.action === "update" || a.action === "void") &&
                      diffs.length === 0 && (
                        <span className="text-slate-500">差分なし</span>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AttachLog({ json }: { json: string }) {
  try {
    const o = JSON.parse(json) as { filename?: string; hash?: string; size?: number };
    return (
      <div className="text-slate-600">
        <div>{o.filename}</div>
        <div className="text-slate-500 font-mono text-[10px]">
          SHA-256: {o.hash?.slice(0, 16)}… / {o.size?.toLocaleString()} bytes
        </div>
      </div>
    );
  } catch {
    return <span className="text-slate-500">添付情報パース失敗</span>;
  }
}

function DetachLog({ json }: { json: string }) {
  try {
    const o = JSON.parse(json) as { filename?: string };
    return <div className="text-slate-600">{o.filename}（リンク解除）</div>;
  } catch {
    return <span className="text-slate-500">添付情報パース失敗</span>;
  }
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-700",
    update: "bg-amber-100 text-amber-700",
    void: "bg-rose-100 text-rose-700",
    attach: "bg-blue-100 text-blue-700",
    detach: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`text-xs rounded px-2 py-0.5 ${
        colors[action] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {action}
    </span>
  );
}

function DetachButton({
  attachmentId,
  journalId,
  action,
}: {
  attachmentId: string;
  journalId: string;
  action: (id: string, journalId: string) => Promise<void>;
}) {
  return (
    <form action={action.bind(null, attachmentId, journalId)}>
      <button
        type="submit"
        className="text-xs text-rose-600 hover:underline"
      >
        リンク解除
      </button>
    </form>
  );
}
