import Link from "next/link";
import { getFiscalYearRange } from "@/lib/fiscal";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string }>;

export default async function EtaxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());
  await getFiscalYearRange(year); // 年度の妥当性チェック

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">e-Tax連携 / 確定申告書作成コーナー連携</h1>

      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
        <strong>v1の方針：</strong> 国税庁の「組み込み型ソフトウェア用仕様書」は年度ごとに公開され、令和{year - 2018}年分（{year}年）の正式仕様は{year + 1}年1月頃に公開予定です。本ツールはまず<strong>主要数値のCSV/XMLエクスポート</strong>を提供し、「確定申告書等作成コーナー」の入力時の根拠資料として活用してもらう方針です。正式XTXは仕様公開後に追加実装します。
      </div>

      <section className="bg-white border border-slate-300 rounded p-5 space-y-3">
        <h2 className="font-semibold">{year}年度ファイル出力</h2>
        <div className="flex flex-wrap gap-3">
          <DownloadLink
            href={`/api/reports/etax/csv?year=${year}`}
            label="決算書サマリー CSV"
            description="売上・経費の各勘定科目別の合計と所得金額をCSVでダウンロード"
          />
          <DownloadLink
            href={`/api/reports/etax/xml?year=${year}`}
            label="決算書数値 XML（暫定）"
            description="主要数値を XML 形式で。正式XTX仕様公開後に置き換え予定"
          />
          <DownloadLink
            href={`/api/reports/etax/journal-csv?year=${year}`}
            label="仕訳データ CSV（全件）"
            description="期中の全仕訳を1行1明細でCSV出力（電子帳簿保存法の引渡しデータ用）"
          />
        </div>
      </section>

      <section className="bg-white border border-slate-300 rounded p-5 space-y-3">
        <h2 className="font-semibold">確定申告書等作成コーナーの使い方</h2>
        <ol className="list-decimal list-inside text-sm space-y-1 text-slate-700">
          <li>
            <a
              href="https://www.keisan.nta.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              国税庁 確定申告書等作成コーナー
            </a>
            にアクセス
          </li>
          <li>「青色申告決算書・収支内訳書」を選択</li>
          <li>本ツールの<Link className="text-blue-600 hover:underline" href={`/reports/final?year=${year}`}>決算書</Link>を参照しながら数値を入力</li>
          <li>所得税確定申告書Bへの自動連携で完了 → e-Tax送信</li>
        </ol>
      </section>

      <div className="flex gap-2 text-sm print:hidden">
        <Link
          href={`/reports/etax?year=${year - 1}`}
          className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-100"
        >
          ← {year - 1}
        </Link>
        <Link
          href={`/reports/etax?year=${year + 1}`}
          className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-100"
        >
          {year + 1} →
        </Link>
      </div>
    </div>
  );
}

function DownloadLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex-1 min-w-64 border border-slate-300 rounded p-3 hover:bg-slate-50"
    >
      <div className="font-medium text-blue-700">{label}</div>
      <div className="text-xs text-slate-700 mt-1">{description}</div>
    </a>
  );
}
