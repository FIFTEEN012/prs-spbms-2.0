import type { Actor } from "@/lib/authorization";
import type { Prisma } from "@prisma/client";
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

const approvalStatuses = ["SUBMITTED", "REVIEWED"] as const;
const approvalSortFields = [
  "updatedAt",
  "projectName",
  "projectCode",
  "budgetRequested",
] as const;
const approvalSortBySchema = createSortBySchema(
  approvalSortFields,
  "updatedAt",
);

export type ApprovalQueueQueryValues = {
  q: string;
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
  department: { name: string } | null;
  responsibleUser: { fullName: string } | null;
};

type ApprovalQueueFilters = Omit<ApprovalQueueQueryValues, "page" | "limit"> & {
  page: number;
  limit: number;
};

export const defaultApprovalQueueQueryValues: ApprovalQueueQueryValues = {
  q: "",
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
    status: filters.status,
    departmentId: filters.departmentId,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    limit: String(filters.limit),
  };
}

function getApprovalScope(actor: Actor): Prisma.ProjectWhereInput {
  if (actor.role === "SUPER_ADMIN") {
    return { status: { in: [...approvalStatuses] } };
  }

  if (actor.role === "DEPT_HEAD") {
    return {
      status: "SUBMITTED",
      ...(actor.departmentId ? { departmentId: actor.departmentId } : {}),
    };
  }

  if (actor.role === "EXECUTIVE") {
    return { status: "REVIEWED" };
  }

  return { id: "__no_access__" };
}

function buildApprovalQueueWhere(
  actor: Actor,
  filters: ApprovalQueueFilters,
): Prisma.ProjectWhereInput {
  const clauses: Prisma.ProjectWhereInput[] = [getApprovalScope(actor)];

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

  if (filters.status) {
    clauses.push({ status: filters.status as "SUBMITTED" | "REVIEWED" });
  }

  if (filters.departmentId) {
    clauses.push({ departmentId: filters.departmentId });
  }

  return { AND: clauses };
}

export async function getApprovalQueue(
  actor: Actor,
  source: SearchParamsSource,
): Promise<PaginatedResult<ApprovalQueueRow, ApprovalQueueQueryValues>> {
  const filters = parseApprovalQueueFilters(source);
  const where = buildApprovalQueueWhere(actor, filters);
  const total = await prisma.project.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);

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
      department: project.department ? { name: project.department.name } : null,
      responsibleUser: project.responsibleUser
        ? { fullName: project.responsibleUser.fullName }
        : null,
    })),
    total,
    page,
    limit: filters.limit,
    totalPages,
    filters: toApprovalQueueQueryValues({ ...filters, page }),
  };
}
