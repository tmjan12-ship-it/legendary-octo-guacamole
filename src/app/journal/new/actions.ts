"use server";

import { prisma } from "@/lib/prisma";
import { evaluateTemplate, isBalanced, parsePattern } from "@/lib/templates";
import { redirect } from "next/navigation";
import { z } from "zod";

const SaveInput = z.object({
  templateKey: z.string(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().int().positive(),
  description: z.string().min(1).max(200),
  counterparty: z.string().max(100).optional().nullable(),
  memo: z.string().max(200).optional().nullable(),
});

export async function saveJournal(formData: FormData) {
  const parsed = SaveInput.parse({
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

  const lines = evaluateTemplate(pattern, { amount: parsed.amount, ratio });
  if (!isBalanced(lines)) {
    throw new Error("仕訳が貸借一致しません。テンプレートを確認してください。");
  }

  // 伝票番号採番（DBの最大値+1）
  const max = await prisma.journalEntry.aggregate({ _max: { voucherNo: true } });
  const voucherNo = (max._max.voucherNo ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        entryDate: new Date(parsed.entryDate + "T00:00:00"),
        description: parsed.description,
        voucherNo,
        templateKey: parsed.templateKey,
        lines: {
          create: lines.map((l, idx) => ({
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
      include: { lines: true },
    });

    await tx.auditLog.create({
      data: {
        journalId: entry.id,
        action: "create",
        afterJson: JSON.stringify(entry),
      },
    });

    return entry;
  });

  redirect(`/journal?highlight=${created.id}`);
}
