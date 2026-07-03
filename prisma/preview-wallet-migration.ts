import { PrismaClient } from "@prisma/client";
import { DEFAULT_WALLET_PERCENTAGES, WalletCode, calculateWalletAllocations } from "../src/lib/budget-wallets";
import { resolveLegacyWalletCode } from "../src/lib/legacy-budget-migration";

const prisma = new PrismaClient();

function sourceCode(name: string | null): string | null {
  if (name?.includes("กิจกรรมพัฒน")) return "LEARNER_ACTIVITY";
  if (name?.includes("รายได้สถานศึกษา")) return "SCHOOL_INCOME";
  if (name?.includes("อุดหนุน")) return "GENERAL_SUBSIDY";
  return null;
}

async function main() {
  const [sources, projects] = await Promise.all([
    prisma.fundSource.findMany({ select: { id: true, name: true, budgetAmount: true } }),
    prisma.project.findMany({ include: { department: true, fundSource: { select: { name: true } }, transactions: true }, orderBy: { projectCode: "asc" } }),
  ]);
  const sourceAmount = (code: string) => Number(sources.find((source) => sourceCode(source.name) === code)?.budgetAmount ?? 0);
  const allocations = calculateWalletAllocations({
    generalSubsidyNet: sourceAmount("GENERAL_SUBSIDY"),
    learnerActivityNet: sourceAmount("LEARNER_ACTIVITY"),
    schoolIncomeNet: sourceAmount("SCHOOL_INCOME"),
    percentages: DEFAULT_WALLET_PERCENTAGES,
  });
  const walletUsage = new Map<WalletCode, { allocation: number; expense: number; projects: number }>();
  const unresolved: Array<{ projectCode: string; source: string | null; department: string | null }> = [];
  let legacyAllocation = 0;
  let legacyExpense = 0;
  for (const project of projects) {
    const allocation = project.transactions.filter((entry) => entry.transactionType === "ALLOCATE").reduce((sum, entry) => sum + Number(entry.amount), 0) || Number(project.budgetApproved);
    const expense = project.transactions.filter((entry) => entry.transactionType === "EXPENSE").reduce((sum, entry) => sum + Number(entry.amount), 0);
    legacyAllocation += allocation;
    legacyExpense += expense;
    const code = resolveLegacyWalletCode(sourceCode(project.fundSource?.name ?? null), project.department?.name ?? null);
    if (!code) {
      unresolved.push({ projectCode: project.projectCode, source: project.fundSource?.name ?? null, department: project.department?.name ?? null });
      continue;
    }
    const current = walletUsage.get(code) ?? { allocation: 0, expense: 0, projects: 0 };
    current.allocation += allocation;
    current.expense += expense;
    current.projects += 1;
    walletUsage.set(code, current);
  }
  const wallets = (Object.entries(allocations) as Array<[WalletCode, number]>).map(([code, allocated]) => {
    const legacy = walletUsage.get(code) ?? { allocation: 0, expense: 0, projects: 0 };
    return { code, allocated, legacyAllocation: legacy.allocation, legacyExpense: legacy.expense, projectedAvailable: allocated - legacy.allocation, projects: legacy.projects };
  });
  console.log(JSON.stringify({ projectCount: projects.length, legacyAllocation, legacyExpense, unresolved, negativeWallets: wallets.filter((wallet) => wallet.projectedAvailable < 0), wallets }, null, 2));
}

main().finally(() => prisma.$disconnect());
