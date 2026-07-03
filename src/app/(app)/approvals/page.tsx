import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getApprovalQueue,
  type ApprovalQueueQueryValues,
} from "@/lib/approval-list-service";
import { ApprovalsClient } from "./_components/approvals-client";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<
    Partial<Record<keyof ApprovalQueueQueryValues, string | string[]>>
  >;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const resolvedSearchParams = await searchParams;

  const [approvalQueue, departments] = await Promise.all([
    session?.user
      ? getApprovalQueue(session.user, resolvedSearchParams)
      : Promise.resolve({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          filters: {
            q: "",
            status: "",
            departmentId: "",
            sortBy: "updatedAt" as const,
            sortDir: "desc" as const,
            page: "1",
            limit: "10",
          },
        }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <ApprovalsClient
      initialProjects={approvalQueue.data}
      role={role ?? ""}
      total={approvalQueue.total}
      page={approvalQueue.page}
      limit={approvalQueue.limit}
      totalPages={approvalQueue.totalPages}
      initialQuery={approvalQueue.filters}
      departments={departments.map((department) => ({
        id: department.id,
        name: department.name,
      }))}
    />
  );
}
