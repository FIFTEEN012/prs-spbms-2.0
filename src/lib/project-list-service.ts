import { Prisma, type ProjectStatus } from "@prisma/client";
import {
  canActOnProject,
  canEditProject,
  canReadProject,
  canViewProjectBudgetHistory,
  type Actor,
} from "@/lib/authorization";
import { summarizeProjectBudget } from "@/lib/budget-summary";
import {
  createSortBySchema,
  getPaginationSkip,
  parseOptionalStringParam,
  parsePaginationParams,
  searchParamsToRecord,
  sortDirectionSchema,
  type PaginatedResult,
  type SearchParamsSource,
} from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";

const projectSortFields = [
  "createdAt",
  "updatedAt",
  "projectName",
  "projectCode",
  "budgetRequested",
  "budgetApproved",
  "status",
] as const;

const projectStatuses = [
  "DRAFT",
  "SUBMITTED",
  "REVIEWED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly ProjectStatus[];

const projectSortBySchema = createSortBySchema(projectSortFields, "createdAt");

export type ProjectListQueryValues = {
  q: string;
  status: string;
  departmentId: string;
  academicYearId: string;
  responsibleUserId: string;
  mine: string;
  sortBy: (typeof projectSortFields)[number];
  sortDir: "asc" | "desc";
  page: string;
  limit: string;
};

export type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
  departmentName: string;
  responsibleUserId: string | null;
  responsibleFullName: string;
  budgetRequested: number;
  budgetApproved: number;
  budgetNetSpent: number;
  budgetRemaining: number;
  expenseCount: number;
  historyCount: number;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  status: string;
  canDelete: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canReviewApprove: boolean;
  canApprove: boolean;
  canReject: boolean;
  canViewBudgetHistory: boolean;
  canCreatePurchaseRequest: boolean;
  activities: Array<{
    id: string;
    name: string;
    budget: number;
    netSpent: number;
    remaining: number;
    expenseCount: number;
    percentUsed: number;
  }>;
};

export type ProjectListSummary = {
  total: number;
  mine: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type ProjectListFilters = Omit<ProjectListQueryValues, "page" | "limit"> & {
  page: number;
  limit: number;
};

export const defaultProjectListQueryValues: ProjectListQueryValues = {
  q: "",
  status: "",
  departmentId: "",
  academicYearId: "",
  responsibleUserId: "",
  mine: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: "1",
  limit: "10",
};

function parseProjectStatus(source: SearchParamsSource) {
  const value = parseOptionalStringParam(source, "status");

  return projectStatuses.includes(value as ProjectStatus) ? value : undefined;
}

function parseBooleanFlagParam(source: SearchParamsSource, key: string) {
  const value = parseOptionalStringParam(source, key);
  return value === "1" ? "1" : "";
}

export function parseProjectListFilters(
  source: SearchParamsSource,
): ProjectListFilters {
  const pagination = parsePaginationParams(source);
  const record = searchParamsToRecord(source);

  return {
    q: parseOptionalStringParam(source, "q") ?? "",
    status: parseProjectStatus(source) ?? "",
    departmentId: parseOptionalStringParam(source, "departmentId") ?? "",
    academicYearId: parseOptionalStringParam(source, "academicYearId") ?? "",
    responsibleUserId: parseOptionalStringParam(source, "responsibleUserId") ?? "",
    mine: parseBooleanFlagParam(source, "mine"),
    sortBy: projectSortBySchema.parse(record.sortBy),
    sortDir: sortDirectionSchema.parse(record.sortDir),
    page: pagination.page,
    limit: pagination.limit,
  };
}

export function toProjectListQueryValues(
  filters: ProjectListFilters,
): ProjectListQueryValues {
  return {
    q: filters.q,
    status: filters.status,
    departmentId: filters.departmentId,
    academicYearId: filters.academicYearId,
    responsibleUserId: filters.responsibleUserId,
    mine: filters.mine,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    limit: String(filters.limit),
  };
}

function buildProjectAccessWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (
    actor.role === "SUPER_ADMIN" ||
    actor.role === "EXECUTIVE" ||
    actor.role === "FINANCE" ||
    actor.role === "PROCUREMENT"
  ) {
    return {};
  }

  if (actor.role === "COMMITTEE") {
    return { status: { in: ["IN_PROGRESS", "COMPLETED"] } };
  }

  const accessConditions: Prisma.ProjectWhereInput[] = [];

  if (actor.departmentId) {
    accessConditions.push({ departmentId: actor.departmentId });
  }

  accessConditions.push({ responsibleUserId: actor.id });

  return { OR: accessConditions };
}

