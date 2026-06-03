import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function createPrisma() {
  // Turso（クラウド）または ローカルSQLite
  const url = process.env.DATABASE_URL ?? "file:../data/bookkeeping.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  const libsql = createClient({ url, authToken });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
