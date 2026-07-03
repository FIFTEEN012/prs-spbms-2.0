import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import {
  BudgetTransactionKind,
  canApplyBudgetTransaction,
  summarizeProjectBudget,
} from "@/lib/budget-summary";

const TRANSACTION_TYPES: BudgetTransactionKind[] = [
  "ALLOCATE",
  "EXPENSE",
  "REFUND",
  "ADJUST",
];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const { projectId, amount, description, transactionType = "EXPENSE" } = await req.json();
  const n = Number(amount);
  if (
    !projectId ||
    !n ||
    n <= 0 ||
    !TRANSACTION_TYPES.includes(transactionType as BudgetTransactionKind)
  ) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(
      async (db) => {
        const project = await db.project.findUnique({
          where: { id: projectId },
          include: { transactions: true },
        });
        if (!project) throw new BudgetTransactionError("ไม่พบโครงการ", 404);

        const role = session.user.role;
        const isDeptStaff =
          session.user.departmentId &&
          session.user.departmentId === project.departmentId &&
          (role === "TEACHER" || role === "DEPT_HEAD");

        if (!can(role, "budget.record") && !isDeptStaff) {
          throw new BudgetTransactionError("ไม่มีสิทธิ์", 403);
        }

        const summary = summarizeProjectBudget(
          project.budgetApproved,
          project.transactions,
        );
        if (
          !canApplyBudgetTransaction(
            summary,
            transactionType as BudgetTransactionKind,
            n,
          )
        ) {
          throw new BudgetTransactionError(
            `เกินงบคงเหลือ (เหลือ ${summary.remaining.toLocaleString()} บาท)`,
            400,
          );
        }

        const transaction = await db.budgetTransaction.create({
          data: {
            projectId,
            amount: n,
            description,
            transactionType,
          },
        });

        await db.auditLog.create({
          data: {
            userId: session.user.id,
            action: `BUDGET_${transactionType}`,
            entityName: "BudgetTransaction",
            entityId: transaction.id,
          },
        });

        return transaction;
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof BudgetTransactionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

class BudgetTransactionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
