import "server-only";

import { prisma } from "@/lib/prisma";
import { BudgetActor, BudgetDomainError, getBudgetPlanDashboard, requireBudgetRole, withSerializableRetry } from "@/lib/budget-plan-service";
import { WalletCode } from "@/lib/budget-wallets";
import { resolveLegacyWalletCode } from "@/lib/legacy-budget-migration";

function normalizedSourceCode(code: string | null, name: string | null): string | null {
  if (code) return code;
  if (name?.includes("กิจกรรมพัฒน")) return "LEARNER_ACTIVITY";
  if (name?.includes("รายได้สถานศึกษา")) return "SCHOOL_INCOME";
  if (name?.includes("อุดหนุน")) return "GENERAL_SUBSIDY";
  return null;
}

export async function buildLegacyBudgetMigrationPreview(input: {
  actor: BudgetActor;
  budgetPlanId: string;
}) {
  requireBudgetRole(input.actor, ["SUPER_ADMIN"]);
  const dashboard = await getBudgetPlanDashboard(input.budgetPlanId);
  if (dashboard.status !== "LOCKED") throw new BudgetDomainError("ต้องอนุมัติและล็อกแผนก่อน migration");
  const projects = await prisma.project.findMany({
    where: { academicYearId: dashboard.academicYearId },
    include: { department: true, fundSource: true, transactions: true },
    orderBy: { projectCode: "asc" },
  });

  const walletByCode = new Map(dashboard.wallets.map((wallet) => [wallet.code as WalletCode, wallet]));
  const totals = new Map<WalletCode, { allocation: number; expense: number; projects: number }>();
  const unresolved: Array<{ projectId: string; projectCode: string; projectName: string; reason: string }> = [];
  let legacyAllocation = 0;
  let legacyExpense = 0;

  for (const project of projects) {
    const allocation = project.transactions.filter((entry) => entry.transactionType === "ALLOCATE").reduce((sum, entry) => sum + Number(entry.amount), 0) || Number(project.budgetApproved);
    const expense = project.transactions.filter((entry) => entry.transactionType === "EXPENSE").reduce((sum, entry) => sum + Number(entry.amount), 0);
    legacyAllocation += allocation;
    legacyExpense += expense;
    const code = resolveLegacyWalletCode(normalizedSourceCode(project.fundSource?.code ?? null, project.fundSource?.name ?? null), project.department?.name ?? null);
    if (!code) {
      unresolved.push({ projectId: project.id, projectCode: project.projectCode, projectName: project.projectName, reason: "ไม่สามารถจับคู่แหล่งเงินหรือกลุ่มบริหารกับกระเป๋า" });
      continue;
    }
    const current = totals.get(code) ?? { allocation: 0, expense: 0, projects: 0 };
    current.allocation += allocation;
    current.expense += expense;
    current.projects += 1;
    totals.set(code, current);
  }

  const walletReconciliation = [...walletByCode.entries()].map(([code, wallet]) => {
    const legacy = totals.get(code) ?? { allocation: 0, expense: 0, projects: 0 };
    return {
      walletId: wallet.id,
      code,
      name: wallet.name,
      allocated: wallet.balance.allocated,
      legacyProjectAllocation: legacy.allocation,
      legacyExpense: legacy.expense,
      projectedAvailable: wallet.balance.availableBalance - legacy.allocation,
      projectCount: legacy.projects,
    };
  });
  const negativeWallets = walletReconciliation.filter((wallet) => wallet.projectedAvailable < -0.009);
  const preview = {
    budgetPlanId: input.budgetPlanId,
    projectCount: projects.length,
    legacyAllocation,
    legacyExpense,
    unresolved,
    negativeWallets,
    wallets: walletReconciliation,
    canConfirm: unresolved.length === 0 && negativeWallets.length === 0,
  };

  const run = await prisma.budgetMigrationRun.create({
    data: {
      budgetPlanId: input.budgetPlanId,
      preview,
      legacyProjectCount: projects.length,
      legacyAllocation,
      legacyExpense,
    },
  });
  return { runId: run.id, ...preview };
}

