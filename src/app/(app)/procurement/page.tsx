import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  getPurchaseRequestList,
  buildPurchaseRequestWhere,
  parsePurchaseRequestListFilters,
  type PurchaseRequestListQueryValues,
} from "@/lib/purchase-request-list-service";
import { ProcurementClient } from "./_components/procurement-client";

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<
    Partial<Record<keyof PurchaseRequestListQueryValues, string | string[]>>
  >;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const departmentId = session?.user?.departmentId;
  const resolvedSearchParams = await searchParams;

  const actor = { role, userId, departmentId };

  // Parse filters with empty search source to get the base RBAC where clause
  const baseFilters = parsePurchaseRequestListFilters({});
  const baseWhere = buildPurchaseRequestWhere(baseFilters, actor);

  const [requestList, projects] = await Promise.all([
    getPurchaseRequestList(resolvedSearchParams, actor),
    prisma.project.findMany({
      where: { status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] } },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        departmentId: true,
        department: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Aggregate stats concurrently
  const [
    totalCount,
    pendingCount,
    planReviewedCount,
    financeReviewedCount,
    budgetReviewedCount,
    approvedCount,
  ] = await Promise.all([
    prisma.purchaseRequest.count({ where: baseWhere }),
    prisma.purchaseRequest.count({
      where: { ...baseWhere, status: { in: ["PENDING", "PLAN_REVIEWED", "FINANCE_REVIEWED", "PROCUREMENT_REVIEWED", "BUDGET_REVIEWED"] } },
    }),
    prisma.purchaseRequest.count({
      where: { ...baseWhere, status: "PLAN_REVIEWED" },
    }),
    prisma.purchaseRequest.count({
      where: { ...baseWhere, status: "FINANCE_REVIEWED" },
    }),
    prisma.purchaseRequest.count({
      where: { ...baseWhere, status: "BUDGET_REVIEWED" },
    }),
    prisma.purchaseRequest.count({
      where: { ...baseWhere, status: "APPROVED" },
    }),
  ]);

  const summaryStats = {
    total: totalCount,
    pending: pendingCount,
    finance: planReviewedCount, // รอการเงินตรวจ (PLAN_REVIEWED)
    procurement: financeReviewedCount, // รอพัสดุตรวจ (FINANCE_REVIEWED)
    executive: budgetReviewedCount, // รอ ผอ. อนุมัติ (BUDGET_REVIEWED)
    approved: approvedCount,
  };

  const canRecord = (project: (typeof projects)[number]) => {
    if (can(role, "procurement.record") || role === "SUPER_ADMIN") return true;
    return (
      (role === "TEACHER" || role === "DEPT_HEAD") &&
      departmentId != null &&
      departmentId === project.departmentId
    );
  };

  const availableProjects = projects.filter(canRecord);
  const showProcureCol = availableProjects.length > 0;

  return (
    <ProcurementClient
      requests={requestList.data}
      summaryStats={summaryStats}
      showProcureCol={showProcureCol}
      total={requestList.total}
      page={requestList.page}
      limit={requestList.limit}
      totalPages={requestList.totalPages}
      initialQuery={requestList.filters}
      sessionRole={role || "GUEST"}
    />
  );
}
