import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { BudgetPlanStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import {
  createSortBySchema,
  getPaginationSkip,
  parseOptionalStringParam,
  parsePaginationParams,
  searchParamsToRecord,
  sortDirectionSchema,
  type SearchParamsSource,
} from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";
import { AcademicYearsClient, type AcademicYearsPageData, type AcademicYearsQueryValues } from "./_components/academic-years-client";

const academicYearSortFields = [
  "yearName",
  "startDate",
  "projectCount",
  "budgetPlanStatus",
  "updatedAt",
] as const;

const academicYearSortBySchema = createSortBySchema(academicYearSortFields, "yearName");

const academicYearStatusValues = ["current", "active", "inactive"] as const;

const budgetPlanStatusOrder: Record<BudgetPlanStatus, number> = {
  LOCKED: 6,
  APPROVED: 5,
  SUBMITTED: 4,
  DRAFT: 3,
  REJECTED: 2,
  CANCELLED: 1,
};

type Filters = Omit<AcademicYearsQueryValues, "page" | "limit"> & {
  page: number;
  limit: number;
};

function parseBooleanFlag(source: SearchParamsSource, key: string) {
  const value = parseOptionalStringParam(source, key);
  return value === "1" ? "1" : "";
}

function parseStatus(source: SearchParamsSource) {
  const value = parseOptionalStringParam(source, "status");
  return academicYearStatusValues.includes(value as (typeof academicYearStatusValues)[number])
    ? (value ?? "")
    : "";
}

function parseAcademicYearsFilters(source: SearchParamsSource): Filters {
  const pagination = parsePaginationParams(source);
  const record = searchParamsToRecord(source);

  return {
    q: parseOptionalStringParam(source, "q") ?? "",
    status: parseStatus(source),
    hasBudgetPlan: parseBooleanFlag(source, "hasBudgetPlan"),
    sortBy: academicYearSortBySchema.parse(record.sortBy),
    sortDir: sortDirectionSchema.parse(record.sortDir),
    page: pagination.page,
    limit: pagination.limit,
  };
}

function toQueryValues(filters: Filters & { page: number }): AcademicYearsQueryValues {
  return {
    q: filters.q,
    status: filters.status,
    hasBudgetPlan: filters.hasBudgetPlan,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    limit: String(filters.limit),
  };
}

function compareValues(left: string | number | null, right: string | number | null) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "th");
}

const budgetPlanStatusLabels: Record<BudgetPlanStatus, string> = {
  DRAFT: "ฉบับร่าง",
  SUBMITTED: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  LOCKED: "ล็อกแล้ว",
  REJECTED: "ตีกลับ",
  CANCELLED: "ยกเลิก",
};

