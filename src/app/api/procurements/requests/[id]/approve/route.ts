import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PurchaseRequestStatus } from "@prisma/client";
import { calculateWalletBalance } from "@/lib/budget-wallets";

type ApprovalStep =
  | "plan"
  | "finance"
  | "procurement"
  | "budget"
  | "director";

const EXPECTED_STATUS_BY_STEP: Record<ApprovalStep, PurchaseRequestStatus> = {
  plan: "PENDING",
  finance: "PLAN_REVIEWED",
  procurement: "FINANCE_REVIEWED",
  budget: "PROCUREMENT_REVIEWED",
  director: "BUDGET_REVIEWED",
};

function isApprovalStep(value: unknown): value is ApprovalStep {
  return (
    value === "plan" ||
    value === "finance" ||
    value === "procurement" ||
    value === "budget" ||
    value === "director"
  );
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });
  }

  const { id } = await params;
  const { step, opinion, isApproved } = await req.json();

  if (!id || !isApprovalStep(step)) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        project: true,
        budgetWallet: { include: { ledgerEntries: true } },
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลใบขออนุมัติ" },
        { status: 404 },
      );
    }

    const role = session.user.role;
    const userId = session.user.id;

    let isAuthorized = false;
    if (role === "SUPER_ADMIN") {
      isAuthorized = true;
    } else if (step === "plan") {
      isAuthorized = role === "FINANCE" || role === "DEPT_HEAD";
    } else if (step === "finance") {
      isAuthorized = role === "FINANCE";
    } else if (step === "procurement") {
      isAuthorized = role === "PROCUREMENT";
    } else if (step === "budget") {
      isAuthorized = role === "DEPT_HEAD";
    } else if (step === "director") {
      isAuthorized = role === "EXECUTIVE";
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "ท่านไม่มีสิทธิ์ลงนามในส่วนงานนี้" },
        { status: 403 },
      );
    }

    if (request.status !== EXPECTED_STATUS_BY_STEP[step]) {
      return NextResponse.json(
        { error: "สถานะใบขอถูกเปลี่ยนแล้ว กรุณาโหลดหน้าจอใหม่แล้วลองใหม่" },
        { status: 409 },
      );
    }

    const updateData: Record<string, unknown> = {};
    let newStatus: PurchaseRequestStatus = request.status;
    let cancelItems = false;
    let orderItems = false;
    let receiveItems = false;
    let postExpense = false;
    let reserveBudget = false;
    let releaseCommitmentForRejection = false;

    if (!isApproved) {
      newStatus = "REJECTED";
      cancelItems = true;
      if (step === "director") {
        releaseCommitmentForRejection = true;
      }
    }

    if (step === "plan") {
      updateData.planOpinion = opinion || "เห็นควรดำเนินการ";
      updateData.planApprovedById = userId;
      updateData.planApprovedAt = new Date();
      if (isApproved) {
        newStatus = "PLAN_REVIEWED";
      }
    } else if (step === "finance") {
      updateData.financeOpinion =
        opinion ||
        "ตรวจสอบเงินคงเหลือเรียบร้อย สามารถเบิกจ่ายได้";
      updateData.financeApprovedById = userId;
      updateData.financeApprovedAt = new Date();
      if (isApproved) {
        newStatus = "FINANCE_REVIEWED";
      }
    } else if (step === "procurement") {
      updateData.procurementOpinion =
        opinion || "เห็นควรจัดซื้อจัดจ้างพัสดุตามรายการ";
      updateData.procurementApprovedById = userId;
      updateData.procurementApprovedAt = new Date();
      if (isApproved) {
        newStatus = "PROCUREMENT_REVIEWED";
        orderItems = true;
      }
    } else if (step === "budget") {
      updateData.budgetOpinion =
        opinion || "เห็นควรอนุมัติโครงการจัดซื้อ";
      updateData.budgetApprovedById = userId;
      updateData.budgetApprovedAt = new Date();
      if (isApproved) {
        newStatus = "BUDGET_REVIEWED";
        reserveBudget = true;
      }
    } else if (step === "director") {
      updateData.directorOpinion = opinion || "อนุมัติ";
      updateData.directorApprovedById = userId;
      updateData.directorApprovedAt = new Date();
      if (isApproved) {
        newStatus = "APPROVED";
        receiveItems = true;
        postExpense = true;
      }
    }

    updateData.status = newStatus;

    const updatedRequest = await prisma.$transaction(
      async (db) => {
        if (reserveBudget && request.budgetWallet) {
          const walletBalance = calculateWalletBalance(
            request.budgetWallet.ledgerEntries,
          );
          if (Number(request.requestedAmount) > walletBalance.availableBalance) {
            throw new Error(`ยอดพร้อมใช้ในกระเป๋าไม่พอ (ขาดอีก ${(Number(request.requestedAmount) - walletBalance.availableBalance).toLocaleString()} บาท)`);
          }
          await db.walletLedgerEntry.create({
            data: {
              walletId: request.budgetWallet.id,
              entryType: "COMMITMENT",
              amount: request.requestedAmount,
              description: request.subject,
              referenceType: "PURCHASE_REQUEST",
              referenceId: request.id,
              postedById: userId,
            },
          });
        }

        if (releaseCommitmentForRejection && request.budgetWallet) {
          await db.walletLedgerEntry.create({
            data: {
              walletId: request.budgetWallet.id,
              entryType: "COMMITMENT_RELEASE",
              amount: request.requestedAmount,
              description: `ยกเลิกรายการ: ${request.subject}`,
              referenceType: "PURCHASE_REQUEST",
              referenceId: `${request.id}:reject`,
              postedById: userId,
            },
          });
        }

        if (cancelItems) {
          await db.procurement.updateMany({
            where: { purchaseRequestId: id },
            data: { status: "CANCELLED" },
          });
        }
        if (orderItems) {
          await db.procurement.updateMany({
            where: { purchaseRequestId: id },
            data: { status: "ORDERED" },
          });
        }
        if (receiveItems) {
          await db.procurement.updateMany({
            where: { purchaseRequestId: id },
            data: { status: "RECEIVED" },
          });
        }
        if (postExpense) {
          const borrowedList = Array.isArray(request.borrowedFrom)
            ? (request.borrowedFrom as any[])
            : JSON.parse((request.borrowedFrom as string) || "[]");

          const totalBorrowed = borrowedList.reduce(
            (sum: number, item: any) => sum + (Number(item.amount) || 0),
            0
          );
          const ownAmount = Math.max(0, Number(request.requestedAmount) - totalBorrowed);

          const createdTransactions = [];

          if (ownAmount > 0) {
            const transaction = await db.budgetTransaction.create({
              data: {
                projectId: request.projectId,
                transactionType: "EXPENSE",
                amount: ownAmount,
                description: `จัดซื้อจัดจ้างตามใบขออนุมัติ: ${request.subject} [PR:${request.id}]`,
              },
            });
            createdTransactions.push(transaction);
          }

          for (const item of borrowedList) {
            const borrowAmount = Number(item.amount) || 0;
            if (borrowAmount > 0) {
              const borrowProjectId = item.projectId || request.projectId;
              const transaction = await db.budgetTransaction.create({
                data: {
                  projectId: borrowProjectId,
                  transactionType: "EXPENSE",
                  amount: borrowAmount,
                  description: `ยืมงบไปใช้ในโครงการ "${request.project.projectName}" (จัดซื้อจัดจ้างตามใบขออนุมัติ: ${request.subject}) [PR:${request.id}]`,
                },
              });
              createdTransactions.push(transaction);
            }
          }

          if (createdTransactions.length > 0) {
            await db.auditLog.create({
              data: {
                userId,
                action: "PURCHASE_REQUEST_POST_EXPENSE",
                entityName: "BudgetTransaction",
                entityId: createdTransactions[0].id,
                metadata: {
                  purchaseRequestId: request.id,
                  projectId: request.projectId,
                  transactionType: "EXPENSE",
                  approvalStep: step,
                  transactionIds: createdTransactions.map((t) => t.id),
                },
              },
            });
          }

          if (request.budgetWallet) {
            const walletBalance = calculateWalletBalance(
              request.budgetWallet.ledgerEntries,
            );
            if (Number(request.requestedAmount) > walletBalance.committed) {
              throw new Error("ยอด commitment ในกระเป๋าไม่พอสำหรับรายการนี้");
            }

            await db.walletLedgerEntry.createMany({
              data: [
                {
                  walletId: request.budgetWallet.id,
                  entryType: "COMMITMENT_RELEASE",
                  amount: request.requestedAmount,
                  description: request.subject,
                  referenceType: "PURCHASE_REQUEST",
                  referenceId: request.id,
                  postedById: userId,
                },
                {
                  walletId: request.budgetWallet.id,
                  entryType: "DISBURSEMENT",
                  amount: request.requestedAmount,
                  description: request.subject,
                  referenceType: "PURCHASE_REQUEST",
                  referenceId: request.id,
                  postedById: userId,
                },
              ],
            });
          }
        }

        const updated = await db.purchaseRequest.update({
          where: { id },
          data: updateData,
          include: { items: true },
        });

        await db.auditLog.create({
          data: {
            userId,
            action: `PURCHASE_REQUEST_APPROVE_${step.toUpperCase()}`,
            entityName: "PurchaseRequest",
            entityId: id,
            metadata: { opinion, isApproved, newStatus },
          },
        });

        return updated;
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Failed to approve PurchaseRequest:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลงนาม" },
      { status: 500 },
    );
  }
}
