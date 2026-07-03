import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import { ProjectActions } from "./_actions";
import { canEditProject } from "@/lib/authorization";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  addRunningBalances,
  BudgetTransactionKind,
  summarizeProjectBudget,
} from "@/lib/budget-summary";
import { canViewProjectBudgetHistory } from "@/lib/authorization";

const HISTORY_PAGE_SIZE = 20;
const TRANSACTION_LABELS: Record<BudgetTransactionKind, string> = {
  ALLOCATE: "จัดสรรงบประมาณ",
  EXPENSE: "เบิกจ่าย",
  REFUND: "คืนเงิน",
  ADJUST: "ปรับยอด",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งขออนุมัติ",
  REVIEWED: "ตรวจสอบแล้ว (รอผู้บริหาร)",
  APPROVED: "อนุมัติ",
  REJECTED: "ตีกลับ",
  IN_PROGRESS: "ดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ budgetType?: string; budgetPage?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      department: true,
      responsibleUser: true,
      strategy: true,
      fundSource: true,
      academicYear: true,
      activities: { include: { fundSource: true } },
      approvals: { include: { approver: true }, orderBy: { stepOrder: "asc" } },
      transactions: { orderBy: { transactionDate: "desc" } },
    },
  });
  if (!project) notFound();

  const budget = summarizeProjectBudget(project.budgetApproved, project.transactions);
  const budgetApproved = budget.approved;
  const remaining = budget.remaining;
  const percentUsed = budgetApproved > 0 ? (budget.netSpent / budgetApproved) * 100 : 0;

  const allowedTypes = Object.keys(TRANSACTION_LABELS) as BudgetTransactionKind[];
  const budgetType = allowedTypes.includes(query.budgetType as BudgetTransactionKind)
    ? (query.budgetType as BudgetTransactionKind)
    : null;
  const requestedPage = Number.parseInt(query.budgetPage ?? "1", 10);
  const historyWithBalances = addRunningBalances(project.budgetApproved, project.transactions);
  const filteredHistory = budgetType
    ? historyWithBalances.filter(
        (transaction) => transaction.transactionType === budgetType,
      )
    : historyWithBalances;
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE),
  );
  const historyPage = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    totalHistoryPages,
  );
  const visibleHistory = filteredHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );
  const canViewHistory = session?.user
    ? canViewProjectBudgetHistory(session.user, project)
    : false;
  const historyAuditLogs =
    canViewHistory && visibleHistory.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            entityName: "BudgetTransaction",
            entityId: { in: visibleHistory.map((transaction) => transaction.id) },
          },
          include: { user: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const actorByTransactionId = new Map<string, string>();
  for (const log of historyAuditLogs) {
    if (log.entityId && !actorByTransactionId.has(log.entityId)) {
      actorByTransactionId.set(log.entityId, log.user?.fullName ?? "ระบบ");
    }
  }

  const budgetActive =
    (project.status === "APPROVED" ||
      project.status === "IN_PROGRESS" ||
      project.status === "COMPLETED") &&
    budgetApproved > 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">{project.projectCode}</div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{project.projectName}</h1>
            {session?.user && canEditProject(session.user, project) && (
              <Button asChild size="sm" variant="outline" className="w-full md:w-auto">
                <Link href={`/projects/${project.id}/edit`}>แก้ไขโครงการ</Link>
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">
              สถานะ: {STATUS_LABELS[project.status]}
            </span>
            <span className="text-muted-foreground">
              ปีการศึกษา {project.academicYear.yearName}
            </span>
          </div>
        </div>
        <div className="w-full xl:w-auto">
          <ProjectActions
            projectId={project.id}
            status={project.status}
            role={role}
            budgetRequested={Number(project.budgetRequested)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="งบประมาณที่อนุมัติ" value={formatBaht(budgetApproved)} />
        <Stat label="ใช้จ่ายสุทธิ" value={formatBaht(budget.netSpent)} className="text-red-600" />
        <Stat
          label="งบคงเหลือ"
          value={formatBaht(remaining)}
          className={
            project.status === "APPROVED" ||
            project.status === "IN_PROGRESS" ||
            project.status === "COMPLETED"
              ? remaining < 0
                ? "font-bold text-red-600"
                : remaining <= budgetApproved * 0.15
                  ? "font-bold text-amber-600"
                  : "font-bold text-emerald-600"
              : ""
          }
        />
        <Stat label="จำนวนครั้งที่ใช้จ่าย" value={`${budget.expenseCount} ครั้ง`} />
      </div>

      {budgetActive && (
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="bg-muted/10 pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <span>📊</span>
                สรุปสัดส่วนการใช้งบประมาณ
              </CardTitle>
              <span
                className={cn(
                  "w-fit rounded-full border px-2 py-1 text-xs font-extrabold",
                  percentUsed <= 60
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : percentUsed <= 85
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-red-200 bg-red-50 text-red-700",
                )}
              >
                ใช้จ่ายไป {percentUsed.toFixed(1)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="h-3 w-full overflow-hidden rounded-full border bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  percentUsed <= 60
                    ? "bg-emerald-500"
                    : percentUsed <= 85
                      ? "bg-amber-500"
                      : "bg-red-500",
                )}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-semibold xl:grid-cols-4">
              <MetricBox label="งบอนุมัติทั้งหมด" value={formatBaht(budgetApproved)} />
              <MetricBox label="ใช้จ่ายไป" value={formatBaht(budget.netSpent)} valueClassName="text-red-600" />
              <MetricBox label="ยอดคงเหลือ" value={formatBaht(remaining)} valueClassName="text-emerald-600" />
              <MetricBox label="สัดส่วนคงเหลือ" value={`${(100 - percentUsed).toFixed(1)}%`} valueClassName="text-blue-600" />
            </div>

            {percentUsed > 85 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200/50 bg-red-50 p-3 text-xs font-medium text-red-950">
                <span className="mt-0.5 text-sm leading-none">⚠️</span>
                <div>
                  <h5 className="font-bold text-red-800">คำเตือน: งบประมาณของโครงการนี้ใกล้หมดแล้ว</h5>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-red-700/80">
                    โครงการนี้ใช้จ่ายงบประมาณไปแล้วกว่า {percentUsed.toFixed(1)}%
                    ของงบประมาณที่ได้รับอนุมัติ กรุณาทำรายการอย่างระมัดระวัง
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card id="budget-history" className="scroll-mt-24 overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">ประวัติการใช้งบประมาณ</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                ทั้งหมด {budget.historyCount} รายการ ใช้จ่ายจริง {budget.expenseCount} ครั้ง
              </p>
            </div>
            {canViewHistory && (
              <form
                method="get"
                action={`/projects/${project.id}`}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <label htmlFor="budgetType" className="text-xs text-muted-foreground">
                  ประเภท
                </label>
                <select
                  id="budgetType"
                  name="budgetType"
                  defaultValue={budgetType ?? ""}
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="">ทั้งหมด</option>
                  {allowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {TRANSACTION_LABELS[type]}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                  กรอง
                </Button>
              </form>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!canViewHistory ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              บัญชีนี้ไม่มีสิทธิ์ดูรายละเอียดประวัติการเงินของโครงการ
            </div>
          ) : visibleHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการใช้งบประมาณ
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {visibleHistory.map((transaction) => {
                  const isExpense = transaction.transactionType === "EXPENSE";
                  const isRefund = transaction.transactionType === "REFUND";
                  return (
                    <div
                      key={transaction.id}
                      className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {TRANSACTION_LABELS[transaction.transactionType]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatThaiDate(transaction.transactionDate)}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <DetailRow label="รายละเอียด" value={transaction.description || "-"} stacked />
                        <DetailRow
                          label="ผู้บันทึก"
                          value={actorByTransactionId.get(transaction.id) ?? "ระบบ"}
                        />
                        <DetailRow
                          label="จำนวนเงิน"
                          value={`${isExpense ? "-" : isRefund ? "+" : ""}${formatBaht(Number(transaction.amount))}`}
                          valueClassName={
                            isExpense ? "font-semibold text-red-600" : isRefund ? "font-semibold text-emerald-600" : "font-semibold"
                          }
                          mono
                        />
                        <DetailRow
                          label="คงเหลือหลังรายการ"
                          value={formatBaht(transaction.balanceAfter)}
                          mono
                          strong
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                      <th className="p-3">วันที่</th>
                      <th className="p-3">ประเภท</th>
                      <th className="p-3">รายละเอียด</th>
                      <th className="p-3">ผู้บันทึก</th>
                      <th className="p-3 text-right">จำนวนเงิน</th>
                      <th className="p-3 text-right">คงเหลือหลังรายการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistory.map((transaction) => {
                      const isExpense = transaction.transactionType === "EXPENSE";
                      const isRefund = transaction.transactionType === "REFUND";
                      return (
                        <tr key={transaction.id} className="border-b last:border-0">
                          <td className="whitespace-nowrap p-3">
                            {formatThaiDate(transaction.transactionDate)}
                          </td>
                          <td className="p-3">
                            <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                              {TRANSACTION_LABELS[transaction.transactionType]}
                            </span>
                          </td>
                          <td className="max-w-md p-3">{transaction.description || "-"}</td>
                          <td className="whitespace-nowrap p-3 text-muted-foreground">
                            {actorByTransactionId.get(transaction.id) ?? "ระบบ"}
                          </td>
                          <td
                            className={cn(
                              "whitespace-nowrap p-3 text-right font-mono font-semibold",
                              isExpense && "text-red-600",
                              isRefund && "text-emerald-600",
                            )}
                          >
                            {isExpense ? "-" : isRefund ? "+" : ""}
                            {formatBaht(Number(transaction.amount))}
                          </td>
                          <td className="whitespace-nowrap p-3 text-right font-mono font-semibold">
                            {formatBaht(transaction.balanceAfter)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  หน้า {historyPage} จาก {totalHistoryPages}
                </span>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" disabled={historyPage <= 1}>
                    <Link
                      href={
                        historyPage <= 1
                          ? "#budget-history"
                          : buildHistoryHref(project.id, budgetType, historyPage - 1)
                      }
                    >
                      ก่อนหน้า
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    disabled={historyPage >= totalHistoryPages}
                  >
                    <Link
                      href={
                        historyPage >= totalHistoryPages
                          ? "#budget-history"
                          : buildHistoryHref(project.id, budgetType, historyPage + 1)
                      }
                    >
                      ถัดไป
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>ข้อมูลทั่วไป</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="กลยุทธ์"
              value={
                project.strategy
                  ? `${project.strategy.code} — ${project.strategy.title}`
                  : "-"
              }
            />
            <Row label="ฝ่าย/กลุ่มงาน" value={project.department?.name ?? "-"} />
            <Row label="แหล่งงบประมาณ" value={project.fundSource?.name ?? "-"} />
            <Row label="ผู้รับผิดชอบ" value={project.responsibleUser?.fullName ?? "-"} />
            <Row
              label="ระยะเวลา"
              value={`${formatThaiDate(project.startDate)} — ${formatThaiDate(project.endDate)}`}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>ขั้นตอนอนุมัติ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {project.approvals.length === 0 && (
              <p className="text-muted-foreground">ยังไม่ได้ส่งขออนุมัติ</p>
            )}
            {project.approvals.map((approval) => (
              <div
                key={approval.id}
                className="flex flex-col gap-2 border-b py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    ขั้นที่ {approval.stepOrder}: {approval.approver.fullName}
                  </div>
                  <div className="text-xs text-muted-foreground">{approval.comment}</div>
                </div>
                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-1 text-xs",
                    approval.status === "APPROVED"
                      ? "bg-green-100 text-green-800"
                      : approval.status === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {approval.status === "APPROVED"
                    ? "อนุมัติ"
                    : approval.status === "REJECTED"
                      ? "ตีกลับ"
                      : "รออนุมัติ"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/10 py-4">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="rounded-lg bg-primary/10 p-1.5 text-base text-primary">📂</span>
            กิจกรรมย่อยของโครงการ ({project.activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {project.activities.length === 0 ? (
            <div className="p-8 text-center font-medium text-muted-foreground">
              ไม่มีกิจกรรมย่อยในโครงการนี้
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {project.activities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm"
                  >
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      กิจกรรมที่ {index + 1}
                    </div>
                    <div className="text-base font-bold text-foreground/90">{activity.name}</div>
                    <div className="mt-3 space-y-2 text-sm">
                      <DetailRow
                        label="แหล่งงบประมาณ"
                        value={activity.fundSource?.name ?? project.fundSource?.name ?? "ไม่ระบุ"}
                        badge
                      />
                      <DetailRow
                        label="งบประมาณกิจกรรม"
                        value={formatBaht(Number(activity.budget))}
                        mono
                        strong
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="w-12 p-4 text-center font-semibold">#</th>
                      <th className="p-4 font-semibold">ชื่อกิจกรรมย่อย</th>
                      <th className="p-4 font-semibold">แหล่งงบประมาณ</th>
                      <th className="p-4 text-right font-semibold">งบประมาณกิจกรรม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/10">
                    {project.activities.map((activity, index) => (
                      <tr key={activity.id} className="transition-colors hover:bg-muted/5">
                        <td className="p-4 text-center font-mono text-xs text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="p-4 font-bold text-foreground/90">{activity.name}</td>
                        <td className="p-4">
                          <span className="rounded-full border border-blue-200/50 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                            {activity.fundSource?.name ?? project.fundSource?.name ?? "ไม่ระบุ"}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-base font-bold text-foreground">
                          {formatBaht(Number(activity.budget))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="หลักการและเหตุผล">{project.rationale}</Section>
        <Section title="วัตถุประสงค์">{project.objectives}</Section>
        <Section title="เป้าหมายเชิงปริมาณ">{project.quantitativeTarget}</Section>
        <Section title="เป้าหมายเชิงคุณภาพ">{project.qualitativeTarget}</Section>
        <Section title="ตัวชี้วัด">{project.indicators}</Section>
        <Section title="วิธีดำเนินงาน">{project.method}</Section>
        <Section title="ผลที่คาดว่าจะได้รับ">{project.expectedOutcome}</Section>
      </div>
    </div>
  );
}

function buildHistoryHref(
  projectId: string,
  type: BudgetTransactionKind | null,
  page: number,
) {
  const params = new URLSearchParams();
  if (type) params.set("budgetType", type);
  params.set("budgetPage", String(page));
  return `/projects/${projectId}?${params.toString()}#budget-history`;
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-xl font-bold md:text-2xl", className)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function MetricBox({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold font-mono text-foreground", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-left sm:text-right">{value}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  strong = false,
  badge = false,
  stacked = false,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  badge?: boolean;
  stacked?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3",
        stacked && "flex-col",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right",
          mono && "font-mono",
          strong && "font-semibold",
          badge &&
            "rounded-full border border-blue-200/50 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800",
          stacked && "text-left",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
        {children || <span className="text-muted-foreground">-</span>}
      </CardContent>
    </Card>
  );
}
