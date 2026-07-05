import Link from "next/link";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import type { Prisma, ProcurementCategory, ProcurementStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Eye,
  Inbox,
  Package,
  PackageCheck,
  PackageSearch,
  PackageX,
  Truck,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import {
  InventoryRegisterActions,
  InventoryRegisterFilters,
  type InventoryCsvRow,
} from "./_components/inventory-register-actions";

const STATUS_LABELS: Record<ProcurementStatus, string> = {
  REQUESTED: "รอดำเนินการ",
  ORDERED: "สั่งซื้อแล้ว",
  RECEIVED: "รับเข้าแล้ว",
  CANCELLED: "ยกเลิก",
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

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export default async function InventoryRegisterPage({
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

  const validStatuses = Object.keys(STATUS_LABELS) as ProcurementStatus[];
  const status = validStatuses.includes(statusParam as ProcurementStatus)
    ? (statusParam as ProcurementStatus)
    : "";
  const validCategories = Object.keys(CATEGORY_LABELS) as ProcurementCategory[];
  const category = validCategories.includes(categoryParam as ProcurementCategory)
    ? (categoryParam as ProcurementCategory)
    : "";

  const andClauses: Prisma.ProcurementWhereInput[] = [];

  if (selectedFiscalYear) {
    andClauses.push({
      OR: [
        {
          purchaseRequest: {
            is: {
              documentDate: {
                gte: selectedFiscalYear.startDate,
                lte: selectedFiscalYear.endDate,
              },
            },
          },
        },
        {
          purchaseRequestId: null,
          createdAt: {
            gte: selectedFiscalYear.startDate,
            lte: selectedFiscalYear.endDate,
          },
        },
      ],
    });
  }

  if (status) andClauses.push({ status });
  if (category) andClauses.push({ purchaseRequest: { is: { category } } });
  if (departmentId) andClauses.push({ project: { is: { departmentId } } });
  if (query) {
    andClauses.push({
      OR: [
        { itemName: { contains: query, mode: "insensitive" } },
        { remarks: { contains: query, mode: "insensitive" } },
        { project: { is: { projectCode: { contains: query, mode: "insensitive" } } } },
        { project: { is: { projectName: { contains: query, mode: "insensitive" } } } },
        { purchaseRequest: { is: { documentNo: { contains: query, mode: "insensitive" } } } },
        { purchaseRequest: { is: { subject: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }

  if (session?.user.role === "TEACHER") {
    andClauses.push({
      OR: [
        { project: { is: { responsibleUserId: session.user.id } } },
        { purchaseRequest: { is: { createdById: session.user.id } } },
      ],
    });
  } else if (session?.user.role === "DEPT_HEAD" && session.user.departmentId) {
    andClauses.push({ project: { is: { departmentId: session.user.departmentId } } });
  }

  const where: Prisma.ProcurementWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const items = await prisma.procurement.findMany({
    where,
    include: {
      project: { include: { department: true } },
      purchaseRequest: {
        select: {
          id: true,
          documentNo: true,
          documentDate: true,
          subject: true,
          category: true,
          status: true,
          createdBy: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { itemName: "asc" }],
  });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const requestedCount = items.filter((item) => item.status === "REQUESTED").length;
  const orderedCount = items.filter((item) => item.status === "ORDERED").length;
  const receivedCount = items.filter((item) => item.status === "RECEIVED").length;
  const cancelledCount = items.filter((item) => item.status === "CANCELLED").length;
  const pendingReceiveCount = requestedCount + orderedCount;

  const byCategory = new Map<string, { label: string; value: number; count: number }>();
  const byDepartment = new Map<string, { label: string; value: number; count: number }>();
  for (const item of items) {
    const categoryLabel = item.purchaseRequest?.category
      ? CATEGORY_LABELS[item.purchaseRequest.category]
      : "ไม่ระบุหมวด";
    const categoryRow = byCategory.get(categoryLabel) ?? { label: categoryLabel, value: 0, count: 0 };
    categoryRow.value += Number(item.totalPrice);
    categoryRow.count += 1;
    byCategory.set(categoryLabel, categoryRow);

    const departmentLabel = item.project.department?.name ?? "ไม่ระบุกลุ่มบริหาร";
    const departmentRow = byDepartment.get(departmentLabel) ?? { label: departmentLabel, value: 0, count: 0 };
    departmentRow.value += Number(item.totalPrice);
    departmentRow.count += 1;
    byDepartment.set(departmentLabel, departmentRow);
  }

  const categoryRows = [...byCategory.values()].sort((a, b) => b.value - a.value);
  const departmentRows = [...byDepartment.values()].sort((a, b) => b.value - a.value);
  const recentItems = items.slice(0, 5);

  const csvRows: InventoryCsvRow[] = items.map((item) => ({
    code: item.purchaseRequest?.documentNo || item.id.slice(-8).toUpperCase(),
    itemName: item.itemName,
    projectName: item.project.projectName,
    departmentName: item.project.department?.name ?? "-",
    category: item.purchaseRequest?.category ? CATEGORY_LABELS[item.purchaseRequest.category] : "-",
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
    status: STATUS_LABELS[item.status],
    createdAt: item.createdAt.toISOString(),
  }));

  const fiscalOptions = fiscalYears.map((year) => ({ value: year.id, label: year.yearName }));
  const departmentOptions = departments.map((department) => ({ value: department.id, label: department.name }));
  const statusOptions = validStatuses.map((item) => ({ value: item, label: STATUS_LABELS[item] }));
  const categoryOptions = validCategories.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }));

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-10 print:bg-white">
      <section className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
            <Link href="/procurement" className="hover:text-primary">พัสดุ/จัดซื้อ</Link>
            <span>/</span>
            <span className="text-primary">ทะเบียนคุมสินค้าและวัสดุ</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">ทะเบียนคุมสินค้าและวัสดุ</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            ติดตามรายการวัสดุและสินค้าที่เกิดจากคำขอจัดซื้อ ตรวจสอบจำนวน มูลค่า สถานะรับเข้า และหน่วยงานที่เกี่ยวข้อง
            {selectedFiscalYear ? ` (${formatThaiDate(selectedFiscalYear.startDate)} - ${formatThaiDate(selectedFiscalYear.endDate)})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2 rounded-lg bg-white" asChild>
            <Link href="/procurement">
              <ArrowLeft className="size-4" />
              กลับไปหน้าหลัก
            </Link>
          </Button>
          <Button variant="outline" className="gap-2 rounded-lg bg-white" asChild>
            <Link href="/procurement/stock-movements">
              <ArrowUpDown className="size-4" />
              เคลื่อนไหววัสดุ
            </Link>
          </Button>
          <InventoryRegisterActions rows={csvRows} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={<Package className="size-5" />} label="รายการทั้งหมด" value={`${items.length.toLocaleString("th-TH")} รายการ`} helper={`${totalQuantity.toLocaleString("th-TH")} ชิ้น`} tone="violet" />
        <SummaryCard icon={<PackageSearch className="size-5" />} label="มูลค่ารวม" value={formatBaht(totalValue)} helper="จากรายการที่บันทึก" tone="gold" />
        <SummaryCard icon={<AlertTriangle className="size-5" />} label="รอดำเนินการ" value={`${requestedCount.toLocaleString("th-TH")} รายการ`} helper="ยังไม่สั่งซื้อ" tone="amber" />
        <SummaryCard icon={<Truck className="size-5" />} label="สั่งซื้อแล้ว" value={`${orderedCount.toLocaleString("th-TH")} รายการ`} helper="รอรับเข้า" tone="primary" />
        <SummaryCard icon={<PackageCheck className="size-5" />} label="รับเข้าแล้ว" value={`${receivedCount.toLocaleString("th-TH")} รายการ`} helper={`${percent(receivedCount, items.length).toFixed(1)}% ของรายการ`} tone="green" />
        <SummaryCard icon={<PackageX className="size-5" />} label="ยกเลิก" value={`${cancelledCount.toLocaleString("th-TH")} รายการ`} helper="ไม่ดำเนินการต่อ" tone="slate" />
      </section>

      {pendingReceiveCount > 0 && (
        <section className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-lg shadow-primary/10 print:hidden">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/10">
                <AlertTriangle className="size-7 text-[#fdc425]" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">มีรายการวัสดุที่ยังรอการรับเข้าพัสดุ ({pendingReceiveCount.toLocaleString("th-TH")} รายการ)</h2>
                <p className="mt-1 text-sm text-white/80">โปรดตรวจสอบสถานะรายการที่รอดำเนินการหรือสั่งซื้อแล้ว เพื่อให้ทะเบียนพัสดุเป็นปัจจุบัน</p>
              </div>
            </div>
            <Button className="bg-white text-primary hover:bg-white/90" asChild>
              <Link href="/procurement/inventory?status=ORDERED">ตรวจเช็ครายการ</Link>
            </Button>
          </div>
          <Package className="absolute -right-12 -top-12 size-44 text-white/10" />
        </section>
      )}

      <InventoryRegisterFilters
        fiscalYears={fiscalOptions}
        departments={departmentOptions}
        statuses={statusOptions}
        categories={categoryOptions}
      />

      <section className="grid gap-6 xl:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Inbox className="size-5 text-primary" />
              รายการสินค้าและวัสดุ
            </h2>
            <span className="text-xs font-bold text-slate-500">ทั้งหมด {items.length.toLocaleString("th-TH")} รายการ</span>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-black">รหัส/เลขที่</th>
                  <th className="px-5 py-3 font-black">รายการสินค้า/วัสดุ</th>
                  <th className="px-5 py-3 font-black">หมวด</th>
                  <th className="px-5 py-3 text-center font-black">จำนวน</th>
                  <th className="px-5 py-3 text-right font-black">ราคาต่อหน่วย</th>
                  <th className="px-5 py-3 text-right font-black">มูลค่ารวม</th>
                  <th className="px-5 py-3 text-center font-black">สถานะ</th>
                  <th className="px-5 py-3 text-center font-black print:hidden">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-500">ยังไม่มีรายการสินค้าและวัสดุตามตัวกรองนี้</td>
                  </tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-mono text-xs font-bold text-primary">{item.purchaseRequest?.documentNo || item.id.slice(-8).toUpperCase()}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatThaiDate(item.purchaseRequest?.documentDate ?? item.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-[260px] truncate font-bold text-slate-900">{item.itemName}</p>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{item.project.projectName}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {item.purchaseRequest?.category ? CATEGORY_LABELS[item.purchaseRequest.category] : "ไม่ระบุ"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-bold">{item.quantity.toLocaleString("th-TH")}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{formatBaht(Number(item.unitPrice))}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs font-black text-primary">{formatBaht(Number(item.totalPrice))}</td>
                    <td className="px-5 py-4 text-center"><StatusPill status={item.status} /></td>
                    <td className="px-5 py-4 text-center print:hidden">
                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" asChild>
                        <Link href={`/procurement/inventory/${item.id}`}>
                          <Eye className="size-4" />
                          ดู
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">ยังไม่มีรายการสินค้าและวัสดุตามตัวกรองนี้</div>
            ) : items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{item.itemName}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.purchaseRequest?.documentNo || item.id.slice(-8).toUpperCase()} · {formatThaiDate(item.purchaseRequest?.documentDate ?? item.createdAt)}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.project.projectName}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <MiniStat label="จำนวน" value={item.quantity.toLocaleString("th-TH")} />
                  <MiniStat label="ต่อหน่วย" value={formatBaht(Number(item.unitPrice))} />
                  <MiniStat label="รวม" value={formatBaht(Number(item.totalPrice))} primary />
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full bg-white" asChild>
                  <Link href={`/procurement/inventory/${item.id}`}>ดูรายละเอียดวัสดุ</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <RailCard title="สรุปตามหมวดพัสดุ">
            <BreakdownList rows={categoryRows} total={totalValue} emptyText="ยังไม่มีข้อมูลหมวดพัสดุ" />
          </RailCard>
          <RailCard title="กลุ่มบริหารที่ใช้พัสดุสูงสุด">
            <BreakdownList rows={departmentRows.slice(0, 6)} total={departmentRows[0]?.value ?? 0} emptyText="ยังไม่มีข้อมูลกลุ่มบริหาร" relative />
          </RailCard>
          <RailCard title="ความเคลื่อนไหวล่าสุด">
            <div className="space-y-3">
              {recentItems.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีความเคลื่อนไหว</p>
              ) : recentItems.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                    <Package className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{item.itemName}</p>
                    <p className="text-xs text-slate-500">{STATUS_LABELS[item.status]} · {formatThaiDate(item.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </RailCard>
        </aside>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "gold" | "violet" | "amber" | "green" | "slate";
}) {
  const toneClass = {
    primary: "bg-primary-fixed text-primary",
    gold: "bg-secondary-fixed text-[#5a4300]",
    violet: "bg-tertiary-fixed text-tertiary",
    amber: "bg-[#fdc425]/20 text-[#785a00]",
    green: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-xl", toneClass)}>{icon}</div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function StatusPill({ status }: { status: ProcurementStatus }) {
  const className = {
    REQUESTED: "bg-amber-100 text-amber-700",
    ORDERED: "bg-blue-100 text-blue-700",
    RECEIVED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-600",
  }[status];

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-black", className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function MiniStat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate font-mono text-xs font-black", primary ? "text-primary" : "text-slate-700")}>{value}</p>
    </div>
  );
}

function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
      <h2 className="mb-4 text-base font-extrabold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function BreakdownList({
  rows,
  total,
  emptyText,
  relative,
}: {
  rows: Array<{ label: string; value: number; count: number }>;
  total: number;
  emptyText: string;
  relative?: boolean;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold text-slate-700">{row.label}</span>
            <span className="shrink-0 font-mono text-xs font-black text-primary">{formatBaht(row.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(4, Math.min(100, percent(row.value, relative ? total : totalValueSafe(total))))}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{row.count.toLocaleString("th-TH")} รายการ</p>
        </div>
      ))}
    </div>
  );
}

function totalValueSafe(value: number) {
  return value > 0 ? value : 1;
}
