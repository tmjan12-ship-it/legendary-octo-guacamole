-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL DEFAULT '160',
    "acquisitionDate" DATETIME NOT NULL,
    "acquisitionCost" INTEGER NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'straight_line',
    "businessUseRatio" REAL NOT NULL DEFAULT 1.0,
    "isDisposed" BOOLEAN NOT NULL DEFAULT false,
    "disposalDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DepreciationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "journalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepreciationRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FixedAsset_isDisposed_idx" ON "FixedAsset"("isDisposed");

-- CreateIndex
CREATE INDEX "DepreciationRecord_fiscalYear_idx" ON "DepreciationRecord"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationRecord_assetId_fiscalYear_key" ON "DepreciationRecord"("assetId", "fiscalYear");
