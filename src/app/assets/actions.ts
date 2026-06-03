"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const AssetInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  accountCode: z.string().min(1),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCost: z.coerce.number().int().positive(),
  usefulLifeYears: z.coerce.number().int().positive().max(50),
  businessUseRatio: z.coerce.number().min(0).max(1),
  notes: z.string().max(300).optional().nullable(),
});

export async function saveAsset(formData: FormData) {
  const parsed = AssetInput.parse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    accountCode: formData.get("accountCode"),
    acquisitionDate: formData.get("acquisitionDate"),
    acquisitionCost: formData.get("acquisitionCost"),
    usefulLifeYears: formData.get("usefulLifeYears"),
    businessUseRatio: formData.get("businessUseRatio"),
    notes: formData.get("notes") || null,
  });

  const data = {
    name: parsed.name,
    accountCode: parsed.accountCode,
    acquisitionDate: new Date(parsed.acquisitionDate + "T00:00:00"),
    acquisitionCost: parsed.acquisitionCost,
    usefulLifeYears: parsed.usefulLifeYears,
    businessUseRatio: parsed.businessUseRatio,
    notes: parsed.notes,
  };

  if (parsed.id) {
    await prisma.fixedAsset.update({
      where: { id: parsed.id },
      data,
    });
    redirect(`/assets`);
  } else {
    await prisma.fixedAsset.create({ data });
    redirect(`/assets`);
  }
}

export async function disposeAsset(id: string, formData: FormData) {
  const date = formData.get("disposalDate");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("廃棄日を yyyy-MM-dd で指定してください");
  }
  await prisma.fixedAsset.update({
    where: { id },
    data: {
      isDisposed: true,
      disposalDate: new Date(date + "T00:00:00"),
    },
  });
  revalidatePath("/assets");
}

export async function undisposeAsset(id: string) {
  await prisma.fixedAsset.update({
    where: { id },
    data: { isDisposed: false, disposalDate: null },
  });
  revalidatePath("/assets");
}
