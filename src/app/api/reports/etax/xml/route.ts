import { NextRequest } from "next/server";
import { getFiscalYearRange } from "@/lib/fiscal";
import {
  computeBalances,
  buildIncomeStatement,
  buildBalanceSheet,
} from "@/lib/financial-statements";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

const BLUE_RETURN_DEDUCTION = 650_000;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get("year");
  const year = yearStr ? Number(yearStr) : new Date().getFullYear();
  const { start, end } = await getFiscalYearRange(year);

  const balances = await computeBalances(start, end);
  const pl = buildIncomeStatement(balances);
  const bs = buildBalanceSheet(balances, pl.netIncome);
  const taxableIncome = Math.max(0, pl.netIncome - BLUE_RETURN_DEDUCTION);

  const profileSetting = await prisma.setting.findUnique({
    where: { key: "business_profile" },
  });
  let profile: {
    name?: string;
    tradeName?: string;
    address?: string;
    taxOffice?: string;
  } = {};
  if (profileSetting) {
    try {
      profile = JSON.parse(profileSetting.value);
    } catch {}
  }

  // 注: 国税庁の正式XTX形式は年度ごとに公開される独自仕様。
  // 本XMLは v1 暫定のシンプルなツリー構造。XTX正式対応は仕様公開後に追加実装。
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<TaxReturn schemaVersion="0.1-draft" generatedBy="personal-bookkeeping" generatedAt="${new Date().toISOString()}">`,
  );
  lines.push(`  <FiscalYear>${year}</FiscalYear>`);
  lines.push(
    `  <Period from="${format(start, "yyyy-MM-dd")}" to="${format(end, "yyyy-MM-dd")}"/>`,
  );
  lines.push("  <Taxpayer>");
  lines.push(`    <Name>${escapeXml(profile.name ?? "")}</Name>`);
  lines.push(`    <TradeName>${escapeXml(profile.tradeName ?? "")}</TradeName>`);
  lines.push(`    <Address>${escapeXml(profile.address ?? "")}</Address>`);
  lines.push(`    <TaxOffice>${escapeXml(profile.taxOffice ?? "")}</TaxOffice>`);
  lines.push("  </Taxpayer>");

  lines.push("  <IncomeStatement>");
  lines.push("    <Revenues>");
  for (const b of pl.revenueLines) {
    lines.push(
      `      <Account code="${b.code}" name="${escapeXml(b.name)}">${b.closing}</Account>`,
    );
  }
  lines.push(`    </Revenues>`);
  lines.push(`    <TotalRevenue>${pl.totalRevenue}</TotalRevenue>`);
  lines.push("    <Expenses>");
  for (const b of pl.expenseLines) {
    lines.push(
      `      <Account code="${b.code}" name="${escapeXml(b.name)}">${b.closing}</Account>`,
    );
  }
  lines.push(`    </Expenses>`);
  lines.push(`    <TotalExpense>${pl.totalExpense}</TotalExpense>`);
  lines.push(`    <NetIncome>${pl.netIncome}</NetIncome>`);
  lines.push(
    `    <BlueReturnDeduction>${BLUE_RETURN_DEDUCTION}</BlueReturnDeduction>`,
  );
  lines.push(`    <TaxableIncome>${taxableIncome}</TaxableIncome>`);
  lines.push("  </IncomeStatement>");

  lines.push("  <BalanceSheet>");
  lines.push("    <Assets>");
  for (const b of bs.assetLines) {
    lines.push(
      `      <Account code="${b.code}" name="${escapeXml(b.name)}">${b.closing}</Account>`,
    );
  }
  lines.push(`    </Assets>`);
  lines.push(`    <TotalAssets>${bs.totalAssets}</TotalAssets>`);
  lines.push("    <Liabilities>");
  for (const b of bs.liabilityLines) {
    lines.push(
      `      <Account code="${b.code}" name="${escapeXml(b.name)}">${b.closing}</Account>`,
    );
  }
  lines.push(`    </Liabilities>`);
  lines.push(`    <TotalLiabilities>${bs.totalLiabilities}</TotalLiabilities>`);
  lines.push("    <Equity>");
  for (const b of bs.equityLines) {
    lines.push(
      `      <Account code="${b.code}" name="${escapeXml(b.name)}">${b.closing}</Account>`,
    );
  }
  lines.push(`      <CurrentNetIncome>${bs.netIncome}</CurrentNetIncome>`);
  lines.push(`    </Equity>`);
  lines.push(`    <TotalEquity>${bs.totalEquity}</TotalEquity>`);
  lines.push("  </BalanceSheet>");

  lines.push("</TaxReturn>");

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="kessan_${year}.xml"`,
    },
  });
}
