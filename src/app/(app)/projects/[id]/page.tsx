import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import {
  addRunningBalances,
  type BudgetTransactionKind,
  summarizeProjectBudget,
} from "@/lib/budget-summary";
import {
  canActOnProject,
  canEditProject,
  canReadProject,
  canViewProjectBudgetHistory,
} from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { ProjectDetailClient, type ProjectDetailData } from "./_project-detail-client";

const HISTORY_PAGE_SIZE = 20;

const transactionLabels: Record<BudgetTransactionKind, string> = {
  ALLOCATE: "จัดสรรงบประมาณ",
  EXPENSE: "เบิกจ่าย",
  REFUND: "คืนเงิน",
  ADJUST: "ปรับยอด",
};

type BorrowedFromItem = {
  projectId?: string;
  activityId?: string;
  activityName?: string;
  amount?: number | string;
};

function parseBorrowedFrom(value: Prisma.JsonValue | null): BorrowedFromItem[] {
  if (Array.isArray(value)) return value as BorrowedFromItem[];
  if (typeof value !== "string" || value.trim() === "") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isBudgetActive(status: string) {
  return status === "APPROVED" || status === "IN_PROGRESS" || status === "COMPLETED";
}

function canCreatePurchaseRequest(role: string | undefined, status: string) {
  return (
    (role === "SUPER_ADMIN" || role === "PROCUREMENT") &&
    (status === "APPROVED" || status === "IN_PROGRESS" || status === "COMPLETED")
  );
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ budgetType?: string; budgetPage?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      projectCode: true,
      projectName: true,
      rationale: true,
      objectives: true,
      quantitativeTarget: true,
      qualitativeTarget: true,
      indicators: true,
      method: true,
      expectedOutcome: true,
      budgetRequested: true,
      budgetApproved: true,
      responsibleUserId: true,
      departmentId: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, fullName: true, role: true } },
      strategy: { select: { code: true, title: true } },
      fundSource: { select: { id: true, name: true } },
      academicYear: { select: { id: true, yearName: true } },
      activities: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          budget: true,
          fundSource: { select: { id: true, name: true } },
          fundingAllocations: {
            select: {
              id: true,
              requestedAmount: true,
              approvedAmount: true,
              wallet: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
      approvals: {
        orderBy: [{ stepOrder: "asc" }, { approvedAt: "asc" }],
        select: {
          id: true,
          stepOrder: true,
          status: true,
          comment: true,
          approvedAt: true,
          approver: { select: { id: true, fullName: true, role: true } },
        },
      },
    },
  });

  if (!project) notFound();
  if (!canReadProject(session.user, project)) notFound();

  const allowedTypes = Object.keys(transactionLabels) as BudgetTransactionKind[];
  const budgetType = allowedTypes.includes(query.budgetType as BudgetTransactionKind)
    ? (query.budgetType as BudgetTransactionKind)
    : null;
  const requestedPage = Number.parseInt(query.budgetPage ?? "1", 10);
  const historyWhere = budgetType
    ? { projectId: project.id, transactionType: budgetType }
    : { projectId: project.id };

  const canViewHistory = canViewProjectBudgetHistory(session.user, project);
  const [transactionGroups, filteredHistoryCount, visibleTransactions, purchaseRequests] =
    await Promise.all([
      prisma.budgetTransaction.groupBy({
        by: ["transactionType"],
        where: { projectId: project.id },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      canViewHistory ? prisma.budgetTransaction.count({ where: historyWhere }) : Promise.resolve(0),
      canViewHistory
        ? prisma.budgetTransaction.findMany({
            where: historyWhere,
            orderBy: { transactionDate: "desc" },
            skip:
              (Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1) - 1) *
              HISTORY_PAGE_SIZE,
            take: HISTORY_PAGE_SIZE,
          })
        : Promise.resolve([]),
      prisma.purchaseRequest.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          documentNo: true,
          documentDate: true,
          subject: true,
          requestedAmount: true,
          allocatedBudget: true,
          remainingBalance: true,
          borrowedFrom: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          activityId: true,
          activity: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, role: true } },
          items: {
            select: {
              id: true,
              itemName: true,
              quantity: true,
              totalPrice: true,
              status: true,
            },
          },
        },
      }),
    ]);

  const budget = summarizeProjectBudget(
    project.budgetApproved,
    transactionGroups.map((group) => ({
      transactionType: group.transactionType,
      amount: Number(group._sum.amount ?? 0),
      count: group._count._all,
    })),
  );

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryCount / HISTORY_PAGE_SIZE));
  const historyPage = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    totalHistoryPages,
  );
  const oldestVisibleTransaction = visibleTransactions.at(-1);
  const balanceWindow =
    !budgetType && historyPage === 1
      ? visibleTransactions
      : canViewHistory && oldestVisibleTransaction
        ? await prisma.budgetTransaction.findMany({
            where: {
              projectId: project.id,
              transactionDate: { gte: oldestVisibleTransaction.transactionDate },
            },
            orderBy: { transactionDate: "desc" },
          })
        : [];
  const balanceByTransactionId = new Map(
    addRunningBalances(project.budgetApproved, balanceWindow).map((transaction) => [
      transaction.id,
      transaction,
    ]),
  );
  const visibleHistory = visibleTransactions.map(
    (transaction) =>
      balanceByTransactionId.get(transaction.id) ?? {
        ...transaction,
        balanceAfter: budget.remaining,
      },
  );
  const historyAuditLogs =
    canViewHistory && visibleHistory.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            entityName: "BudgetTransaction",
            entityId: { in: visibleHistory.map((transaction) => transaction.id) },
          },
          include: { user: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const actorByTransactionId = new Map<string, string>();
  for (const log of historyAuditLogs) {
    if (log.entityId && !actorByTransactionId.has(log.entityId)) {
      actorByTransactionId.set(log.entityId, log.user?.fullName ?? "ระบบ");
    }
  }

  const approvedPurchaseRequests = purchaseRequests.filter(
    (request) => request.status !== "REJECTED",
  );
  const netSpentByActivityId = new Map<string, number>();

  for (const request of approvedPurchaseRequests) {
    const borrowedList = parseBorrowedFrom(request.borrowedFrom);
    const totalBorrowed = borrowedList.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    if (request.activityId) {
      netSpentByActivityId.set(
        request.activityId,
        (netSpentByActivityId.get(request.activityId) ?? 0) +
          Number(request.requestedAmount) -
          totalBorrowed,
      );
    }

    for (const item of borrowedList) {
      if (!item.activityId) continue;
      netSpentByActivityId.set(
        item.activityId,
        (netSpentByActivityId.get(item.activityId) ?? 0) + (Number(item.amount) || 0),
      );
    }
  }

  const data: ProjectDetailData = {
    currentUser: {
      id: session.user.id,
      role: session.user.role,
      departmentId: session.user.departmentId ?? null,
    },
    permissions: {
      canEdit: canEditProject(session.user, project),
      canSubmit:
        project.status === "DRAFT" && canActOnProject(session.user, project, "submit"),
      canReview:
        project.status === "SUBMITTED" &&
        canActOnProject(session.user, project, "dept_approve"),
      canApprove:
        project.status === "REVIEWED" &&
        canActOnProject(session.user, project, "executive_approve"),
      canReject:
        (project.status === "SUBMITTED" || project.status === "REVIEWED") &&
        canActOnProject(session.user, project, "reject_to_draft"),
      canViewBudgetHistory: canViewHistory,
      canCreatePurchaseRequest: canCreatePurchaseRequest(
        session.user.role,
        project.status,
      ),
    },
    project: {
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      status: project.status,
      academicYearName: project.academicYear.yearName,
      departmentName: project.department?.name ?? "ยังไม่ได้ระบุกลุ่มบริหาร",
      responsibleFullName: project.responsibleUser?.fullName ?? "ยังไม่ได้ระบุผู้รับผิดชอบ",
      strategyLabel: project.strategy
        ? `${project.strategy.code} - ${project.strategy.title}`
        : "ยังไม่ได้ระบุ",
      fundSourceName: project.fundSource?.name ?? "ยังไม่ได้ระบุ",
      startDate: project.startDate ? project.startDate.toISOString() : null,
      endDate: project.endDate ? project.endDate.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      rationale: project.rationale,
      objectives: project.objectives,
      quantitativeTarget: project.quantitativeTarget,
      qualitativeTarget: project.qualitativeTarget,
      indicators: project.indicators,
      method: project.method,
      expectedOutcome: project.expectedOutcome,
      budgetRequested: Number(project.budgetRequested),
      budgetApproved: Number(project.budgetApproved),
      budgetNetSpent: budget.netSpent,
      budgetRemaining: budget.remaining,
      budgetExpenseCount: budget.expenseCount,
      budgetHistoryCount: budget.historyCount,
      budgetPercentUsed: budget.approved > 0 ? (budget.netSpent / budget.approved) * 100 : 0,
      budgetActive: isBudgetActive(project.status) && budget.approved > 0,
    },
    activities: project.activities.map((activity) => {
      const walletLabels = activity.fundingAllocations.map(
        (allocation) => allocation.wallet.name,
      );
      const approvedFromAllocations = activity.fundingAllocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.approvedAmount ?? allocation.requestedAmount ?? 0),
        0,
      );
      const requestedFromAllocations = activity.fundingAllocations.reduce(
        (sum, allocation) => sum + Number(allocation.requestedAmount ?? 0),
        0,
      );
      const requestedBudget = Number(activity.budget);
      const approvedBudget =
        approvedFromAllocations > 0
          ? approvedFromAllocations
          : requestedFromAllocations > 0
            ? requestedFromAllocations
            : isBudgetActive(project.status)
              ? requestedBudget
              : 0;
      const netSpent = netSpentByActivityId.get(activity.id) ?? 0;

      return {
        id: activity.id,
        name: activity.name,
        startDate: activity.startDate ? activity.startDate.toISOString() : null,
        endDate: activity.endDate ? activity.endDate.toISOString() : null,
        fundSourceName:
          walletLabels.length > 0
            ? walletLabels.join(", ")
            : activity.fundSource?.name ?? project.fundSource?.name ?? "ยังไม่ได้ระบุ",
        budgetRequested: requestedBudget,
        budgetApproved: approvedBudget,
        netSpent,
        remaining: approvedBudget - netSpent,
        percentUsed: approvedBudget > 0 ? (netSpent / approvedBudget) * 100 : 0,
      };
    }),
    approvals: project.approvals.map((approval) => ({
      id: approval.id,
      stepOrder: approval.stepOrder,
      status: approval.status,
      comment: approval.comment,
      approvedAt: approval.approvedAt ? approval.approvedAt.toISOString() : null,
      approverName: approval.approver.fullName,
      approverRole: approval.approver.role,
    })),
    budgetHistory: {
      budgetType,
      allowedTypes,
      page: historyPage,
      totalPages: totalHistoryPages,
      totalCount: filteredHistoryCount,
      rows: visibleHistory.map((transaction) => ({
        id: transaction.id,
        transactionType: transaction.transactionType,
        transactionDate: transaction.transactionDate.toISOString(),
        description: transaction.description,
        amount: Number(transaction.amount),
        balanceAfter: transaction.balanceAfter,
        actorName: actorByTransactionId.get(transaction.id) ?? "ระบบ",
      })),
    },
    purchaseRequests: purchaseRequests.map((request) => ({
      id: request.id,
      documentNo: request.documentNo,
      documentDate: request.documentDate.toISOString(),
      subject: request.subject,
      requestedAmount: Number(request.requestedAmount),
      status: request.status,
      createdByName: request.createdBy?.fullName ?? "ระบบ",
      activityName: request.activity?.name ?? null,
      itemCount: request.items.length,
      updatedAt: request.updatedAt.toISOString(),
    })),
  };

  return <ProjectDetailClient data={data} />;
}