function buildProjectWhere(
  actor: Actor,
  filters: ProjectListFilters,
): Prisma.ProjectWhereInput {
  const clauses: Prisma.ProjectWhereInput[] = [buildProjectAccessWhere(actor)];

  if (filters.q) {
    clauses.push({
      OR: [
        { projectName: { contains: filters.q, mode: "insensitive" } },
        { projectCode: { contains: filters.q, mode: "insensitive" } },
        {
          responsibleUser: {
            is: {
              fullName: { contains: filters.q, mode: "insensitive" },
            },
          },
        },
        {
          activities: {
            some: {
              name: { contains: filters.q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (filters.status) {
    clauses.push({ status: filters.status as ProjectStatus });
  }

  if (filters.departmentId) {
    clauses.push({ departmentId: filters.departmentId });
  }

  if (filters.academicYearId) {
    clauses.push({ academicYearId: filters.academicYearId });
  }

  if (filters.responsibleUserId) {
    clauses.push({ responsibleUserId: filters.responsibleUserId });
  }

  if (filters.mine === "1") {
    clauses.push({ responsibleUserId: actor.id });
  }

  return { AND: clauses };
}

function buildProjectOrderBy(
  filters: ProjectListFilters,
): Prisma.ProjectOrderByWithRelationInput {
  return {
    [filters.sortBy]: filters.sortDir,
  };
}

function parseBorrowedFrom(value: unknown): Array<{
  projectId?: string;
  activityId: string;
  amount: number;
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

export async function getProjectList(
  actor: Actor,
  source: SearchParamsSource,
): Promise<
  PaginatedResult<ProjectRow, ProjectListQueryValues> & {
    summary: ProjectListSummary;
  }
> {
  const filters = parseProjectListFilters(source);
  const where = buildProjectWhere(actor, filters);
  const summaryWhere = buildProjectWhere(actor, { ...filters, status: "" });
  const mineWhere = buildProjectWhere(actor, {
    ...filters,
    status: "",
    responsibleUserId: "",
    mine: "1",
  });
  const [total, mineTotal, summaryGroups] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.count({ where: mineWhere }),
    prisma.project.groupBy({
      by: ["status"],
      where: summaryWhere,
      _count: { _all: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);

  const projects = await prisma.project.findMany({
    where,
    orderBy: buildProjectOrderBy(filters),
    skip: getPaginationSkip(page, filters.limit),
    take: filters.limit,
    include: {
      department: { select: { name: true } },
      responsibleUser: { select: { fullName: true } },
      activities: {
        select: {
          id: true,
          name: true,
          budget: true,
        },
      },
    },
  });

  const projectIds = projects.map((p) => p.id);
  const purchaseRequests = projectIds.length
    ? await prisma.purchaseRequest.findMany({
        where: {
          status: { not: "REJECTED" },
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
          id: true,
          projectId: true,
          activityId: true,
          requestedAmount: true,
          borrowedFrom: true,
          status: true,
        },
      })
    : [];

  const transactionGroups = projects.length
    ? await prisma.budgetTransaction.groupBy({
        by: ["projectId", "transactionType"],
        where: { projectId: { in: projectIds } },
        _sum: { amount: true },
        _count: { _all: true },
      })
    : [];

  const groupsByProject = new Map<
    string,
    Array<{
      transactionType: (typeof transactionGroups)[number]["transactionType"];
      amount: number;
      count: number;
    }>
  >();

  for (const group of transactionGroups) {
    const current = groupsByProject.get(group.projectId) ?? [];
    current.push({
      transactionType: group.transactionType,
      amount: Number(group._sum.amount ?? 0),
      count: group._count._all,
    });
    groupsByProject.set(group.projectId, current);
  }

  const pageProjectIds = new Set(projectIds);
  const activitySpendByKey = new Map<
    string,
    { netSpent: number; requestIds: Set<string> }
  >();
  const addActivitySpend = (
    projectId: string | undefined,
    activityId: string | null | undefined,
    amount: number,
    requestId: string,
  ) => {
    if (!projectId || !activityId || !pageProjectIds.has(projectId)) return;

    const key = getActivitySpendKey(projectId, activityId);
    const current = activitySpendByKey.get(key) ?? {
      netSpent: 0,
      requestIds: new Set<string>(),
    };

    current.netSpent += amount;
    current.requestIds.add(requestId);
    activitySpendByKey.set(key, current);
  };

  for (const req of purchaseRequests) {
    const borrowedList = parseBorrowedFrom(req.borrowedFrom);
    const totalBorrowed = borrowedList.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    addActivitySpend(
      req.projectId,
      req.activityId,
      Number(req.requestedAmount) - totalBorrowed,
      req.id,
    );

    for (const item of borrowedList) {
      addActivitySpend(
        item.projectId || req.projectId,
        item.activityId,
        Number(item.amount) || 0,
        req.id,
      );
    }
  }

  const data = projects
    .filter((project) => canReadProject(actor, project))
    .map((project) => {
      const budget = summarizeProjectBudget(
        project.budgetApproved,
        groupsByProject.get(project.id) ?? [],
      );

      const activities = project.activities.map((a) => {
        const spend = activitySpendByKey.get(
          getActivitySpendKey(project.id, a.id),
        );
        const netSpent = spend?.netSpent ?? 0;
        const expenseCount = spend?.requestIds.size ?? 0;
        const remaining = Number(a.budget) - netSpent;
        const percentUsed =
          Number(a.budget) > 0 ? (netSpent / Number(a.budget)) * 100 : 0;

        return {
          id: a.id,
          name: a.name,
          budget: Number(a.budget),
          netSpent,
          remaining,
          expenseCount,
          percentUsed,
        };
      });

      return {
        id: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        departmentName: project.department?.name ?? "-",
        responsibleUserId: project.responsibleUserId,
        responsibleFullName: project.responsibleUser?.fullName ?? "-",
        budgetRequested: Number(project.budgetRequested),
        budgetApproved: Number(project.budgetApproved),
        budgetNetSpent: budget.netSpent,
        budgetRemaining: budget.remaining,
        expenseCount: budget.expenseCount,
        historyCount: budget.historyCount,
        startDate: project.startDate ? project.startDate.toISOString() : null,
        endDate: project.endDate ? project.endDate.toISOString() : null,
        updatedAt: project.updatedAt.toISOString(),
        status: project.status,
        canDelete: actor.role === "SUPER_ADMIN" || canEditProject(actor, project),
        canEdit: canEditProject(actor, project),
        canSubmit:
          project.status === "DRAFT" &&
          canActOnProject(actor, project, "submit"),
        canReviewApprove:
          project.status === "SUBMITTED" &&
          canActOnProject(actor, project, "dept_approve"),
        canApprove:
          project.status === "REVIEWED" &&
          canActOnProject(actor, project, "executive_approve"),
        canReject:
          (project.status === "SUBMITTED" || project.status === "REVIEWED") &&
          canActOnProject(actor, project, "reject_to_draft"),
        canViewBudgetHistory: canViewProjectBudgetHistory(actor, project),
        canCreatePurchaseRequest:
          actor.role === "SUPER_ADMIN" ||
          (actor.role === "PROCUREMENT" &&
            (project.status === "APPROVED" ||
              project.status === "IN_PROGRESS" ||
              project.status === "COMPLETED")),
        activities,
      };
    });

  const statusCounts = new Map(
    summaryGroups.map((group) => [group.status, group._count._all]),
  );
  const summary: ProjectListSummary = {
    total: summaryGroups.reduce((sum, group) => sum + group._count._all, 0),
    mine: mineTotal,
    draft: statusCounts.get("DRAFT") ?? 0,
    pending: (statusCounts.get("SUBMITTED") ?? 0) + (statusCounts.get("REVIEWED") ?? 0),
    approved:
      (statusCounts.get("APPROVED") ?? 0) +
      (statusCounts.get("IN_PROGRESS") ?? 0) +
      (statusCounts.get("COMPLETED") ?? 0),
    rejected: statusCounts.get("REJECTED") ?? 0,
  };

  return {
    data,
    total,
    page,
    limit: filters.limit,
    totalPages,
    filters: toProjectListQueryValues({ ...filters, page }),
    summary,
  };
}
