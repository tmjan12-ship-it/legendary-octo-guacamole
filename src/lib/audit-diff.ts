// AuditLogのbefore/after JSONを人間が読める差分に変換するヘルパー

export type FieldDiff = {
  label: string;
  before: string | null;
  after: string | null;
};

type LineSnapshot = {
  accountCode?: string;
  account?: { name?: string };
  debitAmount?: number;
  creditAmount?: number;
  counterparty?: string | null;
  memo?: string | null;
};

type EntrySnapshot = {
  entryDate?: string;
  description?: string;
  status?: string;
  templateKey?: string | null;
  lines?: LineSnapshot[];
};

function yen(n: number | undefined | null): string {
  if (n == null || n === 0) return "-";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatDate(s: string | undefined): string {
  if (!s) return "";
  return s.split("T")[0];
}

function summarizeLine(l: LineSnapshot): string {
  const side = (l.debitAmount ?? 0) > 0 ? "借" : "貸";
  const name = l.account?.name ?? l.accountCode ?? "?";
  const amount = (l.debitAmount ?? 0) > 0 ? l.debitAmount : l.creditAmount;
  const meta = [l.counterparty, l.memo].filter(Boolean).join(" / ");
  return `${side} ${name} ${yen(amount)}${meta ? `（${meta}）` : ""}`;
}

export function diffEntries(
  beforeJson: string | null | undefined,
  afterJson: string | null | undefined,
): FieldDiff[] {
  let before: EntrySnapshot | null = null;
  let after: EntrySnapshot | null = null;
  try {
    if (beforeJson) before = JSON.parse(beforeJson) as EntrySnapshot;
  } catch {}
  try {
    if (afterJson) after = JSON.parse(afterJson) as EntrySnapshot;
  } catch {}

  const diffs: FieldDiff[] = [];

  if (before?.entryDate !== after?.entryDate) {
    diffs.push({
      label: "取引日",
      before: before?.entryDate ? formatDate(before.entryDate) : null,
      after: after?.entryDate ? formatDate(after.entryDate) : null,
    });
  }
  if (before?.description !== after?.description) {
    diffs.push({
      label: "摘要",
      before: before?.description ?? null,
      after: after?.description ?? null,
    });
  }
  if (before?.status !== after?.status) {
    diffs.push({
      label: "状態",
      before: before?.status ?? null,
      after: after?.status ?? null,
    });
  }
  if (before?.templateKey !== after?.templateKey) {
    diffs.push({
      label: "テンプレ",
      before: before?.templateKey ?? null,
      after: after?.templateKey ?? null,
    });
  }

  // 明細の差分（行単位の summary）
  const beforeLines = before?.lines?.map(summarizeLine) ?? [];
  const afterLines = after?.lines?.map(summarizeLine) ?? [];
  const beforeText = beforeLines.join("\n");
  const afterText = afterLines.join("\n");
  if (beforeText !== afterText) {
    diffs.push({
      label: "明細",
      before: beforeText || null,
      after: afterText || null,
    });
  }

  return diffs;
}
