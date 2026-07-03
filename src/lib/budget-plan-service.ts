import "server-only";

import {
  BudgetPlanStatus,
  BudgetSourceEntryType,
  Prisma,
  Role,
  WalletLedgerEntryType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WALLET_FORMULA,
  FORMULA_WALLET_CODES,
  FormulaWalletCode,
  SourceEntryType,
  WalletCode,
  WalletFormulaInput,
  calculateSourceNet,
  calculateWalletAllocations,
  calculateWalletBalance,
  deriveEffectiveWalletPercentages,
  normalizeWalletFormula,
  validateWalletPercentages,
} from "@/lib/budget-wallets";

export type BudgetActor = {
  id: string;
  role: Role;
  departmentId?: string | null;
};

const SOURCE_DEFINITIONS = [
  { code: "GENERAL_SUBSIDY", name: "เงินอุดหนุนทั่วไป" },
  { code: "LEARNER_ACTIVITY", name: "เงินกิจกรรมพัฒนาผู้เรียน" },
  { code: "SCHOOL_INCOME", name: "รายได้สถานศึกษา" },
] as const;

const WALLET_DEFINITIONS: Array<{
  code: WalletCode;
  name: string;
  spendMode: "TRANSFER_ONLY" | "OPERATING" | "PROJECT_ACTIVITY" | "FLEXIBLE";
  departmentName?: string;
}> = [
  { code: "RESERVE", name: "งบสำรอง", spendMode: "TRANSFER_ONLY" },
  { code: "UTILITIES", name: "ค่าสาธารณูปโภค", spendMode: "OPERATING" },
  { code: "CENTRAL", name: "งบกลาง", spendMode: "OPERATING" },
  { code: "ACADEMIC", name: "กลุ่มบริหารวิชาการ", spendMode: "PROJECT_ACTIVITY", departmentName: "กลุ่มบริหารวิชาการ" },
  { code: "BUDGET", name: "กลุ่มบริหารงบประมาณ", spendMode: "PROJECT_ACTIVITY", departmentName: "กลุ่มบริหารงบประมาณ" },
  { code: "PERSONNEL", name: "กลุ่มบริหารงานบุคคล", spendMode: "PROJECT_ACTIVITY", departmentName: "กลุ่มบริหารงานบุคคล" },
  { code: "GENERAL", name: "กลุ่มบริหารทั่วไป", spendMode: "PROJECT_ACTIVITY", departmentName: "กลุ่มบริหารทั่วไป" },
  { code: "LEARNER_ACTIVITY", name: "กิจกรรมพัฒนาผู้เรียน", spendMode: "PROJECT_ACTIVITY" },
  { code: "SCHOOL_INCOME", name: "รายได้สถานศึกษา", spendMode: "FLEXIBLE" },
];

type TransactionClient = Prisma.TransactionClient;

export class BudgetDomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function withSerializableRetry<T>(
  operation: (db: TransactionClient) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt < maxAttempts &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Serializable transaction retry exhausted");
}

export function requireBudgetRole(actor: BudgetActor, roles: Role[]): void {
  if (actor.role !== "SUPER_ADMIN" && !roles.includes(actor.role)) {
    throw new BudgetDomainError("ไม่มีสิทธิ์ดำเนินการ", 403);
  }
}

