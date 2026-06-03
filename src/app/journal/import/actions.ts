"use server";

import { prisma } from "@/lib/prisma";
import { evaluateTemplate, isBalanced, parsePattern } from "@/lib/templates";
import { redirect } from "next/navigation";
import { z } from "zod";

const RowSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateKey: z.string(),
  amount: z.coerce.number().int().positive(),
  description: z.string().min(1).max(200),
  counterparty: z.string().max(100).optional().nullable(),
  memo: z.string().max(200).optional().nullable(),
});

export async function commitImport(formData: FormData) {
  const json = formData.get("rows");
  if (typeof json !== "string") throw new Error("rows がありません");
  const parsed = z.array(RowSchema).parse(JSON.parse(json));
  if (parsed.length === 0) throw new Error("取り込む行がありません");

  const templates = await prisma.journalTemplate.findMany();
  const tmplMap = new Map(templates.map((t) => [t.key, t]));

  const ratios = await prisma.setting.findMany({
    where: { key: { startsWith: "ratio_" } },
  });
  const ratioMap = new Map<string, number>(
    ratios.map((r) => [r.key, Number(r.value)]),
  );

  let inserted = 0;

  for (const row of parsed) {
    const t = tmplMap.get(row.templateKey);
    if (!t) throw new Error(`未知のテンプレ: ${row.templateKey}`);
    const pattern = parsePattern(t.pattern);
    const ratio = pattern.settingKey
      ? (ratioMap.get(pattern.settingKey) ?? 1)
      : 1;
    const lines = evaluateTemplate(pattern, { amount: row.amount, ratio });
    if (!isBalanced(lines)) {
      throw new Error(`貸借不一致: ${row.description}`);
    }

    await prisma.$transaction(async (tx) => {
      const max = await tx.journalEntry.aggregate({
        _max: { voucherNo: true },
      });
      const voucherNo = (max._max.voucherNo ?? 0) + 1;
      const entry = await tx.journalEntry.create({
        data: {
          entryDate: new Date(row.entryDate + "T00:00:00"),
          description: row.description,
          voucherNo,
          templateKey: row.templateKey,
          lines: {
            create: lines.map((l, idx) => ({
              accountCode: l.accountCode,
              debitAmount: l.side === "debit" ? l.amount : 0,
              creditAmount: l.side === "credit" ? l.amount : 0,
              counterparty: row.counterparty ?? null,
              memo: l.memo ?? row.memo ?? null,
              lineOrder: idx,
              taxCategory: l.taxCategory ?? null,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          journalId: entry.id,
          action: "create",
          afterJson: JSON.stringify({ source: "csv_import" }),
        },
      });
    });
    inserted++;
  }

  redirect(`/journal?imported=${inserted}`);
}
