import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaQueryCount?: number;
  prismaQueryCounterAttached?: boolean;
};

const queryCountingEnabled = process.env.PERF_QUERY_COUNT === "1";
const logConfig: Prisma.PrismaClientOptions["log"] = queryCountingEnabled
  ? [{ emit: "event", level: "query" }, "error", "warn"]
  : ["error", "warn"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: logConfig });

if (queryCountingEnabled && !globalForPrisma.prismaQueryCounterAttached) {
  const prismaWithQueryEvents = prisma as PrismaClient<Prisma.PrismaClientOptions, "query">;
  prismaWithQueryEvents.$on("query", () => {
    globalForPrisma.prismaQueryCount = (globalForPrisma.prismaQueryCount ?? 0) + 1;
  });
  globalForPrisma.prismaQueryCounterAttached = true;
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getPrismaQueryCount() {
  return globalForPrisma.prismaQueryCount ?? 0;
}

export function resetPrismaQueryCount() {
  globalForPrisma.prismaQueryCount = 0;
}
