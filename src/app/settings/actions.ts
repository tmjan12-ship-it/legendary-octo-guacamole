"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SettingsInput = z.object({
  ratioRent: z.coerce.number().min(0).max(1),
  ratioTelecom: z.coerce.number().min(0).max(1),
  ratioUtilities: z.coerce.number().min(0).max(1),
  name: z.string().max(60).optional().default(""),
  tradeName: z.string().max(60).optional().default(""),
  address: z.string().max(200).optional().default(""),
  taxOffice: z.string().max(60).optional().default(""),
  fiscalYearStart: z.string().regex(/^\d{2}-\d{2}$/).default("01-01"),
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/).default("12-31"),
});

export async function saveSettings(formData: FormData) {
  const parsed = SettingsInput.parse({
    ratioRent: formData.get("ratioRent"),
    ratioTelecom: formData.get("ratioTelecom"),
    ratioUtilities: formData.get("ratioUtilities"),
    name: formData.get("name") ?? "",
    tradeName: formData.get("tradeName") ?? "",
    address: formData.get("address") ?? "",
    taxOffice: formData.get("taxOffice") ?? "",
    fiscalYearStart: formData.get("fiscalYearStart") ?? "01-01",
    fiscalYearEnd: formData.get("fiscalYearEnd") ?? "12-31",
  });

  const profile = {
    name: parsed.name,
    tradeName: parsed.tradeName,
    address: parsed.address,
    taxOffice: parsed.taxOffice,
    fiscalYearStart: parsed.fiscalYearStart,
    fiscalYearEnd: parsed.fiscalYearEnd,
  };

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: "ratio_rent" },
      create: { key: "ratio_rent", value: String(parsed.ratioRent) },
      update: { value: String(parsed.ratioRent) },
    }),
    prisma.setting.upsert({
      where: { key: "ratio_telecom" },
      create: { key: "ratio_telecom", value: String(parsed.ratioTelecom) },
      update: { value: String(parsed.ratioTelecom) },
    }),
    prisma.setting.upsert({
      where: { key: "ratio_utilities" },
      create: { key: "ratio_utilities", value: String(parsed.ratioUtilities) },
      update: { value: String(parsed.ratioUtilities) },
    }),
    prisma.setting.upsert({
      where: { key: "business_profile" },
      create: { key: "business_profile", value: JSON.stringify(profile) },
      update: { value: JSON.stringify(profile) },
    }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/journal/new");
}
