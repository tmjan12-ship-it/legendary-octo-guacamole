import { prisma } from "@/lib/prisma";
import { parsePattern } from "@/lib/templates";
import JournalForm from "../../new/JournalForm";
import { updateJournal } from "./actions";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [entry, templates, accounts, settings] = await Promise.all([
    prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { orderBy: { lineOrder: "asc" } } },
    }),
    prisma.journalTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.setting.findMany({
      where: { key: { startsWith: "ratio_" } },
    }),
  ]);

  if (!entry) notFound();

  // テンプレ無し or テンプレ削除済みの場合、編集はサポート外
  const template = entry.templateKey
    ? templates.find((t) => t.key === entry.templateKey)
    : null;
  if (!template) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">この仕訳は直接編集できません</h1>
        <p className="text-sm text-slate-600">
          テンプレートを使用せず作成された仕訳、またはテンプレートが削除された仕訳は、
          UIからの直接編集に対応していません。
          「取消（void）→新規作成」での運用をお願いします。
        </p>
        <Link
          href={`/journal/${id}`}
          className="inline-block border border-slate-300 rounded px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          ← 詳細に戻る
        </Link>
      </div>
    );
  }

  // 編集時の初期金額は「テンプレが想定する amount」を逆算する。
  // 売上系：debit合計（複数借方時は全合計）
  // 経費系：debit合計
  // 按分系：amount = debit合計 + credit主科目 / 1 だが、テンプレの設計上は
  // creditサイドの主科目(事業主借/普通預金等)の金額が元のamountに一致するのでそれを使う
  const amount =
    entry.lines.find((l) => l.creditAmount > 0)?.creditAmount ??
    entry.lines.reduce((s, l) => s + l.debitAmount, 0);

  const counterpartyFromLine = entry.lines.find(
    (l) => l.counterparty,
  )?.counterparty;
  const memoFromLine = entry.lines.find((l) => l.memo)?.memo;

  const ratioMap: Record<string, number> = {};
  for (const s of settings) ratioMap[s.key] = Number(s.value);

  const templateDTOs = templates.map((t) => ({
    key: t.key,
    label: t.label,
    pattern: parsePattern(t.pattern),
  }));

  const accountMap: Record<string, string> = {};
  for (const a of accounts) accountMap[a.code] = a.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          仕訳 #{entry.voucherNo} を編集
        </h1>
        <Link
          href={`/journal/${id}`}
          className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100"
        >
          キャンセル
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
        編集内容は訂正履歴（AuditLog）に before/after が記録されます。電子帳簿保存法の真実性確保要件のため、変更履歴は削除できません。
      </div>

      <JournalForm
        templates={templateDTOs}
        accountMap={accountMap}
        ratioMap={ratioMap}
        saveAction={updateJournal}
        initial={{
          journalId: id,
          templateKey: entry.templateKey ?? undefined,
          entryDate: format(entry.entryDate, "yyyy-MM-dd"),
          amount,
          description: entry.description,
          counterparty: counterpartyFromLine ?? undefined,
          memo: memoFromLine ?? undefined,
        }}
        submitLabel="変更を保存"
      />
    </div>
  );
}
