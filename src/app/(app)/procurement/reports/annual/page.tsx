import Link from "next/link";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import type { Prisma, ProcurementCategory, PurchaseRequestStatus } from "@prisma/client";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Lightbulb,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import {
  AnnualReportActions,
  AnnualReportFilters,
  type ReportCsvRow,
} from "./_components/annual-procurement-report-client";

const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  PENDING: "รอแผนงานตรวจ",
  PLAN_REVIEWED: "รอการเงินตรวจ",
  FINANCE_REVIEWED: "รอพัสดุตรวจ",
  PROCUREMENT_REVIEWED: "รอหัวหน้างบเห็นชอบ",
  BUDGET_REVIEWED: "รอ ผอ. อนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธคำขอ",
};

const CATEGORY_LABELS: Record<ProcurementCategory, string> = {
  SUPPLIES: "วัสดุ",
  EQUIPMENT: "ครุภัณฑ์",
  FUEL: "น้ำมันเชื้อเพลิง",
  RENOVATION: "ปรับปรุง/ซ่อมแซม",
  REMUNERATION: "ค่าตอบแทน",
  EXPENSES: "ค่าใช้สอย",
  TEMP_WAGE: "ค่าจ้างชั่วคราว",
  CONTRACT: "จ้างเหมา",
  OTHERS: "อื่น ๆ",
};

const CATEGORY_COLORS = ["#002d76", "#fdc425", "#1e00a9", "#747784", "#0842a1", "#785a00"];
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

type SearchParams = {
  fiscalYearId?: string | string[];
  status?: string | string[];
  departmentId?: string | string[];
  category?: string | string[];
  q?: string | string[];
};

function getParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function eachMonth(start: Date, end: Date) {
  const months: Array<{ key: string; label: string; amount: number; count: number }> = [];
  const cursor = new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getFullYear(), end.getMonth(), 1));

  while (cursor <= endCursor) {
    months.push({
      key: monthKey(cursor),
      label: THAI_MONTHS[cursor.getMonth()],
      amount: 0,
      count: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function avgApprovalDays(
  requests: Array<{ createdAt: Date; directorApprovedAt: Date | null; status: PurchaseRequestStatus }>,
) {
  const approved = requests.filter((request) => request.status === "APPROVED" && request.directorApprovedAt);
  if (approved.length === 0) return 0;
  const dayMs = 1000 * 60 * 60 * 24;
  const total = approved.reduce((sum, request) => {
    return sum + Math.max(0, (request.directorApprovedAt!.getTime() - request.createdAt.getTime()) / dayMs);
  }, 0);
  return total / approved.length;
}

export default async function AnnualProcurementReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const fiscalYearIdParam = getParam(params.fiscalYearId);
  const statusParam = getParam(params.status);
  const departmentId = getParam(params.departmentId);
  const categoryParam = getParam(params.category);
  const query = getParam(params.q);

  const [fiscalYears, departments] = await Promise.all([
    prisma.fiscalYear.findMany({ orderBy: { startDate: "desc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const selectedFiscalYear =
    fiscalYears.find((year) => year.id === fiscalYearIdParam) ??
    fiscalYears.find((year) => year.isActive) ??
    fiscalYears[0] ??
    null;

  const validStatuses = Object.keys(STATUS_LABELS) as PurchaseRequestStatus[];
  const status = validStatuses.includes(statusParam as PurchaseRequestStatus)
    ? (statusParam as PurchaseRequestStatus)
    : "";
  const validCategories = Object.keys(CATEGORY_LABELS) as ProcurementCategory[];
  const category = validCategories.includes(categoryParam as ProcurementCategory)
    ? (categoryParam as ProcurementCategory)
    : "";

  const where: Prisma.PurchaseRequestWhereInput = selectedFiscalYear
    ? {
        documentDate: {
          gte: selectedFiscalYear.startDate,
          lte: selectedFiscalYear.endDate,
        },
      }
    : {};

  const andClauses: Prisma.PurchaseRequestWhereInput[] = [];
  if (status) andClauses.push({ status });
  if (category) andClauses.push({ category });
  if (departmentId) andClauses.push({ project: { is: { departmentId } } });
  if (query) {
    andClauses.push({
      OR: [
        { documentNo: { contains: query, mode: "insensitive" } },
        { subject: { contains: query, mode: "insensitive" } },
        { project: { is: { projectName: { contains: query, mode: "insensitive" } } } },
        { createdBy: { is: { fullName: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }

  if (session?.user.role === "TEACHER") {
    andClauses.push({ createdById: session.user.id });
  } else if (session?.user.role === "DEPT_HEAD" && session.user.departmentId) {
    andClauses.push({ project: { is: { departmentId: session.user.departmentId } } });
  }

  if (andClauses.length > 0) where.AND = andClauses;

  const requests = selectedFiscalYear
    ? await prisma.purchaseRequest.findMany({
        where,
        include: {
          project: { include: { department: true } },
          items: true,
          createdBy: { select: { fullName: true } },
        },
        orderBy: { requestedAmount: "desc" },
      })
    : [];

  const totalAmount = requests.reduce((sum, request) => sum + Number(request.requestedAmount), 0);
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
  const completionRate = percent(approvedCount, requests.length);
  const averageDays = avgApprovalDays(requests);
  const monthly = selectedFiscalYear
    ? eachMonth(selectedFiscalYear.startDate, selectedFiscalYear.endDate)
    : [];
  const monthlyByKey = new Map(monthly.map((point) => [point.key, point]));

  for (const request of requests) {
    const point = monthlyByKey.get(monthKey(request.documentDate));
    if (!point) continue;
    point.amount += Number(request.requestedAmount);
    point.count += 1;
  }
  const maxMonthly = Math.max(...monthly.map((point) => point.amount), 1);

  const byCategory = new Map<ProcurementCategory, { label: string; amount: number; count: number }>();
  const byDepartment = new Map<string, { label: string; amount: number; count: number }>();
  const itemTotals = new Map<string, { itemName: string; category: string; amount: number; count: number; status: PurchaseRequestStatus }>();

  for (const request of requests) {
    const categoryRow = byCategory.get(request.category) ?? {
      label: CATEGORY_LABELS[request.category],
      amount: 0,
      count: 0,
    };
    categoryRow.amount += Number(request.requestedAmount);
    categoryRow.count += 1;
    byCategory.set(request.category, categoryRow);

    const deptName = request.project.department?.name ?? "ไม่ระบุกลุ่มบริหาร";
    const deptRow = byDepartment.get(deptName) ?? { label: deptName, amount: 0, count: 0 };
    deptRow.amount += Number(request.requestedAmount);
    deptRow.count += 1;
    byDepartment.set(deptName, deptRow);

    for (const item of request.items) {
      const key = item.itemName.trim() || item.id;
      const row = itemTotals.get(key) ?? {
        itemName: item.itemName,
        category: CATEGORY_LABELS[request.category],
        amount: 0,
        count: 0,
        status: request.status,
      };
      row.amount += Number(item.totalPrice);
      row.count += item.quantity;
      row.status = request.status === "APPROVED" ? "APPROVED" : row.status;
      itemTotals.set(key, row);
    }
  }

  const categoryRows = [...byCategory.values()].sort((a, b) => b.amount - a.amount);
  const departmentRows = [...byDepartment.values()].sort((a, b) => b.amount - a.amount);
  const topItems = [...itemTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const topRequests = requests.slice(0, 10);
  const topCategory = categoryRows[0];
  const topDepartment = departmentRows[0];
  const topMonth = [...monthly].sort((a, b) => b.amount - a.amount)[0];

  const csvRows: ReportCsvRow[] = requests.map((request) => ({
    documentNo: request.documentNo ?? "-",
    subject: request.subject,
    projectName: request.project.projectName,
    departmentName: request.project.department?.name ?? "-",
    status: STATUS_LABELS[request.status],
    requestedAmount: Number(request.requestedAmount),
    documentDate: request.documentDate.toISOString(),
  }));

  const fiscalOptions = fiscalYears.map((year) => ({ value: year.id, label: year.yearName }));
  const departmentOptions = departments.map((department) => ({ value: department.id, label: department.name }));
  const statusOptions = validStatuses.map((item) => ({ value: item, label: STATUS_LABELS[item] }));
  const categoryOptions = validCategories.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }));

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-10 print:bg-white">
      <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-xs font-bold text-slate-500">
            <Link href="/procurement" className="hover:text-primary">พัสดุ/จัดซื้อ</Link>
            <span className="mx-2">/</span>
            <span className="text-primary">รายงานประจำปี</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">รายงานการจัดซื้อจัดจ้างประจำปี</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            สรุปภาพรวมสถิติการจัดซื้อจัดจ้างและประสิทธิภาพการใช้จ่ายงบประมาณพัสดุ
            {selectedFiscalYear ? ` (${formatThaiDate(selectedFiscalYear.startDate)} - ${formatThaiDate(selectedFiscalYear.endDate)})` : ""}
          </p>
        </div>
        <AnnualReportActions rows={csvRows} />
      </div>

      <AnnualReportFilters
        fiscalYears={fiscalOptions}
        departments={departmentOptions}
        statuses={statusOptions}
        categories={categoryOptions}
      />

      {!selectedFiscalYear ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          ยังไม่มีปีงบประมาณสำหรับสร้างรายงาน
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={<ShoppingBag className="size-5" />} label="ยอดรวมการจัดซื้อทั้งหมด" value={formatBaht(totalAmount)} tone="primary" />
            <KpiCard icon={<FileText className="size-5" />} label="จำนวนคำขอจัดซื้อทั้งหมด" value={`${requests.length.toLocaleString("th-TH")} รายการ`} tone="gold" />
            <KpiCard icon={<CheckCircle2 className="size-5" />} label="อัตราการจัดซื้อสำเร็จ" value={`${completionRate.toFixed(1)}%`} tone="violet" progress={completionRate} />
            <KpiCard icon={<Clock3 className="size-5" />} label="เฉลี่ยเวลาดำเนินการ" value={`${averageDays.toFixed(1)} วัน`} tone="amber" />
          </section>

          <section className="grid gap-6 xl:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm xl:col-span-8">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-slate-900">ยอดใช้จ่ายรายเดือน</h2>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="size-3 rounded-full bg-primary" />
                  งบประมาณที่ใช้
                </span>
              </div>
              <div className="flex h-64 items-end justify-between gap-2">
                {monthly.map((point) => (
                  <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-primary-fixed-dim transition-colors hover:bg-primary"
                      style={{ height: `${Math.max(4, percent(point.amount, maxMonthly))}%` }}
                      title={`${point.label}: ${formatBaht(point.amount)}`}
                    />
                    <span className="text-[10px] font-semibold text-slate-500">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm xl:col-span-4">
              <h2 className="mb-6 text-lg font-extrabold text-slate-900">แยกตามหมวดหมู่</h2>
              <div
                className="mx-auto flex size-48 items-center justify-center rounded-full"
                style={{
                  background: buildConicGradient(categoryRows.map((row, index) => ({
                    value: row.amount,
                    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                  }))),
                }}
              >
                <div className="flex size-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                  <span className="text-2xl font-black text-primary">100%</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {categoryRows.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">ยังไม่มีข้อมูลหมวดหมู่</p>
                ) : categoryRows.slice(0, 5).map((row, index) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                      <span className="truncate">{row.label}</span>
                    </span>
                    <span className="font-bold">{percent(row.amount, totalAmount).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm xl:col-span-6">
              <h2 className="mb-6 text-lg font-extrabold text-slate-900">การใช้จ่ายแยกตามกลุ่มบริหาร</h2>
              <div className="space-y-5">
                {departmentRows.length === 0 ? (
                  <p className="text-sm text-slate-500">ยังไม่มีข้อมูลกลุ่มบริหาร</p>
                ) : departmentRows.slice(0, 8).map((row) => (
                  <div key={row.label}>
                    <div className="mb-2 flex justify-between gap-3 text-sm">
                      <span className="font-semibold">{row.label}</span>
                      <span className="font-mono font-bold">{formatBaht(row.amount)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent(row.amount, departmentRows[0]?.amount ?? 1)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:col-span-6">
              <div className="relative flex-1 overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-lg">
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                    <Lightbulb className="size-4 text-[#fdc425]" />
                    Key Insights
                  </div>
                  <div className="space-y-4 text-sm font-semibold leading-relaxed">
                    <Insight icon={<TrendingUp className="size-5 text-[#fdc425]" />}>
                      {topCategory
                        ? `หมวด${topCategory.label}มียอดใช้จ่ายสูงสุดในปีนี้ (${formatBaht(topCategory.amount)})`
                        : "ยังไม่มีข้อมูลหมวดหมู่สำหรับปีงบประมาณนี้"}
                    </Insight>
                    <Insight icon={<CheckCircle2 className="size-5 text-emerald-300" />}>
                      {topDepartment
                        ? `${topDepartment.label}มีมูลค่าคำขอจัดซื้อสูงสุด (${formatBaht(topDepartment.amount)})`
                        : "ยังไม่มีข้อมูลกลุ่มบริหารสำหรับปีงบประมาณนี้"}
                    </Insight>
                    <Insight icon={<BarChart3 className="size-5 text-blue-200" />}>
                      {topMonth
                        ? `เดือน${topMonth.label}มีมูลค่าคำขอสูงสุด (${formatBaht(topMonth.amount)})`
                        : "ยังไม่มีข้อมูลรายเดือน"}
                    </Insight>
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-16 size-56 rounded-full bg-white/10 blur-3xl" />
              </div>
              <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-primary-fixed text-primary">
                  <div className="text-center">
                    <div className="text-xl font-black">{averageDays.toFixed(1)}</div>
                    <div className="text-[9px] font-black uppercase">Days</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">เฉลี่ยเวลาดำเนินการ</h3>
                  <p className="mt-1 text-sm text-slate-500">นับจากวันที่สร้างคำขอถึงวันที่ผู้บริหารอนุมัติ</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ReportTable
              title="พัสดุที่มีมูลค่าสูงสุด (Top 5)"
              headers={["รายการ", "ยอดรวม (บาท)", "สถานะ"]}
              emptyText="ยังไม่มีรายการพัสดุ"
              rows={topItems.map((item) => [
                <div key="item">
                  <p className="font-bold text-slate-900">{item.itemName}</p>
                  <p className="text-xs text-slate-500">{item.category} · {item.count.toLocaleString("th-TH")} หน่วย</p>
                </div>,
                <span key="amount" className="font-mono font-bold text-primary">{formatBaht(item.amount)}</span>,
                <StatusPill key="status" status={item.status} />,
              ])}
            />
            <ReportTable
              title="คำขอจัดซื้อที่มีมูลค่าสูงสุด"
              headers={["คำขอ", "ยอดรวม (บาท)", "สถานะ"]}
              emptyText="ยังไม่มีคำขอจัดซื้อ"
              rows={topRequests.map((request) => [
                <div key="request">
                  <Link href={`/procurement/${request.id}`} className="font-bold text-primary hover:underline">{request.subject}</Link>
                  <p className="text-xs text-slate-500">{request.project.projectName} · {request.documentNo || "-"}</p>
                </div>,
                <span key="amount" className="font-mono font-bold text-primary">{formatBaht(Number(request.requestedAmount))}</span>,
                <StatusPill key="status" status={request.status} />,
              ])}
            />
          </section>
        </>
      )}
    </div>
  );
}

function buildConicGradient(parts: Array<{ value: number; color: string }>) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return "conic-gradient(#e2e7ff 0deg 360deg)";
  let current = 0;
  const stops = parts.map((part) => {
    const start = current;
    const end = current + percent(part.value, total) * 3.6;
    current = end;
    return `${part.color} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "primary" | "gold" | "violet" | "amber";
  progress?: number;
}) {
  const toneClass = {
    primary: "bg-primary-fixed text-primary",
    gold: "bg-secondary-fixed text-[#5a4300]",
    violet: "bg-tertiary-fixed text-tertiary",
    amber: "bg-[#fdc425]/20 text-[#785a00]",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className={cn("mb-4 inline-flex size-12 items-center justify-center rounded-xl", toneClass)}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <h2 className="mt-1 text-2xl font-black text-slate-900">{value}</h2>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

function Insight({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <p>{children}</p>
    </div>
  );
}

function StatusPill({ status }: { status: PurchaseRequestStatus }) {
  const className = status === "APPROVED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "REJECTED"
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-bold", className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 p-5">
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-[11px] uppercase text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-5 py-3 font-black">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-5 py-10 text-center text-slate-500">{emptyText}</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn("px-5 py-4", cellIndex === 1 && "text-right")}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
