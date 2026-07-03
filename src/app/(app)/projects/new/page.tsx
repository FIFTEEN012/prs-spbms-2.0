import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac";
import { ProjectForm } from "../_components/project-form";

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user?.role, "project.create")) redirect("/projects");

  const [year, strategies, departments, fundSources, users, wallets] = await Promise.all([
    prisma.academicYear.findFirst({ where: { isActive: true } }),
    prisma.strategy.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.fundSource.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" } }),
    prisma.budgetWallet.findMany({ where: { budgetPlan: { status: "LOCKED" } }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">สร้างโครงการใหม่</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          ปีการศึกษา: {year?.yearName ?? "(ยังไม่ได้กำหนด)"}
        </p>
      </div>
      <ProjectForm
        academicYearId={year?.id ?? ""}
        strategies={strategies.map((s) => ({ id: s.id, label: `${s.code} — ${s.title}` }))}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        fundSources={fundSources.map((f) => ({ id: f.id, label: f.name }))}
        users={users.map((u) => ({ id: u.id, label: u.fullName }))}
        wallets={wallets.map((wallet) => ({ id: wallet.id, label: wallet.name }))}
      />
    </div>
  );
}