export default async function AcademicYearsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<keyof AcademicYearsQueryValues, string | string[]>>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const filters = parseAcademicYearsFilters(await searchParams);

  const years = await prisma.academicYear.findMany({
    orderBy: { yearName: "desc" },
    select: {
      id: true,
      yearName: true,
      startDate: true,
      endDate: true,
      isActive: true,
      _count: {
        select: {
          projects: true,
          strategies: true,
          budgetPlans: true,
        },
      },
    },
  });

  const yearIds = years.map((year) => year.id);

  const [projectStatusGroups, projectPurchaseCounts, budgetPlans, auditLogs] = yearIds.length
    ? await Promise.all([
        prisma.project.groupBy({
          by: ["academicYearId", "status"],
          where: { academicYearId: { in: yearIds } },
          _count: { _all: true },
        }),
        prisma.project.findMany({
          where: { academicYearId: { in: yearIds } },
          select: {
            academicYearId: true,
            _count: {
              select: {
                purchaseRequests: true,
              },
            },
          },
        }),
        prisma.budgetPlan.findMany({
          where: { academicYearId: { in: yearIds } },
          select: {
            id: true,
            academicYearId: true,
            status: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            lockedAt: true,
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        }),
        prisma.auditLog.findMany({
          where: {
            entityName: "AcademicYear",
            entityId: { in: yearIds },
          },
          include: {
            user: {
              select: {
                fullName: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], [], [], []];

  const projectCountsByYear = new Map<string, Record<string, number>>();
  for (const group of projectStatusGroups) {
    const current = projectCountsByYear.get(group.academicYearId) ?? {};
    current[group.status] = group._count._all;
    projectCountsByYear.set(group.academicYearId, current);
  }

  const purchaseCountByYear = new Map<string, number>();
  for (const project of projectPurchaseCounts) {
    purchaseCountByYear.set(
      project.academicYearId,
      (purchaseCountByYear.get(project.academicYearId) ?? 0) + project._count.purchaseRequests,
    );
  }

  const latestBudgetPlanByYear = new Map<
    string,
    {
      id: string;
      status: BudgetPlanStatus;
      name: string;
      updatedAt: string;
      createdAt: string;
      lockedAt: string | null;
    }
  >();
  for (const plan of budgetPlans) {
    const current = latestBudgetPlanByYear.get(plan.academicYearId);
    if (!current) {
      latestBudgetPlanByYear.set(plan.academicYearId, {
        id: plan.id,
        status: plan.status,
        name: plan.name,
        updatedAt: plan.updatedAt.toISOString(),
        createdAt: plan.createdAt.toISOString(),
        lockedAt: plan.lockedAt ? plan.lockedAt.toISOString() : null,
      });
      continue;
    }

    const currentOrder = budgetPlanStatusOrder[current.status];
    const nextOrder = budgetPlanStatusOrder[plan.status];
    if (nextOrder > currentOrder) {
      latestBudgetPlanByYear.set(plan.academicYearId, {
        id: plan.id,
        status: plan.status,
        name: plan.name,
        updatedAt: plan.updatedAt.toISOString(),
        createdAt: plan.createdAt.toISOString(),
        lockedAt: plan.lockedAt ? plan.lockedAt.toISOString() : null,
      });
    }
  }

  const auditSummaryByYear = new Map<
    string,
    {
      createdAt: string | null;
      createdBy: string | null;
      latestUpdatedAt: string | null;
      latestUpdatedBy: string | null;
    }
  >();
  for (const yearId of yearIds) {
    const logs = auditLogs.filter((log) => log.entityId === yearId);
    const oldest = logs.at(-1) ?? null;
    const latest = logs[0] ?? null;
    auditSummaryByYear.set(yearId, {
      createdAt: oldest?.createdAt.toISOString() ?? null,
      createdBy: oldest?.user?.fullName ?? null,
      latestUpdatedAt: latest?.createdAt.toISOString() ?? null,
      latestUpdatedBy: latest?.user?.fullName ?? null,
    });
  }

  const mappedYears = years.map((year) => {
    const projectStatusCounts = projectCountsByYear.get(year.id) ?? {};
    const latestBudgetPlan = latestBudgetPlanByYear.get(year.id) ?? null;
    const auditSummary = auditSummaryByYear.get(year.id) ?? {
      createdAt: null,
      createdBy: null,
      latestUpdatedAt: null,
      latestUpdatedBy: null,
    };

    return {
      id: year.id,
      yearName: year.yearName,
      startDate: year.startDate ? year.startDate.toISOString() : null,
      endDate: year.endDate ? year.endDate.toISOString() : null,
      isActive: year.isActive,
      strategyCount: year._count.strategies,
      projectCount: year._count.projects,
      purchaseRequestCount: purchaseCountByYear.get(year.id) ?? 0,
      budgetPlanCount: year._count.budgetPlans,
      budgetPlanStatus: latestBudgetPlan?.status ?? null,
      budgetPlanStatusLabel: latestBudgetPlan
        ? budgetPlanStatusLabels[latestBudgetPlan.status]
        : "ยังไม่มีแผนงบประมาณ",
      budgetPlanName: latestBudgetPlan?.name ?? null,
      budgetPlanUpdatedAt: latestBudgetPlan?.updatedAt ?? null,
      createdAt: auditSummary.createdAt,
      createdBy: auditSummary.createdBy,
      updatedAt: auditSummary.latestUpdatedAt,
      updatedBy: auditSummary.latestUpdatedBy,
      projectStatusCounts: {
        draft: projectStatusCounts.DRAFT ?? 0,
        submitted: projectStatusCounts.SUBMITTED ?? 0,
        reviewed: projectStatusCounts.REVIEWED ?? 0,
        approved:
          (projectStatusCounts.APPROVED ?? 0) +
          (projectStatusCounts.IN_PROGRESS ?? 0) +
          (projectStatusCounts.COMPLETED ?? 0),
        rejected: projectStatusCounts.REJECTED ?? 0,
      },
      canDelete:
        year._count.projects === 0 &&
        year._count.budgetPlans === 0 &&
        (purchaseCountByYear.get(year.id) ?? 0) === 0,
    };
  });

  const activeYear = mappedYears.find((year) => year.isActive) ?? null;

  const filteredYears = mappedYears
    .filter((year) => {
      if (filters.q && !year.yearName.includes(filters.q.trim())) return false;
      if (filters.status === "current" && !year.isActive) return false;
      if (filters.status === "active" && !year.isActive) return false;
      if (filters.status === "inactive" && year.isActive) return false;
      if (filters.hasBudgetPlan === "1" && year.budgetPlanCount === 0) return false;
      return true;
    })
    .sort((left, right) => {
      const leftValue =
        filters.sortBy === "projectCount"
          ? left.projectCount
          : filters.sortBy === "budgetPlanStatus"
            ? left.budgetPlanStatusLabel
            : filters.sortBy === "updatedAt"
              ? left.updatedAt
              : filters.sortBy === "startDate"
                ? left.startDate
                : left.yearName;
      const rightValue =
        filters.sortBy === "projectCount"
          ? right.projectCount
          : filters.sortBy === "budgetPlanStatus"
            ? right.budgetPlanStatusLabel
            : filters.sortBy === "updatedAt"
              ? right.updatedAt
              : filters.sortBy === "startDate"
                ? right.startDate
                : right.yearName;

      const result = compareValues(leftValue, rightValue);
      return filters.sortDir === "asc" ? result : -result;
    });

  const total = filteredYears.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);
  const pagedYears = filteredYears.slice(
    getPaginationSkip(page, filters.limit),
    getPaginationSkip(page, filters.limit) + filters.limit,
  );

  const data: AcademicYearsPageData = {
    currentUserRole: session.user.role,
    canManage: session.user.role === "SUPER_ADMIN",
    currentYear: activeYear,
    summary: {
      total: mappedYears.length,
      active: mappedYears.filter((year) => year.isActive).length,
      current: activeYear ? 1 : 0,
      inactive: mappedYears.filter((year) => !year.isActive).length,
    },
    years: pagedYears,
    total,
    page,
    limit: filters.limit,
    totalPages,
    filters: toQueryValues({ ...filters, page }),
  };

  return <AcademicYearsClient data={data} />;
}
