import { Prisma, type PurchaseRequestStatus } from "@prisma/client";
import { parseThaiDateStr } from "@/lib/date-utils";
import {
  createSortBySchema,
  getPaginationSkip,
  parseOptionalDateParam,
  parseOptionalMonthParam,
  parseOptionalNumberParam,
  parseOptionalStringParam,
  parsePaginationParams,
  searchParamsToRecord,
  sortDirectionSchema,
  type PaginatedResult,
  type SearchParamsSource,
} from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";

const requestStatuses = [
  "PENDING",
  "PLAN_REVIEWED",
  "FINANCE_REVIEWED",
  "PROCUREMENT_REVIEWED",
  "BUDGET_REVIEWED",
  "APPROVED",
  "REJECTED",
] as const satisfies readonly PurchaseRequestStatus[];

const requestSortFields = [
  "createdAt",
  "documentDate",
  "requestedAmount",
  "status",
  "subject",
] as const;

const requestSortBySchema = createSortBySchema(
  requestSortFields,
  "createdAt",
);

export type PurchaseRequestListQueryValues = {
  q: string;
  status: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  sortBy: (typeof requestSortFields)[number];
  sortDir: "asc" | "desc";
  page: string;
  limit: string;
};

export type PurchaseRequestListRow = {
  id: string;
  documentDate: string;
  documentNo: string | null;
  subject: string;
  category: string;
  categoryDetails: string | null;
  fundSourceId: string | null;
  budgetWalletId: string | null;
  actionPlanPage: string | null;
  isNotInPlan: boolean;
  necessityDetails: string | null;
  committee: unknown;
  borrowedFrom: unknown;
  requestedAmount: number;
  allocatedBudget: number | null;
  previousBalance: number | null;
  remainingBalance: number | null;
  activityCurrentRemaining: number | null;
  status: string;
  canInlineEdit: boolean;
  itemCount: number;
  itemSummary: string;
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    departmentName: string | null;
  };
  activity: {
    id: string;
    name: string;
    budget: number;
  } | null;
  fundSource: { id: string; name: string } | null;
  budgetWallet: { id: string; code: string; name: string } | null;
  items: Array<{
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    remarks: string | null;
  }>;
  createdBy: { fullName: string } | null;
};

type PurchaseRequestListActor = {
  role?: string | null;
  userId?: string | null;
  departmentId?: string | null;
};

type PurchaseRequestListFilters = Omit<
  PurchaseRequestListQueryValues,
  "page" | "limit" | "dateFrom" | "dateTo" | "minAmount" | "maxAmount"
> & {
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  page: number;
  limit: number;
};

export const defaultPurchaseRequestListQueryValues: PurchaseRequestListQueryValues =
  {
    q: "",
    status: "",
    month: "",
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
    sortBy: "createdAt",
    sortDir: "desc",
    page: "1",
    limit: "10",
  };

export function parsePurchaseRequestListFilters(
  source: SearchParamsSource,
): PurchaseRequestListFilters {
  const pagination = parsePaginationParams(source);
  const record = searchParamsToRecord(source);
  const status = parseOptionalStringParam(source, "status");

  return {
    q: parseOptionalStringParam(source, "q") ?? "",
    status: status && requestStatuses.includes(status as PurchaseRequestStatus)
      ? status
      : "",
    month: parseOptionalMonthParam(source, "month") ?? "",
    dateFrom: parseOptionalDateParam(source, "dateFrom", parseThaiDateStr),
    dateTo: parseOptionalDateParam(source, "dateTo", parseThaiDateStr),
    minAmount: parseOptionalNumberParam(source, "minAmount"),
    maxAmount: parseOptionalNumberParam(source, "maxAmount"),
    sortBy: requestSortBySchema.parse(record.sortBy),
    sortDir: sortDirectionSchema.parse(record.sortDir),
    page: pagination.page,
    limit: pagination.limit,
  };
}

