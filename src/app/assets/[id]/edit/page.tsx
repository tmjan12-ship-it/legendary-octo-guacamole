import { prisma } from "@/lib/prisma";
import AssetForm from "../../AssetForm";
import { saveAsset } from "../../actions";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [asset, accounts] = await Promise.all([
    prisma.fixedAsset.findUnique({ where: { id } }),
    prisma.account.findMany({
      where: { type: "asset", isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  if (!asset) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">固定資産を編集</h1>
        <Link
          href="/assets"
          className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100"
        >
          ← 一覧へ
        </Link>
      </div>
      <AssetForm
        assetAccounts={accounts}
        action={saveAsset}
        initial={{
          id: asset.id,
          name: asset.name,
          accountCode: asset.accountCode,
          acquisitionDate: format(asset.acquisitionDate, "yyyy-MM-dd"),
          acquisitionCost: asset.acquisitionCost,
          usefulLifeYears: asset.usefulLifeYears,
          businessUseRatio: asset.businessUseRatio,
          notes: asset.notes,
        }}
        submitLabel="変更を保存"
      />
    </div>
  );
}
