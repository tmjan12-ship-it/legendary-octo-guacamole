// 減価償却計算ロジック（定額法）
// 個人事業主向け：残存価額0、最終年は備忘価額1円を残す

export type AssetForCalc = {
  acquisitionDate: Date;
  acquisitionCost: number;
  usefulLifeYears: number;
  businessUseRatio: number;
  isDisposed: boolean;
  disposalDate: Date | null;
};

export type YearlyDepreciation = {
  fiscalYear: number;
  monthsInYear: number; // その年で償却対象となる月数
  fullYearAmount: number; // 月割前の年額
  amount: number; // 月割後の償却額（事業按分前）
  businessAmount: number; // 事業按分後（仕訳に計上する金額）
  cumulative: number; // 期末累計（事業按分前）
  bookValue: number; // 期末簿価（事業按分前）
};

/**
 * 月単位の年度開始月～終了月（fiscalYear基準の12ヶ月）に対し、
 * 資産が償却対象となる月数を返す。
 */
function monthsInFiscalYear(
  asset: AssetForCalc,
  fiscalYear: number,
): number {
  // 1月始まり前提（個人事業主の通常）
  const fyStart = new Date(fiscalYear, 0, 1);
  const fyEnd = new Date(fiscalYear, 11, 31);

  const acqStart = new Date(
    asset.acquisitionDate.getFullYear(),
    asset.acquisitionDate.getMonth(),
    1,
  );
  const periodStart = acqStart > fyStart ? acqStart : fyStart;

  let periodEnd = fyEnd;
  if (asset.isDisposed && asset.disposalDate) {
    const disposalMonthEnd = new Date(
      asset.disposalDate.getFullYear(),
      asset.disposalDate.getMonth() + 1,
      0,
    );
    if (disposalMonthEnd < periodEnd) periodEnd = disposalMonthEnd;
  }

  if (periodStart > periodEnd) return 0;
  const months =
    (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
    (periodEnd.getMonth() - periodStart.getMonth()) +
    1;
  return Math.max(0, Math.min(12, months));
}

/**
 * 資産の全年度の減価償却額を計算する。
 * 取得年から耐用年数いっぱい（+月割端数年）まで。
 */
export function calculateYearlySchedule(
  asset: AssetForCalc,
): YearlyDepreciation[] {
  const result: YearlyDepreciation[] = [];
  const acqYear = asset.acquisitionDate.getFullYear();
  const fullYearAmount = Math.floor(
    asset.acquisitionCost / asset.usefulLifeYears,
  );

  let cumulative = 0;
  // 最大耐用年数+1年（取得年が月割の場合、最終年が翌年にずれる）
  for (let y = 0; y <= asset.usefulLifeYears; y++) {
    const fiscalYear = acqYear + y;
    const months = monthsInFiscalYear(asset, fiscalYear);
    if (months === 0) break;

    let amount = Math.floor((fullYearAmount * months) / 12);

    // 累計が取得価額-1円を超えないように調整（備忘価額1円残し）
    const remaining = asset.acquisitionCost - 1 - cumulative;
    if (remaining <= 0) break;
    if (amount > remaining) amount = remaining;

    cumulative += amount;
    const businessAmount = Math.floor(amount * asset.businessUseRatio);

    result.push({
      fiscalYear,
      monthsInYear: months,
      fullYearAmount,
      amount,
      businessAmount,
      cumulative,
      bookValue: asset.acquisitionCost - cumulative,
    });

    if (asset.isDisposed && asset.disposalDate) {
      const disposalYear = asset.disposalDate.getFullYear();
      if (fiscalYear >= disposalYear) break;
    }
  }

  return result;
}

export function getDepreciationForYear(
  asset: AssetForCalc,
  fiscalYear: number,
): YearlyDepreciation | null {
  const schedule = calculateYearlySchedule(asset);
  return schedule.find((s) => s.fiscalYear === fiscalYear) ?? null;
}
