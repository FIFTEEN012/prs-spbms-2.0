import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBorrowingBudget } from "../budget-validation";
import type { WalletLedgerEntryType, WalletReferenceType } from "@prisma/client";

function parseBorrowedFrom(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildExpenseRows(input: {
  requestId: string;
  projectId: string;
  projectName: string;
  subject: string;
  requestedAmount: number;
  borrowedFrom: unknown;
}) {
  const borrowedList = parseBorrowedFrom(input.borrowedFrom);
  const totalBorrowed = borrowedList.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const ownAmount = Math.max(0, input.requestedAmount - totalBorrowed);
  const rows: Array<{ projectId: string; amount: number; description: string }> = [];

  if (ownAmount > 0) {
    rows.push({
      projectId: input.projectId,
      amount: ownAmount,
      description: `จัดซื้อจัดจ้างตามใบขออนุมัติ: ${input.subject} [PR:${input.requestId}]`,
    });
  }

  for (const item of borrowedList) {
    const amount = Number(item.amount) || 0;
    if (amount <= 0) continue;
    rows.push({
      projectId: item.projectId || input.projectId,
      amount,
      description: `ยืมงบไปใช้ในโครงการ "${input.projectName}" (จัดซื้อจัดจ้างตามใบขออนุมัติ: ${input.subject}) [PR:${input.requestId}]`,
    });
  }

  return rows;
}

function buildWalletCorrectionEntries(input: {
  requestId: string;
  correctionId: string;
  status: string;
  oldWalletId: string | null | undefined;
  newWalletId: string | null | undefined;
  oldAmount: number;
  newAmount: number;
  subject: string;
  postedById: string;
}) {
  const entries: Array<{
    walletId: string;
    entryType: WalletLedgerEntryType;
    amount: number;
    description: string;
    referenceType: "PURCHASE_REQUEST";
    referenceId: string;
    postedById: string;
  }> = [];
  const oldWalletId = input.oldWalletId || null;
  const newWalletId = input.newWalletId || null;

  const addEntry = (
    walletId: string | null,
    entryType: WalletLedgerEntryType,
    amount: number,
    suffix: string,
  ) => {
    if (!walletId || amount <= 0) return;
    entries.push({
      walletId,
      entryType,
      amount,
      description: `Admin correction: ${input.subject}`,
      referenceType: "PURCHASE_REQUEST",
      referenceId: `${input.requestId}:edit:${input.correctionId}:${suffix}`,
      postedById: input.postedById,
    });
  };

  if (input.status === "BUDGET_REVIEWED") {
    if (oldWalletId && oldWalletId === newWalletId) {
      const delta = input.newAmount - input.oldAmount;
      addEntry(oldWalletId, delta > 0 ? "COMMITMENT" : "COMMITMENT_RELEASE", Math.abs(delta), "commitment-delta");
    } else {
      addEntry(oldWalletId, "COMMITMENT_RELEASE", input.oldAmount, "commitment-release-old");
      addEntry(newWalletId, "COMMITMENT", input.newAmount, "commitment-new");
    }
  }

  if (input.status === "APPROVED") {
    if (oldWalletId && oldWalletId === newWalletId) {
      const delta = input.newAmount - input.oldAmount;
      addEntry(oldWalletId, delta > 0 ? "DISBURSEMENT" : "REFUND", Math.abs(delta), "disbursement-delta");
    } else {
      addEntry(oldWalletId, "REFUND", input.oldAmount, "refund-old-wallet");
      addEntry(newWalletId, "DISBURSEMENT", input.newAmount, "disbursement-new-wallet");
    }
  }

  return entries;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ไม่ระบุไอดี" }, { status: 400 });

  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        project: true,
        activity: true,
        fundSource: true,
        items: true,
        createdBy: {
          select: { fullName: true, username: true, role: true, department: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "ไม่พบข้อมูลใบขออนุมัติ" }, { status: 404 });
    }

    return NextResponse.json(request);
  } catch (_error) {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการลบข้อมูลคำขอนี้" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ไม่ระบุไอดี" }, { status: 400 });

  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        budgetWallet: {
          include: {
            ledgerEntries: {
              where: {
                referenceType: "PURCHASE_REQUEST",
                OR: [
                  { referenceId: id },
                  { referenceId: { startsWith: `${id}:edit:` } },
                ],
                entryType: { in: ["COMMITMENT_RELEASE", "DISBURSEMENT", "REFUND"] },
              },
              include: { reversals: true },
            },
          },
        },
      },
    });
    if (!request) {
      return NextResponse.json({ error: "ไม่พบข้อมูลใบขออนุมัติ" }, { status: 404 });
    }

    const isApprovedRequest = request.status === "APPROVED" || !!request.directorApprovedAt;

    await prisma.$transaction(async (db) => {
      let budgetTransactionId: string | null = null;
      const reversedLedgerEntryIds: string[] = [];

      if (isApprovedRequest) {
        const reversalEntries = (request.budgetWallet?.ledgerEntries ?? [])
          .filter((entry) => entry.reversals.length === 0)
          .map((entry) => {
            const entryType: WalletLedgerEntryType =
              entry.entryType === "COMMITMENT_RELEASE"
                ? "COMMITMENT"
                : entry.entryType === "REFUND"
                  ? "ADJUSTMENT_DECREASE"
                  : "ADJUSTMENT_INCREASE";
            reversedLedgerEntryIds.push(entry.id);

            const referenceType: WalletReferenceType = "REVERSAL";

            return {
              walletId: request.budgetWallet!.id,
              entryType,
              amount: entry.amount,
              description: `Rollback deletion: ${request.subject}`,
              referenceType,
              referenceId: `${request.id}:${entry.id}`,
              reversalOfId: entry.id,
              postedById: session.user.id,
            };
          });

        if (reversalEntries.length > 0) {
          await db.walletLedgerEntry.createMany({
            data: reversalEntries,
          });
        }

        const expenseTransaction = await db.budgetTransaction.findFirst({
          where: {
            OR: [
              {
                projectId: request.projectId,
                transactionType: "EXPENSE",
                amount: request.requestedAmount,
                description: `จัดซื้อจัดจ้างตามใบขออนุมัติ: ${request.subject}`,
              },
              {
                description: {
                  contains: `[PR:${id}]`,
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        if (expenseTransaction) {
          budgetTransactionId = expenseTransaction.id;
          await db.budgetTransaction.delete({
            where: { id: expenseTransaction.id },
          });
        }

        // Also delete any other split transactions (e.g. borrowed ones)
        await db.budgetTransaction.deleteMany({
          where: {
            description: {
              contains: `[PR:${id}]`,
            },
            id: {
              not: budgetTransactionId || "",
            },
          },
        });
      }

      await db.procurement.deleteMany({
        where: { purchaseRequestId: id },
      });

      await db.purchaseRequest.delete({
        where: { id },
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: isApprovedRequest ? "PURCHASE_REQUEST_DELETE_APPROVED_ROLLBACK" : "PURCHASE_REQUEST_DELETE",
          entityName: "PurchaseRequest",
          entityId: id,
          ...(isApprovedRequest
            ? {
                metadata: {
                  status: request.status,
                  budgetTransactionId,
                  reversedLedgerEntryIds,
                },
              }
            : {}),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete PurchaseRequest:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการแก้ไขข้อมูลคำขอนี้" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ไม่ระบุไอดี" }, { status: 400 });

  const body = await req.json();
  const {
    projectId,
    activityId,
    documentNo,
    documentDate,
    subject,
    category,
    categoryDetails,
    fundSourceId,
    budgetWalletId,
    actionPlanPage,
    isNotInPlan,
    necessityDetails,
    committee,
    items,
    borrowedFrom,
  } = body;

  if (!projectId || !subject?.trim() || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้องหรือขาดฟิลด์สำคัญ" }, { status: 400 });
  }

  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        budgetWallet: true,
      },
    });
    if (!request) {
      return NextResponse.json({ error: "ไม่พบข้อมูลใบขออนุมัติ" }, { status: 404 });
    }

    const requestedAmount = items.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.unitPrice);
    }, 0);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return NextResponse.json({ error: "ไม่พบโครงการ" }, { status: 404 });

    let allocatedBudget = Number(project.budgetApproved);
    let previousBalance = allocatedBudget;
    let remainingBalance = previousBalance - requestedAmount;

    if (activityId) {
      const budgetValidation = await validateBorrowingBudget({
        db: prisma,
        projectId,
        activityId,
        requestedAmount,
        borrowedFrom,
        excludeRequestId: id,
      });

      if (!budgetValidation.ok) {
        return NextResponse.json({ error: budgetValidation.error }, { status: budgetValidation.status });
      }

      let originalAllocated = Number(budgetValidation.mainActivity.budget);
      if (budgetWalletId) {
        const actWithWallet = await prisma.projectActivity.findUnique({
          where: { id: activityId },
          include: { fundingAllocations: true },
        });
        const walletFunding = actWithWallet?.fundingAllocations.find((funding: any) => funding.walletId === budgetWalletId);
        if (walletFunding) {
          originalAllocated = Number(walletFunding.approvedAmount ?? walletFunding.requestedAmount);
        }
      }

      allocatedBudget = originalAllocated;
      previousBalance = budgetValidation.mainRemaining;
      remainingBalance = budgetValidation.mainRemaining - requestedAmount + budgetValidation.totalBorrowedAmount;
    }

    const correctionId = String(Date.now());
    const oldRequestedAmount = Number(request.requestedAmount ?? 0);
    const oldBudgetWalletId = request.budgetWalletId || null;
    const newBudgetWalletId = budgetWalletId || null;
    const statusForCorrection = String(request.status ?? "");
    const walletCorrectionEntries = buildWalletCorrectionEntries({
      requestId: id,
      correctionId,
      status: statusForCorrection,
      oldWalletId: oldBudgetWalletId,
      newWalletId: newBudgetWalletId,
      oldAmount: oldRequestedAmount,
      newAmount: requestedAmount,
      subject: subject.trim(),
      postedById: session.user.id,
    });
    const expenseRows =
      statusForCorrection === "APPROVED"
        ? buildExpenseRows({
            requestId: id,
            projectId,
            projectName: project.projectName ?? "ไม่ระบุชื่อโครงการ",
            subject: subject.trim(),
            requestedAmount,
            borrowedFrom,
          })
        : [];

    const updated = await prisma.$transaction(async (db) => {
      await db.procurement.deleteMany({
        where: { purchaseRequestId: id },
      });

      const updatedRequest = await db.purchaseRequest.update({
        where: { id },
        data: {
          projectId,
          activityId: activityId || null,
          documentNo: documentNo?.trim() || null,
          documentDate: documentDate ? new Date(documentDate) : new Date(),
          subject: subject.trim(),
          category: category || "SUPPLIES",
          categoryDetails: categoryDetails?.trim() || null,
          fundSourceId: fundSourceId || project.fundSourceId,
          budgetWalletId: budgetWalletId || null,
          actionPlanPage: actionPlanPage?.trim() || null,
          isNotInPlan: !!isNotInPlan,
          necessityDetails: necessityDetails?.trim() || null,
          committee: committee || [],
          borrowedFrom: borrowedFrom || [],
          allocatedBudget,
          previousBalance,
          requestedAmount,
          remainingBalance,
          items: {
            create: items.map((item: any) => ({
              projectId,
              itemName: item.itemName.trim(),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.quantity) * Number(item.unitPrice),
              status: "REQUESTED",
              remarks: item.remarks?.trim() || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      if (walletCorrectionEntries.length > 0) {
        await db.walletLedgerEntry.createMany({
          data: walletCorrectionEntries,
        });
      }

      if (statusForCorrection === "APPROVED") {
        await db.budgetTransaction.deleteMany({
          where: {
            description: {
              contains: `[PR:${id}]`,
            },
          },
        });

        for (const row of expenseRows) {
          await db.budgetTransaction.create({
            data: {
              projectId: row.projectId,
              transactionType: "EXPENSE",
              amount: row.amount,
              description: `${row.description} [EDIT:${correctionId}]`,
            },
          });
        }
      }

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PURCHASE_REQUEST_ADMIN_CORRECTION",
          entityName: "PurchaseRequest",
          entityId: id,
          metadata: {
            previousStatus: request.status,
            oldRequestedAmount,
            newRequestedAmount: requestedAmount,
            oldBudgetWalletId,
            newBudgetWalletId,
            ledgerCorrectionCount: walletCorrectionEntries.length,
            recreatedExpenseCount: expenseRows.length,
          },
        },
      });

      return updatedRequest;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update PurchaseRequest:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" }, { status: 500 });
  }
}
