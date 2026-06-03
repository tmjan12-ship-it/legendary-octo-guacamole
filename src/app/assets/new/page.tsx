import { prisma } from "@/lib/prisma";
import AssetForm from "../AssetForm";
import { saveAsset } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const accounts = await prisma.account.findMany({
    where: { type: "asset", isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">固定資産を登録</h1>
      <AssetForm assetAccounts={accounts} action={saveAsset} />
    </div>
  );
}