export async function createBudgetPlan(input: {
  actor: BudgetActor;
  academicYearId: string;
  fiscalYearId: string;
  name: string;
  formula?: WalletFormulaInput;
  percentages?: WalletFormulaInput;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);
  const formula = normalizeWalletFormula(input.formula ?? input.percentages ?? DEFAULT_WALLET_FORMULA);
  validateWalletPercentages(formula);
  const percentages = deriveEffectiveWalletPercentages(formula);

  return withSerializableRetry(async (db) => {
    const [academicYear, fiscalYear, departments] = await Promise.all([
      db.academicYear.findUnique({ where: { id: input.academicYearId } }),
      db.fiscalYear.findUnique({ where: { id: input.fiscalYearId } }),
      db.department.findMany(),
    ]);
    if (!academicYear || !fiscalYear) {
      throw new BudgetDomainError("ไม่พบปีการศึกษาหรือปีงบประมาณ", 404);
    }

    const sources = [];
    for (const source of SOURCE_DEFINITIONS) {
      const record = await db.fundSource.upsert({
        where: { code: source.code },
        update: { name: source.name },
        create: { code: source.code, name: source.name, budgetAmount: 0 },
      });
      sources.push(record);
    }

    const plan = await db.budgetPlan.create({
      data: {
        academicYearId: input.academicYearId,
        fiscalYearId: input.fiscalYearId,
        name: input.name.trim(),
        percentageSnapshot: formula,
        createdById: input.actor.id,
      },
    });

    await db.budgetSourceAccount.createMany({
      data: sources.map((source) => ({
        budgetPlanId: plan.id,
        fundSourceId: source.id,
      })),
    });

    await db.budgetWallet.createMany({
      data: WALLET_DEFINITIONS.map((wallet) => ({
        budgetPlanId: plan.id,
        code: wallet.code,
        name: wallet.name,
        percentage:
          wallet.code in percentages
            ? percentages[wallet.code as FormulaWalletCode]
            : null,
        spendMode: wallet.spendMode,
        departmentId: wallet.departmentName
          ? departments.find((department) => department.name === wallet.departmentName)?.id
          : null,
      })),
    });

    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "BUDGET_PLAN_CREATE",
        entityName: "BudgetPlan",
        entityId: plan.id,
        metadata: { academicYearId: input.academicYearId, fiscalYearId: input.fiscalYearId },
      },
    });

    return plan;
  });
}

export async function addBudgetSourceEntry(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  sourceCode: string;
  entryType: BudgetSourceEntryType;
  amount: number;
  description: string;
  documentNo?: string | null;
  entryDate?: Date;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new BudgetDomainError("จำนวนเงินต้องมากกว่า 0");
  }

  return withSerializableRetry(async (db) => {
    const account = await db.budgetSourceAccount.findFirst({
      where: {
        budgetPlanId: input.budgetPlanId,
        fundSource: { code: input.sourceCode },
      },
      include: { budgetPlan: true },
    });
    if (!account) throw new BudgetDomainError("ไม่พบบัญชีแหล่งเงิน", 404);
    if (account.budgetPlan.status !== BudgetPlanStatus.DRAFT) {
      throw new BudgetDomainError("เพิ่มรายการได้เฉพาะแผนฉบับร่าง");
    }

    const entry = await db.budgetSourceEntry.create({
      data: {
        sourceAccountId: account.id,
        entryType: input.entryType,
        amount: input.amount,
        description: input.description.trim(),
        documentNo: input.documentNo?.trim() || null,
        entryDate: input.entryDate ?? new Date(),
        createdById: input.actor.id,
      },
    });
    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "BUDGET_SOURCE_ENTRY_CREATE",
        entityName: "BudgetSourceEntry",
        entityId: entry.id,
        metadata: { budgetPlanId: input.budgetPlanId, sourceCode: input.sourceCode },
      },
    });
    return entry;
  });
}

async function findBudgetSourceEntryForPlan(
  db: TransactionClient,
  budgetPlanId: string,
  entryId: string,
) {
  const entry = await db.budgetSourceEntry.findFirst({
    where: {
      id: entryId,
      sourceAccount: { budgetPlanId },
    },
    include: {
      sourceAccount: {
        include: {
          budgetPlan: true,
          fundSource: true,
        },
      },
    },
  });
  if (!entry) {
    throw new BudgetDomainError("ไม่พบรายการแหล่งเงิน", 404);
  }
  if (entry.sourceAccount.budgetPlan.status !== BudgetPlanStatus.DRAFT) {
    throw new BudgetDomainError("แก้ไขรายการได้เฉพาะแผนฉบับร่าง");
  }
  return entry;
}

