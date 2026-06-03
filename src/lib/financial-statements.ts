import { prisma } from "./prisma";

export type AccountBalance = {
  code: string;
  name: string;
  type: string;
  category: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
};

/**
 * 指定期間における全勘定科目の残高を集計する。
 * - 期首残高: 期首より前の累積（借方-貸方）
 * - 期中: 期間中の借方合計・貸方合計
 * - 期末残高: 期首残高 + 借方 - 貸方
 */
export async function computeBalances(
  start: Date,
  end: Date,
): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const opening = await prisma.journalLine.groupBy({
    by: ["accountCode"],
    where: { journal: { status: "active", entryDate: { lt: start } } },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const period = await prisma.journalLine.groupBy({
    by: ["accountCode"],
    where: {
      journal: { status: "active", entryDate: { gte: start, lte: end } },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });

  const openingMap = new Map<string, number>();
  for (const o of opening) {
    openingMap.set(
      o.accountCode,
      (o._sum.debitAmount ?? 0) - (o._sum.creditAmount ?? 0),
    );
  }
  const periodMap = new Map<string, { d: number; c: number }>();
  for (const p of period) {
    periodMap.set(p.accountCode, {
      d: p._sum.debitAmount ?? 0,
      c: p._sum.creditAmount ?? 0,
    });
  }

  return accounts.map((a) => {
    const op = openingMap.get(a.code) ?? 0;
    const pd = periodMap.get(a.code) ?? { d: 0, c: 0 };
    return {
      code: a.code,
      name: a.name,
      type: a.type,
      category: a.category,
      opening: op,
      debit: pd.d,
      credit: pd.c,
      closing: op + pd.d - pd.c,
    };
  });
}

export type IncomeStatement = {
  revenueLines: AccountBalance[];
  expenseLines: AccountBalance[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
};

/** 損益計算書（PL）を組み立てる */
export function buildIncomeStatement(
  balances: AccountBalance[],
): IncomeStatement {
  const revenueLines = balances
    .filter((b) => b.type === "revenue")
    .map((b) => ({ ...b, closing: b.credit - b.debit })); // 収益は貸方残
  const expenseLines = balances
    .filter((b) => b.type === "expense")
    .map((b) => ({ ...b, closing: b.debit - b.credit })); // 費用は借方残
  const totalRevenue = revenueLines.reduce((s, b) => s + b.closing, 0);
  const totalExpense = expenseLines.reduce((s, b) => s + b.closing, 0);
  return {
    revenueLines,
    expenseLines,
    totalRevenue,
    totalExpense,
    netIncome: totalRevenue - totalExpense,
  };
}

export type BalanceSheet = {
  assetLines: AccountBalance[];
  liabilityLines: AccountBalance[];
  equityLines: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
};

/** 貸借対照表（BS）を組み立てる */
export function buildBalanceSheet(
  balances: AccountBalance[],
  netIncome: number,
): BalanceSheet {
  // 期末ベース表示
  const assetLines = balances.filter((b) => b.type === "asset");
  const liabilityLines = balances
    .filter((b) => b.type === "liability")
    .map((b) => ({ ...b, closing: b.credit - b.debit }));
  const equityLines = balances
    .filter((b) => b.type === "equity")
    .map((b) => ({ ...b, closing: b.credit - b.debit }));
  const totalAssets = assetLines.reduce((s, b) => s + b.closing, 0);
  const totalLiabilities = liabilityLines.reduce((s, b) => s + b.closing, 0);
  // 純資産=元入金等+当期純利益
  const totalEquity =
    equityLines.reduce((s, b) => s + b.closing, 0) + netIncome;
  return {
    assetLines,
    liabilityLines,
    equityLines,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome,
  };
}
