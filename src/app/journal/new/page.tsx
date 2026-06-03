import { prisma } from "@/lib/prisma";
import { parsePattern } from "@/lib/templates";
import JournalForm from "./JournalForm";
import { saveJournal } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewJournalPage() {
  const [templates, accounts, settings] = await Promise.all([
    prisma.journalTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.setting.findMany({
      where: { key: { startsWith: "ratio_" } },
    }),
  ]);

  const ratioMap: Record<string, number> = {};
  for (const s of settings) {
    ratioMap[s.key] = Number(s.value);
  }

  const templateDTOs = templates.map((t) => ({
    key: t.key,
    label: t.label,
    pattern: parsePattern(t.pattern),
  }));

  const accountMap: Record<string, string> = {};
  for (const a of accounts) accountMap[a.code] = a.name;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仕訳入力</h1>
      <JournalForm
        templates={templateDTOs}
        accountMap={accountMap}
        ratioMap={ratioMap}
        saveAction={saveJournal}
      />
    </div>
  );
}