export async function updateBudgetSourceEntry(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  entryId: string;
  entryType: BudgetSourceEntryType;
  amount: number;
  description: string;
  documentNo?: string | null;
  entryDate?: Date;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new BudgetDomainError("จำนวนเงินต้องมากกว่า 0");
  }

  return withSerializableRetry(async (db) => {
    const entry = await findBudgetSourceEntryForPlan(db, input.budgetPlanId, input.entryId);
    const updated = await db.budgetSourceEntry.update({
      where: { id: entry.id },
      data: {
        entryType: input.entryType,
        amount: input.amount,
        description: input.description.trim(),
        documentNo: input.documentNo?.trim() || null,
        entryDate: input.entryDate ?? entry.entryDate,
      },
    });
    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "BUDGET_SOURCE_ENTRY_UPDATE",
        entityName: "BudgetSourceEntry",
        entityId: entry.id,
        metadata: {
          budgetPlanId: input.budgetPlanId,
          sourceCode: entry.sourceAccount.fundSource.code,
        },
      },
    });
    return updated;
  });
}

export async function deleteBudgetSourceEntry(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  entryId: string;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);

  return withSerializableRetry(async (db) => {
    const entry = await findBudgetSourceEntryForPlan(db, input.budgetPlanId, input.entryId);
    await db.budgetSourceEntry.delete({ where: { id: entry.id } });
    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "BUDGET_SOURCE_ENTRY_DELETE",
        entityName: "BudgetSourceEntry",
        entityId: entry.id,
        metadata: {
          budgetPlanId: input.budgetPlanId,
          sourceCode: entry.sourceAccount.fundSource.code,
        },
      },
    });
    return { success: true };
  });
}

export async function updateBudgetPlanPercentages(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  formula?: WalletFormulaInput;
  percentages?: WalletFormulaInput;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);
  const formula = normalizeWalletFormula(input.formula ?? input.percentages ?? DEFAULT_WALLET_FORMULA);
  validateWalletPercentages(formula);
  const percentages = deriveEffectiveWalletPercentages(formula);
  return withSerializableRetry(async (db) => {
    const plan = await db.budgetPlan.findUnique({ where: { id: input.budgetPlanId } });
    if (!plan) throw new BudgetDomainError("ไม่พบแผนจัดสรร", 404);
    if (plan.status !== "DRAFT" && plan.status !== "REJECTED") {
      throw new BudgetDomainError("แก้สูตรได้เฉพาะแผนฉบับร่าง");
    }
    await db.budgetWallet.updateMany({
      where: { budgetPlanId: plan.id },
      data: { percentage: null },
    });
    for (const code of FORMULA_WALLET_CODES) {
      await db.budgetWallet.update({
        where: { budgetPlanId_code: { budgetPlanId: plan.id, code } },
        data: { percentage: percentages[code] },
      });
    }
    const updated = await db.budgetPlan.update({
      where: { id: plan.id },
      data: { percentageSnapshot: formula },
    });
    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "BUDGET_PLAN_PERCENTAGES_UPDATE",
        entityName: "BudgetPlan",
        entityId: plan.id,
        metadata: formula,
      },
    });
    return updated;
  });
}

export async function calculateBudgetPlanPreview(
  budgetPlanId: string,
  db: typeof prisma | TransactionClient = prisma,
) {
  const plan = await db.budgetPlan.findUnique({
    where: { id: budgetPlanId },
    include: {
      sourceAccounts: {
        include: { fundSource: true, entries: true },
      },
      wallets: true,
      academicYear: true,
      fiscalYear: true,
    },
  });
  if (!plan) throw new BudgetDomainError("ไม่พบแผนจัดสรร", 404);

  const sourceNet = (code: string) => {
    const account = plan.sourceAccounts.find((item) => item.fundSource.code === code);
    return calculateSourceNet(
      (account?.entries ?? []).map((entry) => ({
        entryType: entry.entryType as SourceEntryType,
        amount: entry.amount,
      })),
    );
  };
  const formula = normalizeWalletFormula(plan.percentageSnapshot as WalletFormulaInput);
  validateWalletPercentages(formula);

  const generalSubsidyNet = sourceNet("GENERAL_SUBSIDY");
  const learnerActivityNet = sourceNet("LEARNER_ACTIVITY");
  const schoolIncomeNet = sourceNet("SCHOOL_INCOME");
  const allocations = calculateWalletAllocations({
    generalSubsidyNet,
    learnerActivityNet,
    schoolIncomeNet,
    formula,
  });

  return {
    plan,
    sourceNets: { generalSubsidyNet, learnerActivityNet, schoolIncomeNet },
    allocations,
    grandTotal: Object.values(allocations).reduce((sum, amount) => sum + amount, 0),
  };
}

