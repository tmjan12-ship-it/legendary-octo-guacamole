"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function voidJournal(id: string) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.journalEntry.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    if (before.status === "void") return;

    const updated = await tx.journalEntry.update({
      where: { id },
      data: { status: "void" },
      include: { lines: true },
    });

    await tx.auditLog.create({
      data: {
        journalId: id,
        action: "void",
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(updated),
      },
    });
  });

  revalidatePath("/journal");
}

export async function voidManyJournals(ids: string[]) {
  for (const id of ids) {
    await prisma.$transaction(async (tx) => {
      const before = await tx.journalEntry.findUniqueOrThrow({
        where: { id },
        include: { lines: true },
      });
      if (before.status === "void") return;
      const updated = await tx.journalEntry.update({
        where: { id },
        data: { status: "void" },
        include: { lines: true },
      });
      await tx.auditLog.create({
        data: {
          journalId: id,
          action: "void",
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify(updated),
        },
      });
    });
  }
  revalidatePath("/journal");
}