export function toPurchaseRequestListQueryValues(
  filters: PurchaseRequestListFilters & { page: number },
): PurchaseRequestListQueryValues {
  const formatDate = (value?: Date) =>
    value ? value.toISOString().slice(0, 10) : "";

  return {
    q: filters.q,
    status: filters.status,
    month: filters.month,
    dateFrom: formatDate(filters.dateFrom),
    dateTo: formatDate(filters.dateTo),
    minAmount:
      typeof filters.minAmount === "number" ? String(filters.minAmount) : "",
    maxAmount:
      typeof filters.maxAmount === "number" ? String(filters.maxAmount) : "",
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    limit: String(filters.limit),
  };
}

function parseBorrowedFrom(value: unknown): Array<{
  projectId?: string;
  activityId?: string;
  amount?: number | string | null;
}> {
  if (Array.isArray(value)) return value as any;
  if (typeof value !== "string" || value.trim() === "") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getActivitySpendKey(projectId: string, activityId: string) {
  return `${projectId}:${activityId}`;
}

export function buildPurchaseRequestWhere(
  filters: PurchaseRequestListFilters,
  actor: PurchaseRequestListActor = {},
): Prisma.PurchaseRequestWhereInput {
  const clauses: Prisma.PurchaseRequestWhereInput[] = [];

  // RBAC rules for visibility
  if (actor.role === "TEACHER" && actor.userId) {
    clauses.push({ createdById: actor.userId });
  } else if (actor.role === "DEPT_HEAD" && actor.departmentId) {
    clauses.push({
      project: {
        departmentId: actor.departmentId,
      },
    });
  }

  if (filters.q) {
    clauses.push({
      OR: [
        { subject: { contains: filters.q, mode: "insensitive" } },
        { documentNo: { contains: filters.q, mode: "insensitive" } },
        {
          project: {
            is: {
              projectName: { contains: filters.q, mode: "insensitive" },
            },
          },
        },
        {
          createdBy: {
            is: {
              fullName: { contains: filters.q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (filters.status) {
    clauses.push({ status: filters.status as PurchaseRequestStatus });
  }

  if (filters.month) {
    const monthStart = new Date(`${filters.month}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    clauses.push({
      documentDate: {
        gte: monthStart,
        lt: monthEnd,
      },
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    clauses.push({
      documentDate: {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo
          ? {
              lte: new Date(
                new Date(filters.dateTo).setHours(23, 59, 59, 999),
              ),
            }
          : {}),
      },
    });
  }

  if (
    typeof filters.minAmount === "number" ||
    typeof filters.maxAmount === "number"
  ) {
    clauses.push({
      requestedAmount: {
        ...(typeof filters.minAmount === "number"
          ? { gte: filters.minAmount }
          : {}),
        ...(typeof filters.maxAmount === "number"
          ? { lte: filters.maxAmount }
          : {}),
      },
    });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function getPurchaseRequestList(
  source: SearchParamsSource,
  actor: PurchaseRequestListActor = {},
): Promise<PaginatedResult<PurchaseRequestListRow, PurchaseRequestListQueryValues>> {
  const filters = parsePurchaseRequestListFilters(source);
  const where = buildPurchaseRequestWhere(filters, actor);
  const total = await prisma.purchaseRequest.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);

  const requests = await prisma.purchaseRequest.findMany({
    where,
    include: {
      project: { include: { department: true } },
      activity: true,
      fundSource: true,
      budgetWallet: true,
      items: { orderBy: { createdAt: "asc" } },
      createdBy: true,
    },
    orderBy: { [filters.sortBy]: filters.sortDir },
    skip: getPaginationSkip(page, filters.limit),
    take: filters.limit,
  });

  const pageProjectIds = [...new Set(requests.map((request) => request.projectId))];
  const pageActivities = pageProjectIds.length
    ? await prisma.projectActivity.findMany({
        where: { projectId: { in: pageProjectIds } },
        select: { id: true, projectId: true, budget: true },
      })
    : [];
  const pagePurchaseRequests = pageProjectIds.length
    ? await prisma.purchaseRequest.findMany({
        where: {
          status: { not: "REJECTED" },
          OR: [
            { projectId: { in: pageProjectIds } },
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
          id: true,
          projectId: true,
          activityId: true,
          requestedAmount: true,
          borrowedFrom: true,
        },
      })
    : [];

  const pageProjectIdSet = new Set(pageProjectIds);
  const activityBudgetByKey = new Map(
    pageActivities.map((activity) => [
      getActivitySpendKey(activity.projectId, activity.id),
      Number(activity.budget),
    ]),
  );
  const activitySpendByKey = new Map<string, number>();
  const addActivitySpend = (
    projectId: string | undefined,
    activityId: string | null | undefined,
    amount: number,
  ) => {
    if (!projectId || !activityId || !pageProjectIdSet.has(projectId)) return;
    const key = getActivitySpendKey(projectId, activityId);
    activitySpendByKey.set(key, (activitySpendByKey.get(key) ?? 0) + amount);
  };

  for (const request of pagePurchaseRequests) {
    const borrowedList = parseBorrowedFrom(request.borrowedFrom);
    const totalBorrowed = borrowedList.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    addActivitySpend(
      request.projectId,
      request.activityId,
      Number(request.requestedAmount) - totalBorrowed,
    );

    for (const item of borrowedList) {
      addActivitySpend(
        item.projectId || request.projectId,
        item.activityId,
        Number(item.amount) || 0,
      );
    }
  }

  const getActivityCurrentRemaining = (
    projectId: string,
    activityId: string | null,
  ) => {
    if (!activityId) return null;
    const key = getActivitySpendKey(projectId, activityId);
    const budget = activityBudgetByKey.get(key);
    if (typeof budget !== "number") return null;
    return budget - (activitySpendByKey.get(key) ?? 0);
  };
  const canInlineEdit = actor.role === "SUPER_ADMIN";

  return {
    data: requests.map((request) => ({
      id: request.id,
      documentDate: request.documentDate.toISOString(),
      documentNo: request.documentNo,
      subject: request.subject,
      category: request.category,
      categoryDetails: request.categoryDetails,
      fundSourceId: request.fundSourceId,
      budgetWalletId: request.budgetWalletId,
      actionPlanPage: request.actionPlanPage,
      isNotInPlan: request.isNotInPlan,
      necessityDetails: request.necessityDetails,
      committee: request.committee,
      borrowedFrom: request.borrowedFrom,
      requestedAmount: Number(request.requestedAmount),
      allocatedBudget:
        request.allocatedBudget === null ? null : Number(request.allocatedBudget),
      previousBalance:
        request.previousBalance === null ? null : Number(request.previousBalance),
      remainingBalance:
        request.remainingBalance === null ? null : Number(request.remainingBalance),
      activityCurrentRemaining: getActivityCurrentRemaining(
        request.projectId,
        request.activityId,
      ),
      status: request.status,
      canInlineEdit,
      itemCount: request.items.length,
      itemSummary:
        request.items
          .slice(0, 2)
          .map((item) => item.itemName)
          .join(", ") + (request.items.length > 2 ? ` +${request.items.length - 2}` : ""),
      project: {
        id: request.project.id,
        projectCode: request.project.projectCode,
        projectName: request.project.projectName,
        departmentName: request.project.department?.name ?? null,
      },
      activity: request.activity
        ? {
            id: request.activity.id,
            name: request.activity.name,
            budget: Number(request.activity.budget),
          }
        : null,
      fundSource: request.fundSource
        ? { id: request.fundSource.id, name: request.fundSource.name }
        : null,
      budgetWallet: request.budgetWallet
        ? {
            id: request.budgetWallet.id,
            code: request.budgetWallet.code,
            name: request.budgetWallet.name,
          }
        : null,
      items: request.items.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        remarks: item.remarks,
      })),
      createdBy: request.createdBy
        ? { fullName: request.createdBy.fullName }
        : null,
    })),
    total,
    page,
    limit: filters.limit,
    totalPages,
    filters: toPurchaseRequestListQueryValues({ ...filters, page }),
  };
}
