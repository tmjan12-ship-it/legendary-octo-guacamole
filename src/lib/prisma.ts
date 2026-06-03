import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrisma() {
  const url = process.env.DATABASE_URL ?? "file:../data/bookkeeping.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  const adapter = new PrismaLibSql({ url, authToken });
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
