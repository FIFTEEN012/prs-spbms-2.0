import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  CheckCircle2,
  Clock3,
  FilePlus2,
  FolderKanban,
  Home,
  PenLine,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { canActOnProject } from "@/lib/authorization";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getActiveAcademicYearReference, getDepartmentsReference } from "@/lib/reference-data";
import {
  getProjectList,
  type ProjectListQueryValues,
  type ProjectListSummary,
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

  const responsibleUserWhere =
    role === "SUPER_ADMIN" ||
    role === "EXECUTIVE" ||
    role === "FINANCE" ||
    role === "PROCUREMENT"
      ? {}
      : {
          OR: [
            { id: session.user.id },
            ...(session.user.departmentId
              ? [{ departmentId: session.user.departmentId }]
              : []),
          ],
        };

  const [projectList, departments, activeYear, academicYears, responsibleUsers, allVisibleProjects] =
    await Promise.all([
    getProjectList(session.user, resolvedSearchParams),
    getDepartmentsReference(),
    getActiveAcademicYearReference(),
    prisma.academicYear.findMany({
      orderBy: [{ isActive: "desc" }, { yearName: "desc" }],
      select: { id: true, yearName: true, isActive: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        responsibleProjects: { some: {} },
        ...responsibleUserWhere,
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, departmentId: true },
    }),
    prisma.project.findMany({
      where: {
        status: "DRAFT",
        ...(session.user.departmentId
          ? {
              OR: [
                { departmentId: session.user.departmentId },
                { responsibleUserId: session.user.id },
              ],
            }
          : {}),
      },
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
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card/85 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between md:p-6">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Home className="size-3.5" />
              <span>หน้าหลัก</span>
              <span>/</span>
              <span className="text-primary">จัดการโครงการ</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
              โครงการพัฒนาสถานศึกษา
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              จัดการ ติดตาม และตรวจสอบสถานะโครงการตามแผนปฏิบัติการประจำปี
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              ปีการศึกษา {activeYear?.yearName ?? "ยังไม่ได้กำหนด"}
            </div>
          </div>

          {can(role, "project.create") && (
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
              <ImportCsvButton />
              <Button asChild className="w-full gap-2 rounded-lg px-5 font-bold shadow-sm sm:w-auto">
                <Link href="/projects/new">
                  <FilePlus2 className="size-4" />
                  สร้างโครงการใหม่
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <ProjectSummaryCards summary={projectList.summary} />

      <ProjectsClient
        projects={projectList.data}
        total={projectList.total}
        page={projectList.page}
        limit={projectList.limit}
        totalPages={projectList.totalPages}
        initialQuery={projectList.filters}
        currentUserId={session.user.id}
        currentRole={session.user.role}
        canCreateProject={can(role, "project.create")}
        activeAcademicYearName={activeYear?.yearName ?? null}
        academicYears={academicYears.map((year) => ({
          id: year.id,
          yearName: year.yearName,
          isActive: year.isActive,
        }))}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        responsibleUsers={responsibleUsers.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          departmentId: user.departmentId,
        }))}
        bulkSubmitButtonElement={bulkSubmitButton}
      />
    </div>
  );
}

function ProjectSummaryCards({ summary }: { summary: ProjectListSummary }) {
  const cards = [
    {
      label: "โครงการทั้งหมด",
      value: summary.total,
      icon: FolderKanban,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "โครงการของฉัน",
      value: summary.mine,
      icon: UserRound,
      tone: "bg-violet-100 text-violet-700",
    },
    {
      label: "ร่างโครงการ",
      value: summary.draft,
      icon: PenLine,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "รออนุมัติ",
      value: summary.pending,
      icon: Clock3,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "อนุมัติ/ดำเนินการ",
      value: summary.approved,
      icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "ตีกลับ",
      value: summary.rejected,
      icon: RotateCcw,
      tone: "bg-rose-100 text-rose-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-lg border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur"
          >
            <div className={`flex size-12 items-center justify-center rounded-full ${card.tone}`}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
