"use client";

import { useState, useMemo } from "react";
import { calculateYearlySchedule } from "@/lib/depreciation";

type Account = {
  code: string;
  name: string;
};

type Props = {
  assetAccounts: Account[];
  action: (formData: FormData) => Promise<void>;
  initial?: {
    id?: string;
    name?: string;
    accountCode?: string;
    acquisitionDate?: string;
    acquisitionCost?: number;
    usefulLifeYears?: number;
    businessUseRatio?: number;
    notes?: string | null;
  };
  submitLabel?: string;
};

const YEN = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default function AssetForm({
  assetAccounts,
  action,
  initial,
  submitLabel = "登録",
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [accountCode, setAccountCode] = useState(
    initial?.accountCode ?? "160",
  );
  const [acquisitionDate, setAcquisitionDate] = useState(
    initial?.acquisitionDate ?? new Date().toISOString().slice(0, 10),
  );
  const [acquisitionCost, setAcquisitionCost] = useState(
    initial?.acquisitionCost ? String(initial.acquisitionCost) : "",
  );
  const [usefulLifeYears, setUsefulLifeYears] = useState(
    initial?.usefulLifeYears ? String(initial.usefulLifeYears) : "4",
  );
  const [businessUseRatio, setBusinessUseRatio] = useState(
    initial?.businessUseRatio ? String(initial.businessUseRatio) : "1.0",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const preview = useMemo(() => {
    const cost = Number(acquisitionCost);
    const life = Number(usefulLifeYears);
    const ratio = Number(businessUseRatio);
    if (!cost || !life || !ratio) return [];
    try {
      return calculateYearlySchedule({
        acquisitionDate: new Date(acquisitionDate + "T00:00:00"),
        acquisitionCost: cost,
        usefulLifeYears: life,
        businessUseRatio: ratio,
        isDisposed: false,
        disposalDate: null,
      });
    } catch {
      return [];
    }
  }, [acquisitionDate, acquisitionCost, usefulLifeYears, businessUseRatio]);

  return (
    <form action={action} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="bg-white border border-slate-300 rounded p-5 space-y-4">
        <Field label="資産名">
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-slate-300 rounded px-2 py-1.5"
            placeholder="例: MacBook Pro 14inch M3"
          />
        </Field>

        <Field label="勘定科目">
          <select
            name="accountCode"
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5"
          >
            {assetAccounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="取得日">
            <input
              type="date"
              name="acquisitionDate"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              required
              className="border border-slate-300 rounded px-2 py-1.5"
            />
          </Field>
          <Field label="取得価額（円）">
            <input
              type="number"
              name="acquisitionCost"
              value={acquisitionCost}
              onChange={(e) => setAcquisitionCost(e.target.value)}
              required
              min="1"
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-right"
              placeholder="例: 280000"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="耐用年数（年）">
            <input
              type="number"
              name="usefulLifeYears"
              value={usefulLifeYears}
              onChange={(e) => setUsefulLifeYears(e.target.value)}
              required
              min="1"
              max="50"
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-right"
            />
            <div className="text-xs text-slate-700 mt-1">
              PC:4年 / オフィス家具:8〜15年 / カメラ:5年 / 書籍:1年（消耗品扱い推奨）
            </div>
          </Field>
          <Field label="事業按分率（0〜1）">
            <input
              type="number"
              name="businessUseRatio"
              value={businessUseRatio}
              onChange={(e) => setBusinessUseRatio(e.target.value)}
              required
              min="0"
              max="1"
              step="0.05"
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-right"
            />
            <div className="text-xs text-slate-700 mt-1">
              プライベートと共用なら 0.7 など。100%事業なら 1.0
            </div>
          </Field>
        </div>

        <Field label="メモ（任意）">
          <input
            type="text"
            name="notes"
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5"
            placeholder="シリアルNo・購入店等"
          />
        </Field>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>

      {preview.length > 0 && (
        <div className="bg-white border border-slate-300 rounded p-5">
          <h2 className="font-semibold mb-3">減価償却スケジュール（プレビュー）</h2>
          <table className="w-full text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="text-left py-1">年度</th>
                <th className="text-right py-1">月数</th>
                <th className="text-right py-1">年額（按分前）</th>
                <th className="text-right py-1">事業計上額</th>
                <th className="text-right py-1">期末簿価</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((s) => (
                <tr key={s.fiscalYear} className="border-t border-slate-200">
                  <td className="py-1">{s.fiscalYear}年</td>
                  <td className="py-1 text-right">{s.monthsInYear}ヶ月</td>
                  <td className="py-1 text-right">{YEN(s.amount)}</td>
                  <td className="py-1 text-right text-blue-700 font-medium">
                    {YEN(s.businessAmount)}
                  </td>
                  <td className="py-1 text-right text-slate-600">
                    {YEN(s.bookValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-slate-700 mt-2">
            ※ 定額法、残存簿価1円残し。月割は取得月から計上開始。
          </div>
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}
