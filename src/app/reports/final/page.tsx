import Link from "next/link";
import { getFiscalYearRange, yen } from "@/lib/fiscal";
import {
  computeBalances,
  buildIncomeStatement,
  buildBalanceSheet,
} from "@/lib/financial-statements";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string }>;

const BLUE_RETURN_DEDUCTION = 650_000; // 青色申告特別控除（65万円）

export default async function FinalReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());
  const { start, end } = await getFiscalYearRange(year);

  const balances = await computeBalances(start, end);
  const pl = buildIncomeStatement(balances);
  const bs = buildBalanceSheet(balances, pl.netIncome);

  const profileSetting = await prisma.setting.findUnique({
    where: { key: "business_profile" },
  });
  let profile: {
    name?: string;
    tradeName?: string;
    address?: string;
    taxOffice?: string;
  } = {};
  if (profileSetting) {
    try {
      profile = JSON.parse(profileSetting.value);
    } catch {}
  }

  const taxableIncome = Math.max(0, pl.netIncome - BLUE_RETURN_DEDUCTION);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">青色申告決算書（{year}年度）</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/reports/final?year=${year - 1}`}
            className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-100"
          >
            ← {year - 1}
          </Link>
          <Link
            href={`/reports/final?year=${year + 1}`}
            className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-100"
          >
            {year + 1} →
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900 print:hidden">
        <strong>使い方：</strong> 「印刷 / PDF保存」で
        Ctrl+P → 「PDFとして保存」を選択するとPDF化できます。確定申告書等作成コーナーへの取込はF6の e-Tax XTX 出力をご利用ください。
      </div>

      {/* 表紙 */}
      <section className="bg-white border border-slate-300 rounded p-8 print:border-none print:p-4">
        <div className="text-center space-y-4">
          <div className="text-sm">令和{year - 2018}年分</div>
          <h2 className="text-3xl font-bold">所得税青色申告決算書（一般用）</h2>
          <div className="text-sm">
            {format(start, "yyyy年M月d日")} 〜 {format(end, "yyyy年M月d日")}
          </div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 text-sm">
          <FieldRow label="氏名" value={profile.name ?? "（未設定）"} />
          <FieldRow label="屋号" value={profile.tradeName ?? ""} />
          <FieldRow label="住所" value={profile.address ?? "（未設定）"} />
          <FieldRow label="納税地" value={profile.taxOffice ?? "（未設定）"} />
        </div>
      </section>

      {/* 損益計算書 */}
      <section className="bg-white border border-slate-300 rounded p-8 print:border-none print:p-4 page-break-before">
        <h2 className="text-xl font-bold text-center mb-6">損益計算書</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-700">
              <th className="text-left py-2">科目</th>
              <th className="text-right py-2 w-40">金額</th>
            </tr>
          </thead>
          <tbody>
            <SectionRow label="売上（収益）" />
            {pl.revenueLines.map((b) => (
              <DataRow key={b.code} name={b.name} amount={b.closing} />
            ))}
            <TotalRow label="売上合計" amount={pl.totalRevenue} />

            <SectionRow label="経費" />
            {pl.expenseLines.map((b) => (
              <DataRow key={b.code} name={b.name} amount={b.closing} />
            ))}
            <TotalRow label="経費合計" amount={pl.totalExpense} />

            <tr className="border-t-2 border-slate-700 font-bold text-base">
              <td className="py-2">差引金額（所得金額）</td>
              <td className="text-right py-2">{yen(pl.netIncome)}</td>
            </tr>
            <tr className="text-sm text-slate-600">
              <td className="py-1">青色申告特別控除</td>
              <td className="text-right py-1">- {yen(BLUE_RETURN_DEDUCTION)}</td>
            </tr>
            <tr className="border-t-2 border-slate-700 font-bold text-base">
              <td className="py-2">所得金額（控除後）</td>
              <td className="text-right py-2 text-emerald-700">
                {yen(taxableIncome)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="text-xs text-slate-700 mt-4">
          ※ 青色申告特別控除65万円は、複式簿記＋電子申告 or 電子帳簿保存が前提です。本ツールは両要件を満たします。
        </div>
      </section>

      {/* 貸借対照表 */}
      <section className="bg-white border border-slate-300 rounded p-8 print:border-none print:p-4 page-break-before">
        <h2 className="text-xl font-bold text-center mb-6">
          貸借対照表（{format(end, "yyyy年M月d日")} 現在）
        </h2>
        <div className="grid grid-cols-2 gap-8">
          <table className="text-sm">
            <thead>
              <tr className="border-b-2 border-slate-700">
                <th className="text-left py-2">資産の部</th>
                <th className="text-right py-2 w-32">金額</th>
              </tr>
            </thead>
            <tbody>
              {bs.assetLines.map((b) => (
                <DataRow key={b.code} name={b.name} amount={b.closing} />
              ))}
              <TotalRow label="資産合計" amount={bs.totalAssets} />
            </tbody>
          </table>
          <table className="text-sm">
            <thead>
              <tr className="border-b-2 border-slate-700">
                <th className="text-left py-2">負債・純資産の部</th>
                <th className="text-right py-2 w-32">金額</th>
              </tr>
            </thead>
            <tbody>
              <SectionRow label="負債" />
              {bs.liabilityLines.map((b) => (
                <DataRow key={b.code} name={b.name} amount={b.closing} />
              ))}
              <TotalRow label="負債合計" amount={bs.totalLiabilities} />

              <SectionRow label="純資産" />
              {bs.equityLines.map((b) => (
                <DataRow key={b.code} name={b.name} amount={b.closing} />
              ))}
              <DataRow name="当期純利益" amount={bs.netIncome} />
              <TotalRow label="純資産合計" amount={bs.totalEquity} />

              <tr className="border-t-2 border-slate-700 font-bold">
                <td className="py-2">負債・純資産 合計</td>
                <td className="text-right py-2">
                  {yen(bs.totalLiabilities + bs.totalEquity)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {bs.totalAssets !== bs.totalLiabilities + bs.totalEquity && (
          <div className="mt-4 bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-700">
            ⚠ 資産合計と負債・純資産合計が一致していません。仕訳に誤りがある可能性があります。
            差額: {yen(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity))}
          </div>
        )}
      </section>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-300 py-1">
      <span className="text-slate-600 mr-3 inline-block w-20">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="bg-slate-50">
      <td colSpan={2} className="px-2 py-1 text-xs font-semibold text-slate-600">
        {label}
      </td>
    </tr>
  );
}

function DataRow({ name, amount }: { name: string; amount: number }) {
  return (
    <tr className="border-b border-slate-200">
      <td className="py-1 pl-3">{name}</td>
      <td className="text-right py-1">{amount === 0 ? "-" : yen(amount)}</td>
    </tr>
  );
}

function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className="border-t border-slate-400 font-medium">
      <td className="py-1.5">{label}</td>
      <td className="text-right py-1.5">{yen(amount)}</td>
    </tr>
  );
}

