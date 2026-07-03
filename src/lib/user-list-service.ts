import type { Prisma, Role } from "@prisma/client";
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

const roleValues = [
  "SUPER_ADMIN",
  "EXECUTIVE",
  "DEPT_HEAD",
  "TEACHER",
  "FINANCE",
  "PROCUREMENT",
  "COMMITTEE",
] as const satisfies readonly Role[];

const userSortFields = [
  "fullName",
  "username",
  "role",
  "createdAt",
] as const;

const userSortBySchema = createSortBySchema(userSortFields, "fullName");

export type UserListQueryValues = {
  q: string;
  role: string;
  isActive: string;
  departmentId: string;
  sortBy: (typeof userSortFields)[number];
  sortDir: "asc" | "desc";
  page: string;
  limit: string;
};

export type UserListRow = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  departmentId: string | null;
  isActive: boolean;
  department: {
    id: string;
    name: string;
  } | null;
};

type UserListFilters = Omit<UserListQueryValues, "page" | "limit"> & {
  page: number;
  limit: number;
};

export const defaultUserListQueryValues: UserListQueryValues = {
  q: "",
  role: "",
  isActive: "",
  departmentId: "",
  sortBy: "fullName",
  sortDir: "asc",
  page: "1",
  limit: "10",
};

export function parseUserListFilters(source: SearchParamsSource): UserListFilters {
  const pagination = parsePaginationParams(source);
  const record = searchParamsToRecord(source);
  const role = parseOptionalStringParam(source, "role");
  const isActive = parseOptionalStringParam(source, "isActive");

  return {
    q: parseOptionalStringParam(source, "q") ?? "",
    role: role && roleValues.includes(role as Role) ? role : "",
    isActive: isActive === "true" || isActive === "false" ? isActive : "",
    departmentId: parseOptionalStringParam(source, "departmentId") ?? "",
    sortBy: userSortBySchema.parse(record.sortBy),
    sortDir: sortDirectionSchema.parse(record.sortDir),
    page: pagination.page,
    limit: pagination.limit,
  };
}

export function toUserListQueryValues(filters: UserListFilters): UserListQueryValues {
  return {
    q: filters.q,
    role: filters.role,
    isActive: filters.isActive,
    departmentId: filters.departmentId,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    limit: String(filters.limit),
  };
}

function buildUserWhere(filters: UserListFilters): Prisma.UserWhereInput {
  const clauses: Prisma.UserWhereInput[] = [];

  if (filters.q) {
    clauses.push({
      OR: [
        { fullName: { contains: filters.q, mode: "insensitive" } },
        { username: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
        { phone: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.role) {
    clauses.push({ role: filters.role as Role });
  }

  if (filters.isActive) {
    clauses.push({ isActive: filters.isActive === "true" });
  }

  if (filters.departmentId) {
    clauses.push({ departmentId: filters.departmentId });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function getUserList(
  source: SearchParamsSource,
): Promise<PaginatedResult<UserListRow, UserListQueryValues>> {
  const filters = parseUserListFilters(source);
  const where = buildUserWhere(filters);
  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);

  const users = await prisma.user.findMany({
    where,
    include: { department: true },
    orderBy: { [filters.sortBy]: filters.sortDir },
    skip: getPaginationSkip(page, filters.limit),
    take: filters.limit,
  });

  const data = users.map((user) => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    departmentId: user.departmentId,
    isActive: user.isActive,
    department: user.department
      ? { id: user.department.id, name: user.department.name }
      : null,
  }));

  return {
    data,
    total,
    page,
    limit: filters.limit,
    totalPages,
    filters: toUserListQueryValues({ ...filters, page }),
  };
}
