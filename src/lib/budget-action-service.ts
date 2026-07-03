import "server-only";

import { WalletLedgerEntryType } from "@prisma/client";
import {
  BudgetActor,
  BudgetDomainError,
  requireBudgetRole,
  withSerializableRetry,
} from "@/lib/budget-plan-service";
import { calculateWalletBalance } from "@/lib/budget-wallets";

function walletAvailable(
  entries: Array<{ entryType: WalletLedgerEntryType; amount: unknown }>,
) {
  return calculateWalletBalance(
    entries.map((entry) => ({
      entryType: entry.entryType,
      amount: String(entry.amount),
    })),
  ).availableBalance;
}

export async function createBudgetTransfer(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  reason: string;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);
  if (input.fromWalletId === input.toWalletId) {
    throw new BudgetDomainError("กระเป๋าต้นทางและปลายทางต้องต่างกัน");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.reason.trim()) {
    throw new BudgetDomainError("จำนวนเงินหรือเหตุผลไม่ถูกต้อง");
  }

  return withSerializableRetry(async (db) => {
    const [plan, fromWallet, toWallet] = await Promise.all([
      db.budgetPlan.findUnique({ where: { id: input.budgetPlanId } }),
      db.budgetWallet.findUnique({ where: { id: input.fromWalletId } }),
      db.budgetWallet.findUnique({ where: { id: input.toWalletId } }),
    ]);
    if (!plan || !fromWallet || !toWallet) throw new BudgetDomainError("ไม่พบแผนหรือกระเป๋า", 404);
    if (plan.status !== "LOCKED") throw new BudgetDomainError("โยกงบได้เฉพาะแผนที่ล็อกแล้ว");
    if (fromWallet.budgetPlanId !== plan.id || toWallet.budgetPlanId !== plan.id) {
      throw new BudgetDomainError("กระเป๋าต้องอยู่ในแผนเดียวกัน");
    }

    const request = await db.budgetTransferRequest.create({
      data: {
        budgetPlanId: plan.id,
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: input.amount,
        reason: input.reason.trim(),
        createdById: input.actor.id,
      },
    });
    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "BUDGET_TRANSFER_CREATE",
        entityName: "BudgetTransferRequest",
        entityId: request.id,
      },
    });
    return request;
  });
}

export async function transitionBudgetTransfer(input: {
  actor: BudgetActor;
  transferId: string;
  action: "approve" | "reject";
  comment?: string;
}) {
  requireBudgetRole(input.actor, ["EXECUTIVE"]);
  return withSerializableRetry(async (db) => {
    const request = await db.budgetTransferRequest.findUnique({
      where: { id: input.transferId },
      include: { fromWallet: { include: { ledgerEntries: true } } },
    });
    if (!request) throw new BudgetDomainError("ไม่พบคำขอโอนงบ", 404);
    if (request.status !== "PENDING_APPROVAL") throw new BudgetDomainError("คำขอนี้ถูกพิจารณาแล้ว");

    if (input.action === "approve") {
      const available = walletAvailable(request.fromWallet.ledgerEntries);
      if (Number(request.amount) > available) {
        throw new BudgetDomainError(`ยอดพร้อมใช้ไม่พอ (เหลือ ${available.toLocaleString()} บาท)`);
      }
      await db.walletLedgerEntry.createMany({
        data: [
          {
            walletId: request.fromWalletId,
            entryType: "TRANSFER_OUT",
            amount: request.amount,
            description: request.reason,
            referenceType: "BUDGET_TRANSFER",
            referenceId: request.id,
            postedById: input.actor.id,
          },
          {
            walletId: request.toWalletId,
            entryType: "TRANSFER_IN",
            amount: request.amount,
            description: request.reason,
            referenceType: "BUDGET_TRANSFER",
            referenceId: request.id,
            postedById: input.actor.id,
          },
        ],
      });
      await db.budgetTransferRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", approverId: input.actor.id, decidedAt: new Date() },
      });
    } else {
      if (!input.comment?.trim()) throw new BudgetDomainError("ต้องระบุเหตุผลที่ปฏิเสธ");
      await db.budgetTransferRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", approverId: input.actor.id, decidedAt: new Date() },
      });
    }

    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: `BUDGET_TRANSFER_${input.action.toUpperCase()}`,
        entityName: "BudgetTransferRequest",
        entityId: request.id,
        metadata: input.comment ? { comment: input.comment } : undefined,
      },
    });
    return db.budgetTransferRequest.findUnique({ where: { id: request.id } });
  });
}

