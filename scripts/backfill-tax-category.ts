/**
 * 既存仕訳の各明細に、templateKey から推定した taxCategory を埋める。
 *   npm run db:backfill:tax
 *
 * 既に taxCategory が入っている明細はスキップ。
 * テンプレと勘定科目が一致しない明細もスキップ（安全側）。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parsePattern } from "../src/lib/templates";

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.journalTemplate.findMany();
  const tmplMap = new Map(
    templates.map((t) => [t.key, parsePattern(t.pattern)] as const),
  );

  const entries = await prisma.journalEntry.findMany({
    include: { lines: { orderBy: { lineOrder: "asc" } } },
  });

  let updated = 0;
  let skipped = 0;

  for (const e of entries) {
    if (!e.templateKey) {
      skipped += e.lines.length;
      continue;
    }
    const pattern = tmplMap.get(e.templateKey);
    if (!pattern) {
      skipped += e.lines.length;
      continue;
    }
    for (const l of e.lines) {
      if (l.taxCategory) {
        skipped++;
        continue;
      }
      const p = pattern.lines[l.lineOrder];
      if (!p || p.accountCode !== l.accountCode || !p.taxCategory) {
        skipped++;
        continue;
      }
      await prisma.journalLine.update({
        where: { id: l.id },
        data: { taxCategory: p.taxCategory },
      });
      updated++;
    }
  }
  console.log(`Backfilled ${updated} lines (skipped ${skipped})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
