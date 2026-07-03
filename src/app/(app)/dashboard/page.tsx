import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBaht } from "@/lib/utils";
import { FolderKanban, CheckCircle2, Wallet, TrendingDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { summarizeProjectBudget } from "@/lib/budget-summary";

type DashboardStats = {
  yearName: string;
  isMock: boolean;
  total: number;
  approved: number;
  budgetApproved: number;
  remaining: number;
  byDept: Array<{ name: string; value: number }>;
  byStatus: Array<{ name: string; value: number }>;
};

async function getStats(): Promise<DashboardStats> {
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
  });

  const projectsFilter = activeYear ? { academicYearId: activeYear.id } : {};

  const [projects, transactionSums] = await Promise.all([
    prisma.project.findMany({
      where: projectsFilter,
      select: {
        id: true,
        budgetApproved: true,
        status: true,
        department: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.budgetTransaction.groupBy({
      by: ["projectId", "transactionType"],
      where: activeYear
        ? {
            project: {
              academicYearId: activeYear.id,
            },
          }
        : {},
      _sum: {
        amount: true,
      },
    }),
  ]);

  const projectTxMap = new Map<string, Array<{ transactionType: any; amount: number }>>();
  for (const sum of transactionSums) {
    const list = projectTxMap.get(sum.projectId) ?? [];
    list.push({
      transactionType: sum.transactionType,
      amount: Number(sum._sum.amount ?? 0),
    });
    projectTxMap.set(sum.projectId, list);
  }

  const total = projects.length;
  const approvedProjects = projects.filter(
    (p) =>
      p.status === "APPROVED" ||
      p.status === "IN_PROGRESS" ||
      p.status === "COMPLETED",
  );
  const approved = approvedProjects.length;

  let budgetApprovedSum = 0;
  let remainingSum = 0;

  for (const p of projects) {
    if (
      p.status === "APPROVED" ||
      p.status === "IN_PROGRESS" ||
      p.status === "COMPLETED"
    ) {
      const budgetApproved = Number(p.budgetApproved);
      budgetApprovedSum += budgetApproved;

      const budget = summarizeProjectBudget(p.budgetApproved, projectTxMap.get(p.id) ?? []);
      remainingSum += budget.remaining;
    }
  }

  const deptMap: Record<string, number> = {};
  for (const p of projects) {
    if (
      p.status === "APPROVED" ||
      p.status === "IN_PROGRESS" ||
      p.status === "COMPLETED"
    ) {
      const deptName = p.department?.name || "ไม่ระบุฝ่าย";
      const amt = Number(p.budgetApproved);
      deptMap[deptName] = (deptMap[deptName] || 0) + amt;
    }
  }
  const byDept = Object.entries(deptMap).map(([name, value]) => ({
    name,
    value,
  }));
  byDept.sort((a, b) => b.value - a.value);

  const statusMap: Record<string, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    REVIEWED: 0,
    APPROVED: 0,
    REJECTED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const p of projects) {
    statusMap[p.status] = (statusMap[p.status] || 0) + 1;
  }
  const byStatus = Object.entries(statusMap)
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0);

  return {
    yearName: activeYear ? activeYear.yearName : "ไม่ระบุปีการศึกษา",
    isMock: false,
    total,
    approved,
    budgetApproved: budgetApprovedSum,
    remaining: remainingSum,
    byDept,
    byStatus,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const stats = await getStats();

  const STATUS_COLORS: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800 border-gray-200 border",
    SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200 border",
    REVIEWED: "bg-indigo-100 text-indigo-800 border-indigo-200 border",
    APPROVED: "bg-green-100 text-green-800 border-green-200 border",
    REJECTED: "bg-red-100 text-red-800 border-red-200 border",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800 border-yellow-200 border",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200 border",
    CANCELLED: "bg-gray-300 text-gray-700 border-gray-400 border",
  };

  let userProjects: Array<{
    id: string;
    projectCode: string;
    projectName: string;
    budgetApproved: number;
    budgetRequested: number;
    netSpent: number;
    remaining: number;
    percentUsed: number;
    status: string;
    responsibleName: string;
    departmentName: string;
  }> = [];

  if (user) {
    const activeYear = await prisma.academicYear.findFirst({
      where: { isActive: true },
    });

    const activeYearFilter = activeYear ? { academicYearId: activeYear.id } : {};

    const userProjectsData = await prisma.project.findMany({
      where: {
        ...activeYearFilter,
        OR: [
          { responsibleUserId: user.id },
          ...(user.role === "DEPT_HEAD" && user.departmentId
            ? [{ departmentId: user.departmentId }]
            : []),
        ],
      },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        budgetApproved: true,
        budgetRequested: true,
        status: true,
        responsibleUser: {
          select: {
            fullName: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { projectCode: "asc" },
    });

    const userProjectIds = userProjectsData.map((p) => p.id);
    const userTransactionSums = userProjectIds.length
      ? await prisma.budgetTransaction.groupBy({
          by: ["projectId", "transactionType"],
          where: {
            projectId: { in: userProjectIds },
          },
          _sum: {
            amount: true,
          },
        })
      : [];

    const userProjectTxMap = new Map<string, Array<{ transactionType: any; amount: number }>>();
    for (const sum of userTransactionSums) {
      const list = userProjectTxMap.get(sum.projectId) ?? [];
      list.push({
        transactionType: sum.transactionType,
        amount: Number(sum._sum.amount ?? 0),
      });
      userProjectTxMap.set(sum.projectId, list);
    }

    userProjects = userProjectsData.map((p) => {
      const budgetApproved = Number(p.budgetApproved);
      const budgetRequested = Number(p.budgetRequested);
      const budget = summarizeProjectBudget(p.budgetApproved, userProjectTxMap.get(p.id) ?? []);
      const netSpent = budget.netSpent;
      const remaining = budget.remaining;
      const percentUsed = budgetApproved > 0 ? (netSpent / budgetApproved) * 100 : 0;

      return {
        id: p.id,
        projectCode: p.projectCode,
        projectName: p.projectName,
        budgetApproved,
        budgetRequested,
        netSpent,
        remaining,
        percentUsed,
        status: p.status,
        responsibleName: p.responsibleUser?.fullName ?? "ไม่ระบุ",
        departmentName: p.department?.name ?? "ไม่ระบุ",
      };
    });
  }

  return (
    <div className="space-y-6 md:space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">แดชบอร์ดภาพรวม</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            ปีการศึกษา: {stats.yearName}
            {stats.isMock ? " (โหมดสาธิต)" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          label="โครงการทั้งหมด"
          value={stats.total.toString()}
          icon={<FolderKanban />}
        />
        <StatCard
          label="โครงการที่อนุมัติแล้ว"
          value={stats.approved.toString()}
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="งบประมาณที่อนุมัติ"
          value={formatBaht(stats.budgetApproved)}
          icon={<Wallet />}
        />
        <StatCard
          label="งบคงเหลือ"
          value={formatBaht(stats.remaining)}
          icon={<TrendingDown />}
        />
      </div>

      {userProjects.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 bg-muted/10 py-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <span className="rounded-lg bg-primary/10 p-1 text-xs text-primary">💼</span>
              งบประมาณโครงการที่คุณรับผิดชอบ ({userProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {userProjects.map((p) => {
                const isActive =
                  p.status === "APPROVED" ||
                  p.status === "IN_PROGRESS" ||
                  p.status === "COMPLETED";
                const displayBudget = isActive ? p.budgetApproved : p.budgetRequested;

                return (
                  <div
                    key={p.id}
                    className="space-y-3 rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <span className="inline-flex rounded-full bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                          {p.projectCode}
                        </span>
                        <Link
                          href={`/projects/${p.id}`}
                          className="mt-1 block text-sm font-bold leading-snug text-foreground transition-colors hover:text-primary hover:underline md:text-base"
                        >
                          {p.projectName}
                        </Link>
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <span>ฝ่าย: {p.departmentName}</span>
                          <span>•</span>
                          <span>ผู้รับผิดชอบ: {p.responsibleName}</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] || p.status}
                      </span>
                    </div>

                    {isActive ? (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                            <span className="text-muted-foreground">การใช้งบประมาณ</span>
                            <span
                              className={
                                p.percentUsed <= 60
                                  ? "text-emerald-600"
                                  : p.percentUsed <= 85
                                    ? "text-amber-600"
                                    : "font-bold text-red-600"
                              }
                            >
                              ใช้ไป {p.percentUsed.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full border bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                p.percentUsed <= 60
                                  ? "bg-emerald-500"
                                  : p.percentUsed <= 85
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(p.percentUsed, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid gap-2 pt-1 text-center font-mono sm:grid-cols-3">
                          <div className="rounded-xl bg-muted/20 p-2 text-[10px]">
                            <div className="mb-0.5 font-sans text-[8px] font-semibold text-muted-foreground">
                              งบอนุมัติ
                            </div>
                            <div className="text-[11px] font-bold text-foreground">
                              {formatBaht(displayBudget)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-muted/20 p-2 text-[10px]">
                            <div className="mb-0.5 font-sans text-[8px] font-semibold text-muted-foreground">
                              ใช้จ่ายแล้ว
                            </div>
                            <div className="text-[11px] font-bold text-red-600">
                              {formatBaht(p.netSpent)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-muted/20 p-2 text-[10px]">
                            <div className="mb-0.5 font-sans text-[8px] font-semibold text-muted-foreground">
                              คงเหลือ
                            </div>
                            <div className="text-[11px] font-bold text-emerald-600">
                              {formatBaht(p.remaining)}
                            </div>
                          </div>
                        </div>

                        {p.percentUsed > 85 && (
                          <div className="flex items-center gap-1 rounded-lg border border-red-100/50 bg-red-50 p-2 text-[10px] font-semibold text-red-800">
                            <span>⚠️</span>
                            <span>งบคงเหลือต่ำกว่า 15% กรุณาใช้จ่ายอย่างระมัดระวัง</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed bg-muted/10 p-3 text-center">
                        <div className="text-[11px] text-muted-foreground">
                          ยังไม่ได้รับการอนุมัติงบ (งบเสนอขอ:{" "}
                          <span className="font-mono font-bold text-foreground">
                            {formatBaht(displayBudget)}
                          </span>
                          )
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold text-amber-600">
                          {p.status === "SUBMITTED" || p.status === "REVIEWED"
                            ? "⏳ อยู่ระหว่างขั้นตอนขออนุมัติโครงการ"
                            : "📝 โครงการเป็นฉบับร่าง"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryCard
          title="งบประมาณรายฝ่าย"
          emptyText="ยังไม่มีข้อมูลการอนุมัติงบประมาณ"
          headers={["ฝ่าย", "งบประมาณ"]}
          rows={stats.byDept.map((row) => ({
            id: row.name,
            label: row.name,
            value: formatBaht(row.value),
          }))}
        />

        <SummaryCard
          title="สถานะโครงการ"
          emptyText="ยังไม่มีโครงการในระบบ"
          headers={["สถานะ", "จำนวน"]}
          rows={stats.byStatus.map((row) => ({
            id: row.name,
            label: STATUS_LABELS[row.name as keyof typeof STATUS_LABELS] ?? row.name,
            value: String(row.value),
          }))}
        />
      </div>
    </div>
  );
}

const STATUS_LABELS = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งขออนุมัติ",
  REVIEWED: "ตรวจสอบแล้ว",
  APPROVED: "อนุมัติ",
  REJECTED: "ตีกลับ",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="flex min-h-[124px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm leading-snug text-muted-foreground">{label}</div>
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">{icon}</div>
        </div>
        <div className="mt-3 break-words text-xl font-bold leading-tight md:text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  title,
  emptyText,
  headers,
  rows,
}: {
  title: string;
  emptyText: string;
  headers: [string, string];
  rows: Array<{ id: string; label: string; value: string }>;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {headers[0]}
                  </div>
                  <div className="mt-1 font-semibold">{row.label}</div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{headers[1]}</span>
                    <span className="text-right font-mono font-bold">{row.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">{headers[0]}</th>
                    <th className="py-2 text-right">{headers[1]}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2">{row.label}</td>
                      <td className="py-2 text-right">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