export async function transitionBudgetPlan(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  action: "submit" | "approve" | "reject";
  comment?: string;
}) {
  return withSerializableRetry(async (db) => {
    const plan = await db.budgetPlan.findUnique({ where: { id: input.budgetPlanId } });
    if (!plan) throw new BudgetDomainError("ไม่พบแผนจัดสรร", 404);

    if (input.action === "submit") {
      requireBudgetRole(input.actor, ["FINANCE"]);
      if (plan.status !== "DRAFT" && plan.status !== "REJECTED") {
        throw new BudgetDomainError("ส่งอนุมัติได้เฉพาะแผนฉบับร่าง");
      }
      const preview = await calculateBudgetPlanPreview(plan.id, db);
      if (preview.grandTotal <= 0) throw new BudgetDomainError("ยังไม่มียอดเงินสำหรับจัดสรร");
      await db.budgetPlan.update({
        where: { id: plan.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
    } else if (input.action === "approve") {
      requireBudgetRole(input.actor, ["EXECUTIVE"]);
      if (plan.status !== "SUBMITTED") {
        throw new BudgetDomainError("อนุมัติได้เฉพาะแผนที่ส่งตรวจแล้ว");
      }
      const preview = await calculateBudgetPlanPreview(plan.id, db);
      const wallets = await db.budgetWallet.findMany({ where: { budgetPlanId: plan.id } });
      for (const wallet of wallets) {
        const amount = preview.allocations[wallet.code as WalletCode];
        await db.walletLedgerEntry.create({
          data: {
            walletId: wallet.id,
            entryType: "ALLOCATION",
            amount,
            description: `จัดสรรตามแผน ${plan.name}`,
            referenceType: "BUDGET_PLAN",
            referenceId: plan.id,
            postedById: input.actor.id,
          },
        });
      }
      await db.budgetPlan.update({
        where: { id: plan.id },
        data: {
          status: "LOCKED",
          approvedById: input.actor.id,
          approvedAt: new Date(),
          lockedAt: new Date(),
          generalSubsidyNet: preview.sourceNets.generalSubsidyNet,
          learnerActivityNet: preview.sourceNets.learnerActivityNet,
          schoolIncomeNet: preview.sourceNets.schoolIncomeNet,
        },
      });
    } else {
      requireBudgetRole(input.actor, ["EXECUTIVE"]);
      if (plan.status !== "SUBMITTED") throw new BudgetDomainError("ตีกลับได้เฉพาะแผนที่ส่งตรวจแล้ว");
      if (!input.comment?.trim()) throw new BudgetDomainError("ต้องระบุเหตุผลที่ตีกลับ");
      await db.budgetPlan.update({ where: { id: plan.id }, data: { status: "REJECTED" } });
    }

    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: `BUDGET_PLAN_${input.action.toUpperCase()}`,
        entityName: "BudgetPlan",
        entityId: plan.id,
        metadata: input.comment ? { comment: input.comment } : undefined,
      },
    });

    return db.budgetPlan.findUnique({ where: { id: plan.id } });
  });
}

export async function getBudgetPlanDashboard(budgetPlanId: string) {
  const plan = await prisma.budgetPlan.findUnique({
    where: { id: budgetPlanId },
    include: {
      academicYear: true,
      fiscalYear: true,
      wallets: {
        include: {
          ledgerEntries: true,
          _count: { select: { fundingAllocations: true } },
        },
        orderBy: { code: "asc" },
      },
    },
  });
  if (!plan) throw new BudgetDomainError("ไม่พบแผนจัดสรร", 404);

  return {
    ...plan,
    wallets: plan.wallets.map((wallet) => ({
      ...wallet,
      balance: calculateWalletBalance(
        wallet.ledgerEntries.map((entry) => ({
          entryType: entry.entryType as WalletLedgerEntryType,
          amount: entry.amount,
        })),
      ),
    })),
  };
}