export async function createOperatingExpense(input: {
  actor: BudgetActor;
  budgetPlanId: string;
  walletId: string;
  amount: number;
  description: string;
  documentNo?: string | null;
}) {
  requireBudgetRole(input.actor, ["FINANCE"]);
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.description.trim()) {
    throw new BudgetDomainError("ข้อมูลค่าใช้จ่ายไม่ถูกต้อง");
  }

  return withSerializableRetry(async (db) => {
    const wallet = await db.budgetWallet.findUnique({
      where: { id: input.walletId },
      include: { budgetPlan: true },
    });
    if (!wallet || wallet.budgetPlanId !== input.budgetPlanId) {
      throw new BudgetDomainError("ไม่พบกระเป๋า", 404);
    }
    if (wallet.budgetPlan.status !== "LOCKED") throw new BudgetDomainError("แผนยังไม่ถูกล็อก");
    if (wallet.spendMode !== "OPERATING" && wallet.spendMode !== "FLEXIBLE") {
      throw new BudgetDomainError("กระเป๋านี้ไม่อนุญาตให้บันทึกค่าใช้จ่ายดำเนินงาน");
    }

    const expense = await db.operatingExpense.create({
      data: {
        budgetPlanId: input.budgetPlanId,
        walletId: input.walletId,
        amount: input.amount,
        description: input.description.trim(),
        documentNo: input.documentNo?.trim() || null,
        status: "PENDING_APPROVAL",
        createdById: input.actor.id,
      },
    });
    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "OPERATING_EXPENSE_CREATE",
        entityName: "OperatingExpense",
        entityId: expense.id,
      },
    });
    return expense;
  });
}

export async function transitionOperatingExpense(input: {
  actor: BudgetActor;
  expenseId: string;
  action: "approve" | "reject" | "pay" | "cancel";
  comment?: string;
}) {
  return withSerializableRetry(async (db) => {
    const expense = await db.operatingExpense.findUnique({
      where: { id: input.expenseId },
      include: { wallet: { include: { ledgerEntries: true } } },
    });
    if (!expense) throw new BudgetDomainError("ไม่พบรายการค่าใช้จ่าย", 404);

    if (input.action === "approve") {
      requireBudgetRole(input.actor, ["EXECUTIVE"]);
      if (expense.status !== "PENDING_APPROVAL") throw new BudgetDomainError("สถานะรายการไม่ถูกต้อง");
      const available = walletAvailable(expense.wallet.ledgerEntries);
      if (Number(expense.amount) > available) {
        throw new BudgetDomainError(`ยอดพร้อมใช้ไม่พอ (เหลือ ${available.toLocaleString()} บาท)`);
      }
      await db.walletLedgerEntry.create({
        data: {
          walletId: expense.walletId,
          entryType: "COMMITMENT",
          amount: expense.amount,
          description: expense.description,
          referenceType: "OPERATING_EXPENSE",
          referenceId: expense.id,
          postedById: input.actor.id,
        },
      });
      await db.operatingExpense.update({
        where: { id: expense.id },
        data: { status: "APPROVED", approverId: input.actor.id, approvedAt: new Date() },
      });
    } else if (input.action === "pay") {
      requireBudgetRole(input.actor, ["FINANCE"]);
      if (expense.status !== "APPROVED") throw new BudgetDomainError("จ่ายได้เฉพาะรายการที่อนุมัติแล้ว");
      await db.walletLedgerEntry.createMany({
        data: [
          {
            walletId: expense.walletId,
            entryType: "COMMITMENT_RELEASE",
            amount: expense.amount,
            description: expense.description,
            referenceType: "OPERATING_EXPENSE",
            referenceId: expense.id,
            postedById: input.actor.id,
          },
          {
            walletId: expense.walletId,
            entryType: "DISBURSEMENT",
            amount: expense.amount,
            description: expense.description,
            referenceType: "OPERATING_EXPENSE",
            referenceId: expense.id,
            postedById: input.actor.id,
          },
        ],
      });
      await db.operatingExpense.update({
        where: { id: expense.id },
        data: { status: "PAID", paidById: input.actor.id, paidAt: new Date() },
      });
    } else if (input.action === "reject") {
      requireBudgetRole(input.actor, ["EXECUTIVE"]);
      if (expense.status !== "PENDING_APPROVAL") throw new BudgetDomainError("สถานะรายการไม่ถูกต้อง");
      if (!input.comment?.trim()) throw new BudgetDomainError("ต้องระบุเหตุผลที่ปฏิเสธ");
      await db.operatingExpense.update({ where: { id: expense.id }, data: { status: "REJECTED" } });
    } else {
      requireBudgetRole(input.actor, ["FINANCE"]);
      if (expense.status !== "APPROVED") throw new BudgetDomainError("ยกเลิกได้เฉพาะรายการที่กันงบแล้ว");
      await db.walletLedgerEntry.create({
        data: {
          walletId: expense.walletId,
          entryType: "COMMITMENT_RELEASE",
          amount: expense.amount,
          description: `ยกเลิก: ${expense.description}`,
          referenceType: "OPERATING_EXPENSE",
          referenceId: `${expense.id}:cancel`,
          postedById: input.actor.id,
        },
      });
      await db.operatingExpense.update({ where: { id: expense.id }, data: { status: "CANCELLED" } });
    }

    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        action: `OPERATING_EXPENSE_${input.action.toUpperCase()}`,
        entityName: "OperatingExpense",
        entityId: expense.id,
        metadata: input.comment ? { comment: input.comment } : undefined,
      },
    });
    return db.operatingExpense.findUnique({ where: { id: expense.id } });
  });
}
