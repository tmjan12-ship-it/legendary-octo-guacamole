"use client";

import { useMemo, useState } from "react";
import {
  evaluateTemplate,
  isBalanced,
  innerTax,
  TAX_CATEGORY_LABEL,
  type TemplatePattern,
  type EvaluatedLine,
  type TaxCategory,
} from "@/lib/templates";

type TemplateDTO = {
  key: string;
  label: string;
  pattern: TemplatePattern;
};

type Props = {
  templates: TemplateDTO[];
  accountMap: Record<string, string>;
  ratioMap: Record<string, number>;
  saveAction: (formData: FormData) => Promise<void>;
  initial?: {
    journalId?: string;
    templateKey?: string;
    entryDate?: string;
    amount?: number;
    description?: string;
    counterparty?: string;
    memo?: string;
  };
  submitLabel?: string;
};

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function JournalForm({
  templates,
  accountMap,
  ratioMap,
  saveAction,
  initial,
  submitLabel = "保存",
}: Props) {
  const [templateKey, setTemplateKey] = useState<string>(
    initial?.templateKey ?? templates[0]?.key ?? "",
  );
  const [entryDate, setEntryDate] = useState<string>(
    initial?.entryDate ?? todayIso(),
  );
  const [amount, setAmount] = useState<string>(
    initial?.amount ? String(initial.amount) : "",
  );
  const [description, setDescription] = useState<string>(
    initial?.description ?? "",
  );
  const [counterparty, setCounterparty] = useState<string>(
    initial?.counterparty ?? "",
  );
  const [memo, setMemo] = useState<string>(initial?.memo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((t) => t.key === templateKey) ?? null,
    [templates, templateKey],
  );

  const preview = useMemo<EvaluatedLine[]>(() => {
    if (!selected) return [];
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return [];
    const ratio = selected.pattern.settingKey
      ? (ratioMap[selected.pattern.settingKey] ?? 1)
      : 1;
    try {
      return evaluateTemplate(selected.pattern, { amount: amt, ratio });
    } catch {
      return [];
    }
  }, [selected, amount, ratioMap]);

  const balanced = preview.length > 0 && isBalanced(preview);
  const debitTotal = preview
    .filter((l) => l.side === "debit")
    .reduce((s, l) => s + l.amount, 0);
  const creditTotal = preview
    .filter((l) => l.side === "credit")
    .reduce((s, l) => s + l.amount, 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!balanced) {
      setError("貸借が一致していません。金額を確認してください。");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      await saveAction(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {initial?.journalId && (
        <input type="hidden" name="journalId" value={initial.journalId} />
      )}
      <div className="space-y-4 bg-white border border-slate-300 rounded p-5">
        <h2 className="font-semibold">入力</h2>

        <input type="hidden" name="templateKey" value={templateKey} />
        <Field label="テンプレート">
          <TemplatePicker
            templates={templates}
            value={templateKey}
            onChange={setTemplateKey}
          />
          {selected && (
            <div className="text-xs text-slate-700 mt-2">
              {selected.pattern.description}
            </div>
          )}
        </Field>

        <Field label="取引日">
          <input
            type="date"
            name="entryDate"
            className="border border-slate-300 rounded px-3 py-2.5"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </Field>

        <Field label="金額（円）">
          <input
            type="number"
            name="amount"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full sm:w-48 border border-slate-300 rounded px-3 py-2.5 text-right text-lg sm:text-base"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="1"
            required
            placeholder="例: 50000"
          />
        </Field>

        <Field label="摘要">
          <input
            type="text"
            name="description"
            className="w-full border border-slate-300 rounded px-3 py-2.5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="例: ◯◯社 業務委託 4月分"
          />
        </Field>

        {selected?.pattern.inputs.some((i) => i.name === "counterparty") && (
          <Field label="取引先">
            <input
              type="text"
              name="counterparty"
              className="w-full border border-slate-300 rounded px-3 py-2.5"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="例: 株式会社◯◯"
            />
          </Field>
        )}

        {selected?.pattern.inputs.some((i) => i.name === "memo") && (
          <Field label="メモ">
            <input
              type="text"
              name="memo"
              className="w-full border border-slate-300 rounded px-3 py-2.5"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="任意"
            />
          </Field>
        )}

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!balanced || submitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:bg-slate-300"
        >
          {submitting ? "保存中..." : submitLabel}
        </button>
      </div>

      <div className="space-y-4">
        <div
          className={`bg-white border-2 rounded p-5 ${
            selected?.pattern.category === "sales"
              ? "border-blue-300"
              : selected?.pattern.category === "expense_apportioned"
                ? "border-amber-300"
                : "border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">プレビュー（複式仕訳）</h2>
            {selected?.pattern.category && (
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${
                  selected.pattern.category === "sales"
                    ? "bg-blue-100 text-blue-700"
                    : selected.pattern.category === "expense_apportioned"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {CATEGORY_META[selected.pattern.category].label}
              </span>
            )}
          </div>
          {preview.length === 0 ? (
            <div className="text-sm text-slate-600 mt-3">
              金額を入力するとここに仕訳が表示されます。
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-xs sm:text-sm mt-3 min-w-[480px]">
              <thead className="text-slate-600">
                <tr>
                  <th className="text-left py-1 w-14">区分</th>
                  <th className="text-left py-1">勘定科目</th>
                  <th className="text-right py-1 w-20">金額</th>
                  <th className="text-left py-1 w-16">税区分</th>
                  <th className="text-right py-1 w-20">内消費税</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((l, i) => {
                  const tax = innerTax(l.amount, l.taxCategory);
                  return (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="py-1">
                        <SideBadge side={l.side} />
                      </td>
                      <td className="py-1">
                        {accountMap[l.accountCode]}
                        {l.memo && (
                          <span className="text-slate-500 ml-2 text-xs">
                            {l.memo}
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right">{yen(l.amount)}</td>
                      <td className="py-1">
                        {l.taxCategory ? (
                          <TaxBadge category={l.taxCategory} />
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-1 text-right text-slate-600">
                        {tax > 0 ? yen(tax) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-slate-700 font-medium">
                <tr className="border-t-2 border-slate-300">
                  <td className="py-1.5" colSpan={2}>
                    借方合計
                  </td>
                  <td className="py-1.5 text-right">{yen(debitTotal)}</td>
                  <td colSpan={2} className="py-1.5 text-right text-slate-600 text-xs">
                    課税仕入 内消費税{" "}
                    {yen(
                      preview
                        .filter((l) => l.side === "debit")
                        .reduce((s, l) => s + innerTax(l.amount, l.taxCategory), 0),
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1" colSpan={2}>
                    貸方合計
                  </td>
                  <td className="py-1 text-right">{yen(creditTotal)}</td>
                  <td colSpan={2} className="py-1 text-right text-slate-600 text-xs">
                    課税売上 内消費税{" "}
                    {yen(
                      preview
                        .filter((l) => l.side === "credit")
                        .reduce((s, l) => s + innerTax(l.amount, l.taxCategory), 0),
                    )}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="pt-2">
                    <span
                      className={
                        balanced
                          ? "text-emerald-700"
                          : "text-rose-700 font-bold"
                      }
                    >
                      {balanced ? "✓ 貸借一致" : "✗ 貸借不一致"}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </div>

        {selected?.pattern.settingKey && (
          <div className="text-xs text-slate-700 bg-slate-100 border border-slate-300 rounded p-3">
            ※ 按分率「{selected.pattern.settingKey}」は{" "}
            {((ratioMap[selected.pattern.settingKey] ?? 1) * 100).toFixed(0)}%
            （設定画面から変更可）
          </div>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

function SideBadge({ side }: { side: "debit" | "credit" }) {
  return (
    <span
      className={`inline-block text-xs rounded px-1.5 py-0.5 ${
        side === "debit"
          ? "bg-blue-100 text-blue-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {side === "debit" ? "借方" : "貸方"}
    </span>
  );
}

const TAX_BADGE_STYLE: Record<TaxCategory, string> = {
  standard_10: "bg-emerald-100 text-emerald-700",
  reduced_8: "bg-lime-100 text-lime-700",
  non_taxable: "bg-slate-100 text-slate-600",
  untaxed: "bg-slate-100 text-slate-500",
  exempt: "bg-violet-100 text-violet-700",
};

function TaxBadge({ category }: { category: TaxCategory }) {
  return (
    <span
      className={`inline-block text-[10px] rounded px-1.5 py-0.5 ${TAX_BADGE_STYLE[category]}`}
    >
      {TAX_CATEGORY_LABEL[category]}
    </span>
  );
}

const CATEGORY_META: Record<
  string,
  { label: string; accent: string; ring: string; bg: string }
> = {
  sales: {
    label: "売上",
    accent: "text-blue-700",
    ring: "ring-blue-500 border-blue-500 bg-blue-50",
    bg: "border-blue-100 hover:border-blue-300 hover:bg-blue-50/40",
  },
  expense_apportioned: {
    label: "経費（按分）",
    accent: "text-amber-700",
    ring: "ring-amber-500 border-amber-500 bg-amber-50",
    bg: "border-amber-100 hover:border-amber-300 hover:bg-amber-50/40",
  },
  expense_other: {
    label: "経費（その他）",
    accent: "text-slate-700",
    ring: "ring-slate-500 border-slate-500 bg-slate-100",
    bg: "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
  },
};

const CATEGORY_ORDER = ["sales", "expense_apportioned", "expense_other"] as const;

function TemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: TemplateDTO[];
  value: string;
  onChange: (key: string) => void;
}) {
  const groups: Record<string, TemplateDTO[]> = {};
  for (const t of templates) {
    const cat = t.pattern.category ?? "expense_other";
    (groups[cat] ??= []).push(t);
  }

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map((cat) => {
        const items = groups[cat];
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat}>
            <div
              className={`text-xs font-semibold mb-1.5 ${meta.accent}`}
            >
              {meta.label}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {items.map((t) => {
                const active = t.key === value;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => onChange(t.key)}
                    className={`text-left text-sm rounded border px-3 py-2.5 transition ${
                      active
                        ? `ring-2 ${meta.ring}`
                        : `${meta.bg} bg-white`
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
