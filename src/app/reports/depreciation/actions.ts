"use server";

import { prisma } from "@/lib/prisma";
import { calculateYearlySchedule } from "@/lib/depreciation";
import { revalidatePath } from "next/cache";

export async function generateDepreciationJournals(fiscalYear: number) {
  const assets = await prisma.fixedAsset.findMany({
    include: { depreciations: { where: { fiscalYear } } },
  });

  // 12月末日を計上日にする
  const entryDate = new Date(fiscalYear, 11, 31);

  let created = 0;
  let skipped = 0;

  for (const a of assets) {
    if (a.depreciations.length > 0) {
      skipped++;
      continue;
    }
    const schedule = calculateYearlySchedule({
      acquisitionDate: a.acquisitionDate,
      acquisitionCost: a.acquisitionCost,
      usefulLifeYears: a.usefulLifeYears,
      businessUseRatio: a.businessUseRatio,
      isDisposed: a.isDisposed,
      disposalDate: a.disposalDate,
    });
    const target = schedule.find((s) => s.fiscalYear === fiscalYear);
    if (!target || target.businessAmount <= 0) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const max = await tx.journalEntry.aggregate({
        _max: { voucherNo: true },
      });
      const voucherNo = (max._max.voucherNo ?? 0) + 1;

      const entry = await tx.journalEntry.create({
        data: {
          entryDate,
          description: `減価償却費 ${a.name}（${fiscalYear}年度 ${target.monthsInYear}ヶ月分）`,
          voucherNo,
          templateKey: null, // 自動生成、テンプレ無し
          lines: {
            create: [
              {
                accountCode: "511",
                debitAmount: target.businessAmount,
                creditAmount: 0,
                memo: `${a.name} 月数${target.monthsInYear}/12 按分${(a.businessUseRatio * 100).toFixed(0)}%`,
                lineOrder: 0,
              },
              {
                accountCode: "161",
                debitAmount: 0,
                creditAmount: target.businessAmount,
                memo: `${a.name}`,
                lineOrder: 1,
              },
            ],
          },
        },
      });
      await tx.auditLog.create({
        data: {
          journalId: entry.id,
          action: "create",
          afterJson: JSON.stringify({
            source: "depreciation_auto",
            assetId: a.id,
            fiscalYear,
          }),
        },
      });
      await tx.depreciationRecord.create({
        data: {
          assetId: a.id,
          fiscalYear,
          amount: target.businessAmount,
          journalId: entry.id,
        },
      });
    });
    created++;
  }

  revalidatePath("/reports/depreciation");
  revalidatePath("/journal");
  return { created, skipped };
}

export async function reverseDepreciation(
  assetId: string,
  fiscalYear: number,
) {
  // 仕訳をvoid化し、DepreciationRecordを削除（次回生成できるようにする）
  await prisma.$transaction(async (tx) => {
    const rec = await tx.depreciationRecord.findUnique({
      where: { assetId_fiscalYear: { assetId, fiscalYear } },
    });
    if (!rec) return;

    const before = await tx.journalEntry.findUnique({
      where: { id: rec.journalId },
      include: { lines: true },
    });
    if (before) {
      const updated = await tx.journalEntry.update({
        where: { id: rec.journalId },
        data: { status: "void" },
        include: { lines: true },
      });
      await tx.auditLog.create({
        data: {
          journalId: rec.journalId,
          action: "void",
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify(updated),
        },
      });
    }
    await tx.depreciationRecord.delete({
      where: { assetId_fiscalYear: { assetId, fiscalYear } },
    });
  });

  revalidatePath("/reports/depreciation");
  revalidatePath("/journal");
}