export async function confirmLegacyBudgetMigration(input: {
  actor: BudgetActor;
  migrationRunId: string;
  reason: string;
  mappings?: Record<string, WalletCode>;
  covers?: Record<string, WalletCode>;
}) {
  requireBudgetRole(input.actor, ["SUPER_ADMIN"]);
  if (!input.reason.trim()) throw new BudgetDomainError("ต้องระบุเหตุผลยืนยัน migration");

  return withSerializableRetry(async (db) => {
    const run = await db.budgetMigrationRun.findUnique({
      where: { id: input.migrationRunId },
      include: { budgetPlan: { include: { wallets: true } } },
    });
    if (!run) throw new BudgetDomainError("ไม่พบ migration preview", 404);
    if (run.status !== "PREVIEWED") throw new BudgetDomainError("migration นี้ถูกยืนยันแล้ว");
    
    const preview = run.preview as {
      canConfirm?: boolean;
      unresolved?: Array<{ projectId: string; projectCode: string; projectName?: string; reason: string }>;
      negativeWallets?: Array<{ walletId: string; code: string; name: string; projectedAvailable: number }>;
      wallets: Array<{ walletId: string; code: string; name: string; projectedAvailable: number }>;
    };

    const unresolvedIds = preview.unresolved?.map((u) => u.projectId) || [];
    const negativeWalletCodes = preview.negativeWallets?.map((w) => w.code) || [];

    // Verify all unresolved projects are mapped
    for (const projId of unresolvedIds) {
      if (!input.mappings || !input.mappings[projId]) {
        throw new BudgetDomainError(`ยังไม่ได้ระบุกระเป๋าเงินสำหรับโครงการที่จับคู่ไม่ได้ (${projId})`);
      }
    }

    // Verify all negative wallets are covered
    for (const code of negativeWalletCodes) {
      if (!input.covers || !input.covers[code]) {
        throw new BudgetDomainError(`ยังไม่ได้ระบุแหล่งเงินชดเชยสำหรับกระเป๋าที่ยอดติดลบ (${code})`);
      }
    }

    const projects = await db.project.findMany({
      where: { academicYearId: run.budgetPlan.academicYearId },
      include: { department: true, fundSource: true, transactions: true, activities: true },
    });
    const walletByCode = new Map(run.budgetPlan.wallets.map((wallet) => [wallet.code as WalletCode, wallet]));

    // Process negative wallet covers
    if (input.covers) {
      for (const [negCode, srcCode] of Object.entries(input.covers)) {
        if (negCode === srcCode) {
          throw new BudgetDomainError(`ไม่สามารถใช้กระเป๋าเงินเดียวกันเพื่อโอนเงินชดเชยได้ (${negCode})`);
        }

        const negWallet = run.budgetPlan.wallets.find((w) => w.code === negCode);
        const srcWallet = run.budgetPlan.wallets.find((w) => w.code === srcCode);
        if (!negWallet || !srcWallet) {
          throw new BudgetDomainError(`ไม่พบกระเป๋าเงินสำหรับชดเชยยอดติดลบ (${negCode} หรือ ${srcCode})`);
        }

        const recon = preview.wallets.find((w) => w.code === negCode);
        const deficit = recon ? Math.abs(recon.projectedAvailable) : 0;
        if (deficit <= 0.009) continue;

        // Create TRANSFER_OUT from source wallet
        await db.walletLedgerEntry.create({
          data: {
            walletId: srcWallet.id,
            entryType: "TRANSFER_OUT",
            amount: deficit,
            description: `โอนงบชดเชยเพื่อย้ายข้อมูลเดิมไปยัง ${negWallet.name}`,
            referenceType: "MIGRATION",
            referenceId: `${run.id}:adjust-src:${negWallet.code}`,
            postedById: input.actor.id,
          },
        });

        // Create TRANSFER_IN to negative wallet
        await db.walletLedgerEntry.create({
          data: {
            walletId: negWallet.id,
            entryType: "TRANSFER_IN",
            amount: deficit,
            description: `รับโอนงบชดเชยเพื่อย้ายข้อมูลเดิมจาก ${srcWallet.name}`,
            referenceType: "MIGRATION",
            referenceId: `${run.id}:adjust-neg:${negWallet.code}`,
            postedById: input.actor.id,
          },
        });
      }
    }

    for (const project of projects) {
      const allocation = project.transactions.filter((entry) => entry.transactionType === "ALLOCATE").reduce((sum, entry) => sum + Number(entry.amount), 0) || Number(project.budgetApproved);
      const expense = project.transactions.filter((entry) => entry.transactionType === "EXPENSE").reduce((sum, entry) => sum + Number(entry.amount), 0);
      
      let code = resolveLegacyWalletCode(normalizedSourceCode(project.fundSource?.code ?? null, project.fundSource?.name ?? null), project.department?.name ?? null);
      if (!code && input.mappings && input.mappings[project.id]) {
        code = input.mappings[project.id];
      }
      if (!code) throw new BudgetDomainError(`จับคู่กระเป๋าโครงการ ${project.projectCode} ไม่ได้`);
      
      const wallet = walletByCode.get(code);
      if (!wallet) throw new BudgetDomainError(`ไม่พบกระเป๋า ${code}`);

      const activityBudgetTotal = project.activities.reduce((sum, activity) => sum + Number(activity.budget), 0);
      let targetActivity = project.activities[0] ?? null;
      if (!targetActivity || Math.abs(activityBudgetTotal - allocation) > 0.009) {
        targetActivity = await db.projectActivity.create({
          data: {
            projectId: project.id,
            name: "วงเงินโครงการเดิมที่ยังไม่จำแนก",
            budget: Math.max(0, allocation - activityBudgetTotal),
            fundSourceId: project.fundSourceId,
          },
        });
      }
      const existingFunding = await db.activityFundingAllocation.findFirst({ where: { activityId: targetActivity.id, walletId: wallet.id } });
      if (!existingFunding) {
        await db.activityFundingAllocation.create({
          data: { activityId: targetActivity.id, walletId: wallet.id, requestedAmount: allocation, approvedAmount: allocation },
        });
      }
      await db.walletLedgerEntry.create({
        data: { walletId: wallet.id, entryType: "COMMITMENT", amount: allocation, description: `ย้ายวงเงินโครงการเดิม ${project.projectCode}`, referenceType: "MIGRATION", referenceId: `${run.id}:${project.id}:commit`, postedById: input.actor.id },
      });
      if (expense > 0) {
        await db.walletLedgerEntry.createMany({
          data: [
            { walletId: wallet.id, entryType: "COMMITMENT_RELEASE", amount: expense, description: `ย้ายรายจ่ายโครงการเดิม ${project.projectCode}`, referenceType: "MIGRATION", referenceId: `${run.id}:${project.id}:expense`, postedById: input.actor.id },
            { walletId: wallet.id, entryType: "DISBURSEMENT", amount: expense, description: `ย้ายรายจ่ายโครงการเดิม ${project.projectCode}`, referenceType: "MIGRATION", referenceId: `${run.id}:${project.id}:expense`, postedById: input.actor.id },
          ],
        });
      }
    }

    await db.budgetMigrationRun.update({ where: { id: run.id }, data: { status: "CONFIRMED", confirmedById: input.actor.id, confirmedAt: new Date() } });
    await db.auditLog.create({ data: { userId: input.actor.id, action: "LEGACY_BUDGET_MIGRATION_CONFIRM", entityName: "BudgetMigrationRun", entityId: run.id, metadata: { reason: input.reason, projectCount: projects.length, mappings: input.mappings, covers: input.covers } } });
    return { ok: true, projectCount: projects.length };
  });
}
