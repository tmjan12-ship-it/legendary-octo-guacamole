// 仕訳テンプレート評価ロジック
// 安全のため eval は使わず、サポートする formula パターンを限定する

export type TemplateInput = {
  name: string;
  label: string;
  type: "amount" | "text" | "date";
};

export type TaxCategory =
  | "standard_10" // 標準税率10%
  | "reduced_8" // 軽減税率8%
  | "non_taxable" // 非課税（土地・住宅家賃・受取利息など）
  | "untaxed" // 不課税/対象外（給与・国外取引・人格に属さない取引）
  | "exempt"; // 免税（輸出など）

export const TAX_RATE: Record<TaxCategory, number> = {
  standard_10: 0.1,
  reduced_8: 0.08,
  non_taxable: 0,
  untaxed: 0,
  exempt: 0,
};

export const TAX_CATEGORY_LABEL: Record<TaxCategory, string> = {
  standard_10: "課税10%",
  reduced_8: "軽減8%",
  non_taxable: "非課税",
  untaxed: "不課税",
  exempt: "免税",
};

export type TemplateLine = {
  side: "debit" | "credit";
  accountCode: string;
  formula: string;
  memo?: string;
  taxCategory?: TaxCategory;
};

export type TemplateCategory = "sales" | "expense_apportioned" | "expense_other";

export type TemplatePattern = {
  description: string;
  category?: TemplateCategory;
  inputs: TemplateInput[];
  lines: TemplateLine[];
  settingKey?: string;
};

export type EvaluatedLine = {
  side: "debit" | "credit";
  accountCode: string;
  amount: number;
  memo?: string;
  taxCategory?: TaxCategory;
};

/** 税込金額から内消費税額を逆算（内税方式） */
export function innerTax(amount: number, category?: TaxCategory): number {
  if (!category) return 0;
  const rate = TAX_RATE[category];
  if (rate === 0) return 0;
  return Math.round(amount - amount / (1 + rate));
}

export type EvaluateContext = {
  amount: number;
  ratio: number;
};

/**
 * 限定的なformulaを安全に評価する。
 * サポート:
 *   - "amount"
 *   - "round(amount * ratio)"
 *   - "amount - round(amount * ratio)"
 */
export function evaluateFormula(
  formula: string,
  ctx: EvaluateContext,
): number {
  const trimmed = formula.replace(/\s+/g, "");
  if (trimmed === "amount") return ctx.amount;
  if (trimmed === "round(amount*ratio)") {
    return Math.round(ctx.amount * ctx.ratio);
  }
  if (trimmed === "amount-round(amount*ratio)") {
    return ctx.amount - Math.round(ctx.amount * ctx.ratio);
  }
  throw new Error(`Unsupported formula: ${formula}`);
}

export function evaluateTemplate(
  pattern: TemplatePattern,
  ctx: EvaluateContext,
): EvaluatedLine[] {
  return pattern.lines.map((line) => ({
    side: line.side,
    accountCode: line.accountCode,
    amount: evaluateFormula(line.formula, ctx),
    memo: line.memo,
    taxCategory: line.taxCategory,
  }));
}

/** 借方合計と貸方合計が一致しているか（複式簿記の検算） */
export function isBalanced(lines: EvaluatedLine[]): boolean {
  const debit = lines
    .filter((l) => l.side === "debit")
    .reduce((s, l) => s + l.amount, 0);
  const credit = lines
    .filter((l) => l.side === "credit")
    .reduce((s, l) => s + l.amount, 0);
  return debit === credit;
}

export function parsePattern(json: string): TemplatePattern {
  return JSON.parse(json) as TemplatePattern;
}
