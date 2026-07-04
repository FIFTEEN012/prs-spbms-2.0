import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDepartmentsReference } from "@/lib/reference-data";
import {
  getUserList,
  type UserListQueryValues,
} from "@/lib/user-list-service";
import { UsersClient } from "./_components/users-client";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<keyof UserListQueryValues, string | string[]>>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const resolvedSearchParams = await searchParams;
  const [userList, departments] = await Promise.all([
    getUserList(resolvedSearchParams),
    getDepartmentsReference(),
  ]);

  return (
    <UsersClient
      initialUsers={userList.data}
      departments={departments.map((department) => ({
        id: department.id,
        name: department.name,
      }))}
      currentUserId={session.user.id}
      total={userList.total}
      page={userList.page}
      limit={userList.limit}
      totalPages={userList.totalPages}
      initialQuery={userList.filters}
      summary={userList.summary}
    />
  );
}
