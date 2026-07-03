import Link from "next/link";
import { getServerSession } from "next-auth";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { canActOnProject } from "@/lib/authorization";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  getProjectList,
  type ProjectListQueryValues,
} from "@/lib/project-list-service";
import { BulkSubmitButton } from "./_components/bulk-submit-button";
import { ImportCsvButton } from "./_components/import-csv-button";
import { ProjectsClient } from "./_components/projects-client";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<keyof ProjectListQueryValues, string | string[]>>>;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const resolvedSearchParams = await searchParams;

  if (!session?.user) {
    return null;
  }

  const [projectList, departments, allVisibleProjects] = await Promise.all([
    getProjectList(session.user, resolvedSearchParams),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: session.user.departmentId
        ? {
            OR: [
              { departmentId: session.user.departmentId },
              { responsibleUserId: session.user.id },
            ],
          }
        : undefined,
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        budgetRequested: true,
        status: true,
        departmentId: true,
        responsibleUserId: true,
      },
    }),
  ]);

  const draftProjects = allVisibleProjects
    .filter(
      (project) =>
        project.status === "DRAFT" &&
        canActOnProject(session.user, project, "submit"),
    )
    .map((project) => ({
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      budgetRequested: Number(project.budgetRequested),
    }));

  const bulkSubmitButton =
    draftProjects.length > 0 ? (
      <BulkSubmitButton key="bulk-submit-btn" draftProjects={draftProjects} />
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            โครงการ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            รายการโครงการทั้งหมด
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          {can(role, "project.create") && (
            <>
              <ImportCsvButton />
              <Button asChild className="w-full sm:w-auto">
                <Link href="/projects/new">+ สร้างโครงการ</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <ProjectsClient
        projects={projectList.data}
        total={projectList.total}
        page={projectList.page}
        limit={projectList.limit}
        totalPages={projectList.totalPages}
        initialQuery={projectList.filters}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        bulkSubmitButtonElement={bulkSubmitButton}
      />
    </div>
  );
}
