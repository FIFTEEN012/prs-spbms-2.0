import { prisma } from "@/lib/prisma";
import {
  getActiveAcademicYearReference,
  getDepartmentsReference,
  getFundSourcesReference,
  getStrategiesReference,
} from "@/lib/reference-data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac";
import { FilePlus2, Home } from "lucide-react";
import { ProjectForm } from "../_components/project-form";

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user?.role, "project.create")) redirect("/projects");

  const [year, strategies, departments, fundSources, users, wallets] = await Promise.all([
    getActiveAcademicYearReference(),
    getStrategiesReference(),
    getDepartmentsReference(),
    getFundSourcesReference(),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.budgetWallet.findMany({ where: { budgetPlan: { status: "LOCKED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }).catch(() => []),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Home className="size-3.5" />
          <span>หน้าหลัก</span>
          <span>/</span>
          <span>โครงการ</span>
          <span>/</span>
          <span className="text-primary">สร้างโครงการใหม่</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FilePlus2 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
              สร้างโครงการใหม่
            </h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">
              ปีการศึกษา: {year?.yearName ?? "ยังไม่ได้กำหนด"}
            </p>
          </div>
        </div>
      </section>

      <ProjectForm
        academicYearId={year?.id ?? ""}
        strategies={strategies.map((strategy) => ({ id: strategy.id, label: `${strategy.code} - ${strategy.title}` }))}
        departments={departments.map((department) => ({ id: department.id, label: department.name }))}
        fundSources={fundSources.map((fundSource) => ({ id: fundSource.id, label: fundSource.name }))}
        users={users.map((user) => ({ id: user.id, label: user.fullName }))}
        wallets={wallets.map((wallet) => ({ id: wallet.id, label: wallet.name }))}
      />
    </div>
  );
}
