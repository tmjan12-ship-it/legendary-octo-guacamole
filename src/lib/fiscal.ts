import { prisma } from "./prisma";

export type FiscalYearRange = {
  year: number;
  start: Date;
  end: Date;
};

/**
 * 会計年度の開始日・終了日を返す。
 * 個人事業主は基本 1/1〜12/31 だが、settingsで上書き可能。
 */
export async function getFiscalYearRange(year: number): Promise<FiscalYearRange> {
  const profile = await prisma.setting.findUnique({
    where: { key: "business_profile" },
  });
  let startMd = "01-01";
  let endMd = "12-31";
  if (profile) {
    try {
      const p = JSON.parse(profile.value) as {
        fiscalYearStart?: string;
        fiscalYearEnd?: string;
      };
      if (p.fiscalYearStart) startMd = p.fiscalYearStart;
      if (p.fiscalYearEnd) endMd = p.fiscalYearEnd;
    } catch {
      // ignore parse error
    }
  }
  const start = new Date(`${year}-${startMd}T00:00:00`);
  const end = new Date(`${year}-${endMd}T23:59:59.999`);
  return { year, start, end };
}

export function yen(n: number): string {
  if (n === 0) return "-";
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.abs(n).toLocaleString("ja-JP")}`;
}
