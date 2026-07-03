import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BudgetAllocationClient } from "./_components/budget-allocation-client";
import { WalletBudgetClient } from "./_components/wallet-budget-client";
import { calculateSourceNet } from "@/lib/budget-wallets";
import { getBudgetPlanDashboard } from "@/lib/budget-plan-service";

export default async function BudgetAllocationPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const allowedRoles = ["SUPER_ADMIN", "EXECUTIVE", "FINANCE"];
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Fetch all fund sources
  const fundSources = await prisma.fundSource.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { projects: true }
      }
    }
  });

  // Map to plain objects so Decimal is serialized as a number
  const mappedSources = fundSources.map((fs) => ({
    id: fs.id,
    name: fs.name,
    budgetAmount: Number(fs.budgetAmount),
    projectCount: fs._count.projects,
  }));

  try {
    const [academicYears, fiscalYears, latestPlan] = await Promise.all([
      prisma.academicYear.findMany({ orderBy: { yearName: "desc" } }),
      prisma.fiscalYear.findMany({ orderBy: { yearName: "desc" } }),
      prisma.budgetPlan.findFirst({
        include: {
          academicYear: true,
          fiscalYear: true,
          sourceAccounts: { include: { fundSource: true, entries: { orderBy: { entryDate: "desc" } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const dashboard = latestPlan ? await getBudgetPlanDashboard(latestPlan.id) : null;
    const [transfers, operatingExpenses] = latestPlan ? await Promise.all([
      prisma.budgetTransferRequest.findMany({ where: { budgetPlanId: latestPlan.id }, include: { fromWallet: true, toWallet: true }, orderBy: { createdAt: "desc" } }),
      prisma.operatingExpense.findMany({ where: { budgetPlanId: latestPlan.id }, include: { wallet: true }, orderBy: { createdAt: "desc" } }),
    ]) : [[], []];
    const plan = latestPlan && dashboard ? {
      id: latestPlan.id,
      name: latestPlan.name,
      status: latestPlan.status,
      academicYearName: latestPlan.academicYear.yearName,
      fiscalYearName: latestPlan.fiscalYear.yearName,
      formula: latestPlan.percentageSnapshot as never,
      sourceAccounts: latestPlan.sourceAccounts.map((account) => ({
        id: account.id,
        code: account.fundSource.code ?? "",
        name: account.fundSource.name,
        net: calculateSourceNet(account.entries.map((entry) => ({ entryType: entry.entryType, amount: entry.amount }))),
        entries: account.entries.map((entry) => ({ id: entry.id, entryType: entry.entryType, amount: Number(entry.amount), description: entry.description, documentNo: entry.documentNo, entryDate: entry.entryDate.toISOString() })),
      })),
      wallets: dashboard.wallets.map((wallet) => ({
        id: wallet.id,
        code: wallet.code,
        name: wallet.name,
        spendMode: wallet.spendMode,
        balance: wallet.balance,
      })),
      transfers: transfers.map((transfer) => ({ id: transfer.id, fromWalletName: transfer.fromWallet.name, toWalletName: transfer.toWallet.name, amount: Number(transfer.amount), reason: transfer.reason, status: transfer.status })),
      operatingExpenses: operatingExpenses.map((expense) => ({ id: expense.id, walletName: expense.wallet.name, amount: Number(expense.amount), description: expense.description, status: expense.status })),
    } : null;

    return <WalletBudgetClient role={session.user.role} academicYears={academicYears.map((year) => ({ id: year.id, yearName: year.yearName }))} fiscalYears={fiscalYears.map((year) => ({ id: year.id, yearName: year.yearName }))} plan={plan} />;
  } catch (error) {
    console.warn("Wallet budget schema is not deployed; showing the legacy allocation screen.", error);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        ระบบกระเป๋าเงินพร้อมในโค้ดแล้ว แต่ migration ยังไม่ถูก deploy จึงแสดงหน้าจัดสรรเดิมชั่วคราว
      </div>
      <BudgetAllocationClient initialSources={mappedSources} role={session.user.role} />
    </div>
  );
}
