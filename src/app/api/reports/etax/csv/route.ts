import { NextRequest } from "next/server";
import { getFiscalYearRange } from "@/lib/fiscal";
import {
  computeBalances,
  buildIncomeStatement,
  buildBalanceSheet,
} from "@/lib/financial-statements";

const BLUE_RETURN_DEDUCTION = 650_000;

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get("year");
  const year = yearStr ? Number(yearStr) : new Date().getFullYear();
  const { start, end } = await getFiscalYearRange(year);

  const balances = await computeBalances(start, end);
  const pl = buildIncomeStatement(balances);
  const bs = buildBalanceSheet(balances, pl.netIncome);
  const taxableIncome = Math.max(0, pl.netIncome - BLUE_RETURN_DEDUCTION);

  const rows: string[][] = [
    ["区分", "科目", "金額"],
    ...pl.revenueLines.map((b) => ["売上", b.name, String(b.closing)]),
    ["売上", "売上合計", String(pl.totalRevenue)],
    ...pl.expenseLines.map((b) => ["経費", b.name, String(b.closing)]),
    ["経費", "経費合計", String(pl.totalExpense)],
    ["所得", "差引金額", String(pl.netIncome)],
    ["所得", "青色申告特別控除", String(-BLUE_RETURN_DEDUCTION)],
    ["所得", "課税所得", String(taxableIncome)],
    ...bs.assetLines.map((b) => ["資産", b.name, String(b.closing)]),
    ["資産", "資産合計", String(bs.totalAssets)],
    ...bs.liabilityLines.map((b) => ["負債", b.name, String(b.closing)]),
    ["負債", "負債合計", String(bs.totalLiabilities)],
    ...bs.equityLines.map((b) => ["純資産", b.name, String(b.closing)]),
    ["純資産", "当期純利益", String(bs.netIncome)],
    ["純資産", "純資産合計", String(bs.totalEquity)],
  ];

  const csv = rows
    .map((r) =>
      r.map((c) => (c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c)).join(","),
    )
    .join("\r\n");

  // UTF-8 BOM 付き（Excel で文字化けしないため）
  const body = "﻿" + csv;
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kessan_${year}.csv"`,
    },
  });
}
