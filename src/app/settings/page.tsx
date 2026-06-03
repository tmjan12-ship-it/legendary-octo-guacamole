import { prisma } from "@/lib/prisma";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

type Profile = {
  name?: string;
  tradeName?: string;
  address?: string;
  taxOffice?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
};

export default async function SettingsPage() {
  const settings = await prisma.setting.findMany();
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const profile: Profile = map.business_profile
    ? (JSON.parse(map.business_profile) as Profile)
    : {};

  const ratioRent = Number(map.ratio_rent ?? "0.7");
  const ratioTelecom = Number(map.ratio_telecom ?? "0.8");
  const ratioUtilities = Number(map.ratio_utilities ?? "0.5");

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">設定</h1>

      <form action={saveSettings} className="space-y-8">
        <section className="bg-white border border-slate-300 rounded p-5 space-y-4">
          <h2 className="font-semibold">事業按分率</h2>
          <p className="text-xs text-slate-700">
            プライベートと事業で共用する費用について、事業使用分の割合を設定します。仕訳テンプレートの自動計算で使用されます。
          </p>
          <Ratio name="ratioRent" label="家賃の事業按分率" value={ratioRent} />
          <Ratio name="ratioTelecom" label="通信費の事業按分率" value={ratioTelecom} />
          <Ratio
            name="ratioUtilities"
            label="水道光熱費の事業按分率"
            value={ratioUtilities}
          />
        </section>

        <section className="bg-white border border-slate-300 rounded p-5 space-y-4">
          <h2 className="font-semibold">事業主情報（決算書・e-Tax出力に使用）</h2>
          <Text name="name" label="氏名" defaultValue={profile.name ?? ""} />
          <Text
            name="tradeName"
            label="屋号（任意）"
            defaultValue={profile.tradeName ?? ""}
          />
          <Text
            name="address"
            label="住所"
            defaultValue={profile.address ?? ""}
          />
          <Text
            name="taxOffice"
            label="納税地の所轄税務署"
            defaultValue={profile.taxOffice ?? ""}
            placeholder="例: 渋谷税務署"
          />
          <div className="grid grid-cols-2 gap-4">
            <Text
              name="fiscalYearStart"
              label="会計年度 開始日 (MM-DD)"
              defaultValue={profile.fiscalYearStart ?? "01-01"}
              placeholder="01-01"
            />
            <Text
              name="fiscalYearEnd"
              label="会計年度 終了日 (MM-DD)"
              defaultValue={profile.fiscalYearEnd ?? "12-31"}
              placeholder="12-31"
            />
          </div>
        </section>

        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          保存
        </button>
      </form>
    </div>
  );
}

function Ratio({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-48 text-sm">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={value}
        min="0"
        max="1"
        step="0.05"
        className="w-24 border border-slate-300 rounded px-2 py-1 text-right"
      />
      <span className="text-sm text-slate-600">（0〜1の小数）</span>
    </label>
  );
}

function Text({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm text-slate-700 mb-1">{label}</div>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded px-2 py-1.5"
      />
    </label>
  );
}
