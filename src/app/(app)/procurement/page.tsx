import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  getPurchaseRequestList,
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
  const resolvedSearchParams = await searchParams;

  const [requestList, projects] = await Promise.all([
    getPurchaseRequestList(resolvedSearchParams, { role }),
    prisma.project.findMany({
      where: { status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] } },
      include: { department: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const canRecord = (project: (typeof projects)[number]) => {
    if (can(role, "procurement.record") || role === "SUPER_ADMIN") return true;
    return (
      (role === "TEACHER" || role === "DEPT_HEAD") &&
      session?.user?.departmentId != null &&
      session.user.departmentId === project.departmentId
    );
  };

  const availableProjects = projects.filter(canRecord);
  const showProcureCol = availableProjects.length > 0;

  return (
    <ProcurementClient
      requests={requestList.data}
      availableProjects={availableProjects.map((project) => ({
        id: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        department: project.department ? { name: project.department.name } : null,
      }))}
      showProcureCol={showProcureCol}
      total={requestList.total}
      page={requestList.page}
      limit={requestList.limit}
      totalPages={requestList.totalPages}
      initialQuery={requestList.filters}
    />
  );
}
