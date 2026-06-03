"use server";

import { prisma } from "@/lib/prisma";
import { evaluateTemplate, isBalanced, parsePattern } from "@/lib/templates";
import { redirect } from "next/navigation";
import { z } from "zod";

const UpdateInput = z.object({
  journalId: z.string(),
  templateKey: z.string(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().int().positive(),
  description: z.string().min(1).max(200),
  counterparty: z.string().max(100).optional().nullable(),
  memo: z.string().max(200).optional().nullable(),
});

export async function updateJournal(formData: FormData) {
  const parsed = UpdateInput.parse({
    journalId: formData.get("journalId"),
    templateKey: formData.get("templateKey"),
    entryDate: formData.get("entryDate"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    counterparty: formData.get("counterparty") || null,
    memo: formData.get("memo") || null,
  });

  const template = await prisma.journalTemplate.findUniqueOrThrow({
    where: { key: parsed.templateKey },
  });
  const pattern = parsePattern(template.pattern);

  let ratio = 1;
  if (pattern.settingKey) {
    const s = await prisma.setting.findUnique({
      where: { key: pattern.settingKey },
    });
    ratio = s ? Number(s.value) : 1;
  }

  const newLines = evaluateTemplate(pattern, { amount: parsed.amount, ratio });
  if (!isBalanced(newLines)) {
    throw new Error("仕訳が貸借一致しません。テンプレートを確認してください。");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.journalEntry.findUniqueOrThrow({
      where: { id: parsed.journalId },
      include: { lines: { include: { account: true } } },
    });

    // 既存明細を削除して作り直す（テンプレ展開のため）
    await tx.journalLine.deleteMany({ where: { journalId: parsed.journalId } });

    const updated = await tx.journalEntry.update({
      where: { id: parsed.journalId },
      data: {
        entryDate: new Date(parsed.entryDate + "T00:00:00"),
        description: parsed.description,
        templateKey: parsed.templateKey,
        lines: {
          create: newLines.map((l, idx) => ({
            accountCode: l.accountCode,
            debitAmount: l.side === "debit" ? l.amount : 0,
            creditAmount: l.side === "credit" ? l.amount : 0,
            counterparty: parsed.counterparty,
            memo: l.memo ?? parsed.memo,
            lineOrder: idx,
            taxCategory: l.taxCategory ?? null,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    await tx.auditLog.create({
      data: {
        journalId: parsed.journalId,
        action: "update",
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(updated),
      },
    });
  });

  redirect(`/journal/${parsed.journalId}`);
}
