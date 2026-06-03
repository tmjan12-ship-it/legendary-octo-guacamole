"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15MB

async function saveFile(
  buf: Buffer,
  filename: string,
  journalDate: Date,
): Promise<string> {
  // Vercel Blob が使える場合はクラウドへ、なければローカルへ
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const safeName = filename.replace(/[^\w.\-]/g, "_");
    const y = journalDate.getFullYear();
    const m = String(journalDate.getMonth() + 1).padStart(2, "0");
    const blob = await put(`attachments/${y}/${m}/${safeName}`, buf, {
      access: "public",
    });
    return blob.url;
  }
  // ローカル保存（Mac起動時）
  const ATTACH_ROOT = path.join(process.cwd(), "data", "attachments");
  const y = journalDate.getFullYear();
  const m = String(journalDate.getMonth() + 1).padStart(2, "0");
  const hash = createHash("sha256").update(buf).digest("hex");
  const safeName = `${hash.slice(0, 16)}_${filename.replace(/[^\w.\-]/g, "_")}`;
  const dir = path.join(ATTACH_ROOT, String(y), m);
  await fs.mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, safeName);
  await fs.writeFile(storagePath, buf);
  return path.relative(process.cwd(), storagePath);
}

export async function uploadAttachment(journalId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("ファイルが選択されていません");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ファイルサイズは15MB以下にしてください");
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(
      `対応していないファイル形式です（${[...ALLOWED_EXT].join(", ")} のみ）`,
    );
  }

  const entry = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: journalId },
  });

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  const storagePath = await saveFile(buf, file.name, entry.entryDate);

  await prisma.$transaction(async (tx) => {
    await tx.attachment.create({
      data: { journalId, filename: file.name, storagePath, fileHash: hash },
    });
    await tx.auditLog.create({
      data: {
        journalId,
        action: "attach",
        afterJson: JSON.stringify({ filename: file.name, hash, size: buf.length }),
      },
    });
  });

  revalidatePath(`/journal/${journalId}`);
}

export async function deleteAttachment(attachmentId: string, journalId: string) {
  await prisma.$transaction(async (tx) => {
    const a = await tx.attachment.findUniqueOrThrow({
      where: { id: attachmentId },
    });
    await tx.attachment.delete({ where: { id: attachmentId } });
    await tx.auditLog.create({
      data: {
        journalId,
        action: "detach",
        beforeJson: JSON.stringify(a),
      },
    });
  });
  // 物理ファイルは残す（電子帳簿保存法の真実性確保）
  revalidatePath(`/journal/${journalId}`);
}
