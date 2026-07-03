import { Prisma } from "@prisma/client";

type BorrowItem = {
  projectId?: string | null;
  projectName?: string | null;
  activityId?: string | null;
  activityName?: string | null;
  amount?: number | string | null;
};

type ActivityBudgetRow = {
  id: string;
  projectId: string;
  name: string;
  budget: unknown;
};

type PurchaseRequestBudgetRow = {
  projectId: string;
  activityId: string | null;
  requestedAmount: unknown;
  borrowedFrom: unknown;
};

type BudgetDb = any;

type _BudgetDbShape = {
  projectActivity: {
    findMany: (args: {
      where: { projectId: string | { in: string[] } };
    }) => Promise<ActivityBudgetRow[]>;
    findUnique: (args: {
      where: { id: string };
      include?: { fundingAllocations: boolean };
    }) => Promise<any>;
  };
  purchaseRequest: {
    findMany: (args: {
      where: {
        status: { not: string };
        id?: { not: string };
      };
      select: {
        projectId: true;
        activityId: true;
        requestedAmount: true;
        borrowedFrom: true;
      };
    }) => Promise<PurchaseRequestBudgetRow[]>;
  };
};

export type BorrowValidationResult =
  | {
      ok: true;
      mainActivity: ActivityBudgetRow;
      mainRemaining: number;
      totalBorrowedAmount: number;
      borrowedList: BorrowItem[];
      getRemainingBudget: (projectId: string, activityId: string) => number;
    }
  | { ok: false; error: string; status: number };

function parseBorrowedFrom(value: unknown): BorrowItem[] {
  if (Array.isArray(value)) return value as BorrowItem[];
  if (typeof value !== "string" || value.trim() === "") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sourceProjectIdForBorrow(item: BorrowItem, requestProjectId: string): string {
  return item.projectId || requestProjectId;
}

function findActivity(activities: ActivityBudgetRow[], projectId: string, activityId: string) {
  return activities.find((activity) => activity.projectId === projectId && activity.id === activityId);
}

function calculateRemainingBudget(
  activities: ActivityBudgetRow[],
  requests: PurchaseRequestBudgetRow[],
  projectId: string,
  activityId: string,
) {
  const activity = findActivity(activities, projectId, activityId);
  if (!activity) return 0;

  let netSpent = 0;
  for (const request of requests) {
    const borrowedList = parseBorrowedFrom(request.borrowedFrom);
    const totalBorrowed = borrowedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    if (request.projectId === projectId && request.activityId === activityId) {
      netSpent += Number(request.requestedAmount) - totalBorrowed;
    }

    for (const item of borrowedList) {
      if (
        sourceProjectIdForBorrow(item, request.projectId) === projectId &&
        item.activityId === activityId
      ) {
        netSpent += Number(item.amount) || 0;
      }
    }
  }

  return Number(activity.budget) - netSpent;
}

export async function validateBorrowingBudget(input: {
  db: BudgetDb;
  projectId: string;
  activityId: string;
  requestedAmount: number;
  borrowedFrom: unknown;
  excludeRequestId?: string;
}): Promise<BorrowValidationResult> {
  const borrowedList = Array.isArray(input.borrowedFrom) ? (input.borrowedFrom as BorrowItem[]) : [];
  const projectIds = [
    ...new Set([
      input.projectId,
      ...borrowedList
        .map((item) => item.projectId)
        .filter((projectId): projectId is string => typeof projectId === "string" && projectId.length > 0),
    ]),
  ];

  const [activities, requests] = await Promise.all([
    input.db.projectActivity.findMany({
      where: { projectId: projectIds.length === 1 ? input.projectId : { in: projectIds } },
    }),
    input.db.purchaseRequest.findMany({
      where: {
        status: { not: "REJECTED" },
        ...(input.excludeRequestId ? { id: { not: input.excludeRequestId } } : {}),
        OR: [
          { projectId: { in: projectIds } },
          {
            NOT: [
              { borrowedFrom: { equals: Prisma.DbNull } },
              { borrowedFrom: { equals: Prisma.JsonNull } },
              { borrowedFrom: { equals: [] } },
            ],
          },
        ],
      },
      select: {
        projectId: true,
        activityId: true,
        requestedAmount: true,
        borrowedFrom: true,
      },
    }),
  ]);

  const mainActivity = findActivity(activities, input.projectId, input.activityId);
  if (!mainActivity) {
    return { ok: false, error: "ไม่พบกิจกรรมย่อย", status: 404 };
  }

  const getRemainingBudget = (projectId: string, activityId: string) =>
    calculateRemainingBudget(activities, requests, projectId, activityId);
  const mainRemaining = getRemainingBudget(input.projectId, input.activityId);
  const deficit = input.requestedAmount - mainRemaining;
  let totalBorrowedAmount = 0;

  if (deficit > 0) {
    if (borrowedList.length === 0) {
      return {
        ok: false,
        error: `งบประมาณในกิจกรรมย่อยไม่เพียงพอ ขาดอยู่ ${deficit} บาท`,
        status: 400,
      };
    }

    for (const item of borrowedList) {
      const sourceProjectId = sourceProjectIdForBorrow(item, input.projectId);
      if (sourceProjectId === input.projectId && item.activityId === input.activityId) {
        return { ok: false, error: "ไม่สามารถยืมงบประมาณจากกิจกรรมตัวเองได้", status: 400 };
      }

      const activityId = item.activityId || "";
      const sourceActivity = findActivity(activities, sourceProjectId, activityId);
      if (!sourceActivity) {
        return {
          ok: false,
          error: `ไม่พบกิจกรรมย่อยที่ต้องการยืม: ${item.activityName || item.activityId}`,
          status: 400,
        };
      }

      const amount = Number(item.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        return { ok: false, error: "จำนวนเงินที่ยืมต้องมากกว่า 0", status: 400 };
      }

      const sourceRemaining = getRemainingBudget(sourceProjectId, activityId);
      if (amount > sourceRemaining) {
        return {
          ok: false,
          error: `กิจกรรมย่อย "${sourceActivity.name}" มีงบไม่พอให้ยืม (มีอยู่ ${sourceRemaining} บาท แต่ขอยืม ${amount} บาท)`,
          status: 400,
        };
      }

      totalBorrowedAmount += amount;
    }

    if (totalBorrowedAmount < deficit) {
      return {
        ok: false,
        error: `งบประมาณที่ยืมรวม (${totalBorrowedAmount} บาท) ยังไม่เพียงพอสำหรับส่วนต่างที่ขาด (${deficit} บาท)`,
        status: 400,
      };
    }
  }

  return {
    ok: true,
    mainActivity,
    mainRemaining,
    totalBorrowedAmount,
    borrowedList,
    getRemainingBudget,
  };
}
