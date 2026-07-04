import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDepartmentsReference } from "@/lib/reference-data";
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
          summary: {
            total: 0,
            submitted: 0,
            reviewed: 0,
            pending: 0,
            totalBudgetRequested: 0,
          },
          filters: {
            q: "",
            projectCode: "",
            status: "",
            departmentId: "",
            sortBy: "updatedAt" as const,
            sortDir: "desc" as const,
            page: "1",
            limit: "10",
          },
        }),
    getDepartmentsReference(),
  ]);

  return (
    <ApprovalsClient
      initialProjects={approvalQueue.data}
      role={role ?? ""}
      total={approvalQueue.total}
      page={approvalQueue.page}
      limit={approvalQueue.limit}
      totalPages={approvalQueue.totalPages}
      summary={approvalQueue.summary}
      initialQuery={approvalQueue.filters}
      departments={departments.map((department) => ({
        id: department.id,
        name: department.name,
      }))}
    />
  );
}
