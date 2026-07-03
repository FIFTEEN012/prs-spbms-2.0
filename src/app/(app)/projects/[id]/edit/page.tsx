import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { canEditProject } from "@/lib/authorization";
import { ProjectForm } from "../../_components/project-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: { activities: { include: { fundingAllocations: true } } },
  });

  if (!project) notFound();

  // Enforce security
  if (!canEditProject(session.user, project)) {
    redirect(`/projects/${id}`);
  }

  const [year, strategies, departments, fundSources, users, wallets] = await Promise.all([
    prisma.academicYear.findFirst({ where: { id: project.academicYearId } }),
    prisma.strategy.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.fundSource.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" } }),
    prisma.budgetWallet.findMany({ where: { budgetPlan: { status: "LOCKED" } }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">แก้ไขรายละเอียดโครงการ</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          ปีการศึกษา: {year?.yearName ?? "(ยังไม่ได้กำหนด)"}
        </p>
      </div>
      <ProjectForm
        academicYearId={project.academicYearId}
        strategies={strategies.map((s) => ({ id: s.id, label: `${s.code} — ${s.title}` }))}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        fundSources={fundSources.map((f) => ({ id: f.id, label: f.name }))}
        users={users.map((u) => ({ id: u.id, label: u.fullName }))}
        wallets={wallets.map((wallet) => ({ id: wallet.id, label: wallet.name }))}
        initial={{
          id: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
          strategyId: project.strategyId,
          departmentId: project.departmentId,
          fundSourceId: project.fundSourceId,
          responsibleUserId: project.responsibleUserId,
          startDate: project.startDate?.toISOString().slice(0, 10) || "",
          endDate: project.endDate?.toISOString().slice(0, 10) || "",
          budgetRequested: Number(project.budgetRequested),
          rationale: project.rationale || "",
          objectives: project.objectives || "",
          quantitativeTarget: project.quantitativeTarget || "",
          qualitativeTarget: project.qualitativeTarget || "",
          indicators: project.indicators || "",
          method: project.method || "",
          expectedOutcome: project.expectedOutcome || "",
          activities: project.activities.map((activity) => ({
            key: activity.id,
            name: activity.name,
            fundingAllocations: activity.fundingAllocations.map((funding) => ({ key: funding.id, walletId: funding.walletId, amount: String(funding.requestedAmount) })),
          })),
        }}
      />
    </div>
  );
}
