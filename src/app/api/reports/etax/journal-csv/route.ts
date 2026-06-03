import { NextRequest } from "next/server";
import { getFiscalYearRange } from "@/lib/fiscal";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get("year");
  const year = yearStr ? Number(yearStr) : new Date().getFullYear();
  const { start, end } = await getFiscalYearRange(year);

  const entries = await prisma.journalEntry.findMany({
    where: {
      status: "active",
      entryDate: { gte: start, lte: end },
    },
    orderBy: [{ entryDate: "asc" }, { voucherNo: "asc" }],
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: "asc" },
      },
    },
  });

  const rows: string[][] = [
    [
      "取引年月日",
      "伝票No",
      "明細No",
      "勘定科目コード",
      "勘定科目名",
      "借方金額",
      "貸方金額",
      "取引先",
      "摘要",
      "明細メモ",
    ],
  ];

  for (const e of entries) {
    for (const l of e.lines) {
      rows.push([
        format(e.entryDate, "yyyy-MM-dd"),
        String(e.voucherNo),
        String(l.lineOrder + 1),
        l.accountCode,
        l.account.name,
        String(l.debitAmount),
        String(l.creditAmount),
        l.counterparty ?? "",
        e.description,
        l.memo ?? "",
      ]);
    }
  }

  const csv = rows
    .map((r) =>
      r
        .map((c) =>
          c.includes(",") || c.includes('"') || c.includes("\n")
            ? `"${c.replace(/"/g, '""')}"`
            : c,
        )
        .join(","),
    )
    .join("\r\n");

  const body = "﻿" + csv;
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="journal_${year}.csv"`,
    },
  });
}
