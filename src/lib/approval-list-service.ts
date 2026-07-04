import type { Actor } from "@/lib/authorization";
import type { Prisma, ProjectStatus } from "@prisma/client";
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

const queueApprovalStatuses = ["SUBMITTED", "REVIEWED"] as const;
const approvalStatuses = [
  "DRAFT",
  "SUBMITTED",
  "REVIEWED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly ProjectStatus[];
const approvalSortFields = [
  "createdAt",
  "updatedAt",
  "projectName",
  "projectCode",
  "budgetRequested",
  "budgetApproved",
  "status",
] as const;
const approvalSortBySchema = createSortBySchema(
  approvalSortFields,
  "updatedAt",
);

export type ApprovalQueueQueryValues = {
  q: string;
  projectCode: string;
  status: string;
  departmentId: string;
  sortBy: (typeof approvalSortFields)[number];
  sortDir: "asc" | "desc";
  page: string;
  limit: string;
};

export type ApprovalQueueRow = {
  id: string;
  projectCode: string;
  projectName: string;
  budgetRequested: number;
  status: string;
  updatedAt: string;
  objectives: string | null;
  startDate: string | null;
  endDate: string | null;
  department: { name: string } | null;
  responsibleUser: { fullName: string } | null;
};

export type ApprovalQueueSummary = {
  total: number;
  submitted: number;
  reviewed: number;
  pending: number;
  totalBudgetRequested: number;
};

type ApprovalQueueFilters = Omit<ApprovalQueueQueryValues, "page" | "limit"> & {
  page: number;
  limit: number;
};

export const defaultApprovalQueueQueryValues: ApprovalQueueQueryValues = {
  q: "",
  projectCode: "",
  status: "",
  departmentId: "",
  sortBy: "updatedAt",
  sortDir: "desc",
  page: "1",
  limit: "10",
};

export function parseApprovalQueueFilters(
  source: SearchParamsSource,
): ApprovalQueueFilters {
  const pagination = parsePaginationParams(source);
  const record = searchParamsToRecord(source);
  const status = parseOptionalStringParam(source, "status");

  return {
    q: parseOptionalStringParam(source, "q") ?? "",
    projectCode: parseOptionalStringParam(source, "projectCode") ?? "",
    status: status &&
      approvalStatuses.includes(status as (typeof approvalStatuses)[number])
      ? status
      : "",
    departmentId: parseOptionalStringParam(source, "departmentId") ?? "",
    sortBy: approvalSortBySchema.parse(record.sortBy),
    sortDir: sortDirectionSchema.parse(record.sortDir),
    page: pagination.page,
    limit: pagination.limit,
  };
}

export function toApprovalQueueQueryValues(
  filters: ApprovalQueueFilters,
): ApprovalQueueQueryValues {
  return {
    q: filters.q,
    projectCode: filters.projectCode,
    status: filters.status,
    departmentId: filters.departmentId,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    limit: String(filters.limit),
  };
}

function getApprovalScope(
  actor: Actor,
  filters: ApprovalQueueFilters,
): Prisma.ProjectWhereInput {
  if (actor.role === "SUPER_ADMIN") {
    return filters.status ? {} : { status: { in: [...queueApprovalStatuses] } };
  }

  if (actor.role === "DEPT_HEAD") {
    return {
      ...(filters.status ? {} : { status: "SUBMITTED" }),
      ...(actor.departmentId ? { departmentId: actor.departmentId } : {}),
    };
  }

  if (actor.role === "EXECUTIVE") {
    return filters.status ? {} : { status: "REVIEWED" };
  }

  return { id: "__no_access__" };
}

function buildApprovalQueueWhere(
  actor: Actor,
  filters: ApprovalQueueFilters,
): Prisma.ProjectWhereInput {
  const clauses: Prisma.ProjectWhereInput[] = [
    getApprovalScope(actor, filters),
  ];

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
      ],
    });
  }

  if (filters.projectCode) {
    clauses.push({
      projectCode: { contains: filters.projectCode, mode: "insensitive" },
    });
  }

  if (filters.status) {
    clauses.push({ status: filters.status as ProjectStatus });
  }

  if (filters.departmentId) {
    clauses.push({ departmentId: filters.departmentId });
  }

  return { AND: clauses };
}

export async function getApprovalQueue(
  actor: Actor,
  source: SearchParamsSource,
): Promise<
  PaginatedResult<ApprovalQueueRow, ApprovalQueueQueryValues> & {
    summary: ApprovalQueueSummary;
  }
> {
  const filters = parseApprovalQueueFilters(source);
  const where = buildApprovalQueueWhere(actor, filters);
  const [total, summaryGroups, budgetAggregate] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.project.aggregate({
      where,
      _sum: { budgetRequested: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);
  const statusCounts = new Map(
    summaryGroups.map((group) => [group.status, group._count._all]),
  );

  const projects = await prisma.project.findMany({
    where,
    include: { department: true, responsibleUser: true },
    orderBy: { [filters.sortBy]: filters.sortDir },
    skip: getPaginationSkip(page, filters.limit),
    take: filters.limit,
  });

  return {
    data: projects.map((project) => ({
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      budgetRequested: Number(project.budgetRequested),
      status: project.status,
      updatedAt: project.updatedAt.toISOString(),
      objectives: project.objectives,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      department: project.department ? { name: project.department.name } : null,
      responsibleUser: project.responsibleUser
        ? { fullName: project.responsibleUser.fullName }
        : null,
    })),
    summary: {
      total,
      submitted: statusCounts.get("SUBMITTED") ?? 0,
      reviewed: statusCounts.get("REVIEWED") ?? 0,
      pending:
        (statusCounts.get("SUBMITTED") ?? 0) +
        (statusCounts.get("REVIEWED") ?? 0),
      totalBudgetRequested: Number(budgetAggregate._sum.budgetRequested ?? 0),
    },
    total,
    page,
    limit: filters.limit,
    totalPages,
    filters: toApprovalQueueQueryValues({ ...filters, page }),
  };
}
