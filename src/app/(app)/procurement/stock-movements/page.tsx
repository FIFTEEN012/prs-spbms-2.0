import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Prisma, ProcurementCategory, ProcurementStatus } from "@prisma/client";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Box,
  ClipboardList,
  Info,
  Package,
  PackageCheck,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { canReadProject, type Actor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import { StockMovementFilters } from "./_components/stock-movement-filters";

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

type MovementType = "RECEIVE" | "ISSUE" | "ADJUST" | "CANCEL" | "TRACK";

type MovementRow = {
  id: string;
  type: MovementType;
  typeLabel: string;
  itemName: string;
  code: string;
  quantity: number;
  value: number;
  date: Date;
  status: ProcurementStatus;
  categoryLabel: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  departmentName: string;
  requestId?: string;
  requestNo: string;
  requestSubject: string;
  recordedBy: string;
};

type SearchParams = {
  fiscalYearId?: string | string[];
  movementType?: string | string[];
  status?: string | string[];
  category?: string | string[];
  departmentId?: string | string[];
  q?: string | string[];
};

function getParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const params = await searchParams;
  const fiscalYearIdParam = getParam(params.fiscalYearId);
  const movementTypeParam = getParam(params.movementType);
  const statusParam = getParam(params.status);
  const categoryParam = getParam(params.category);
  const departmentId = getParam(params.departmentId);
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
  const validMovementTypes = ["RECEIVE", "ISSUE", "ADJUST", "CANCEL"] as const;
  const selectedMovementType = validMovementTypes.includes(movementTypeParam as (typeof validMovementTypes)[number])
    ? movementTypeParam
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

  const actor: Actor = {
    id: session.user.id,
    role: session.user.role,
    departmentId: session.user.departmentId ?? null,
  };

  if (session.user.role === "TEACHER") {
    andClauses.push({
      OR: [
        { project: { is: { responsibleUserId: session.user.id } } },
        { purchaseRequest: { is: { createdById: session.user.id } } },
      ],
    });
  } else if (session.user.role === "DEPT_HEAD" && session.user.departmentId) {
    andClauses.push({ project: { is: { departmentId: session.user.departmentId } } });
  }

  const items = await prisma.procurement.findMany({
    where: andClauses.length > 0 ? { AND: andClauses } : {},
    include: {
      project: {
        include: {
          department: true,
          responsibleUser: { select: { fullName: true } },
        },
      },
      purchaseRequest: {
        select: {
          id: true,
          documentNo: true,
          documentDate: true,
          subject: true,
          category: true,
          status: true,
          createdAt: true,
          createdById: true,
          createdBy: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { itemName: "asc" }],
  });

  const visibleItems = items.filter((item) =>
    canReadProject(actor, {
      responsibleUserId: item.project.responsibleUserId,
      departmentId: item.project.departmentId,
      status: item.project.status,
    }) || item.purchaseRequest?.createdById === session.user.id,
  );

  const rows = visibleItems.map<MovementRow>((item) => {
    const movement = getMovementType(item.status);
    return {
      id: item.id,
      type: movement.type,
      typeLabel: movement.label,
      itemName: item.itemName,
      code: item.purchaseRequest?.documentNo || item.id.slice(-8).toUpperCase(),
      quantity: item.quantity,
      value: Number(item.totalPrice),
      date: item.purchaseRequest?.documentDate ?? item.createdAt,
      status: item.status,
      categoryLabel: item.purchaseRequest?.category ? CATEGORY_LABELS[item.purchaseRequest.category] : "ไม่ระบุหมวด",
      projectId: item.projectId,
      projectCode: item.project.projectCode,
      projectName: item.project.projectName,
      departmentName: item.project.department?.name ?? "ไม่ระบุกลุ่มบริหาร",
      requestId: item.purchaseRequest?.id,
      requestNo: item.purchaseRequest?.documentNo || "-",
      requestSubject: item.purchaseRequest?.subject || "-",
      recordedBy: item.purchaseRequest?.createdBy?.fullName ?? item.project.responsibleUser?.fullName ?? "ระบบ",
    };
  });

  const displayRows = selectedMovementType
    ? rows.filter((row) => row.type === selectedMovementType)
    : rows;
  const receivedRows = rows.filter((row) => row.type === "RECEIVE");
  const issueRows = rows.filter((row) => row.type === "ISSUE");
  const adjustRows = rows.filter((row) => row.type === "ADJUST");
  const receivedValue = receivedRows.reduce((sum, row) => sum + row.value, 0);
  const incompleteRows = rows.filter((row) => !row.requestId || row.type === "TRACK").length;

  const byStatus = validStatuses.map((item) => ({
    label: STATUS_LABELS[item],
    count: rows.filter((row) => row.status === item).length,
  }));
  const recentRows = [...rows].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-10">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <Link href="/procurement" className="hover:text-primary">พัสดุ/จัดซื้อ</Link>
            <span>/</span>
            <span className="text-primary">รับเข้า / เบิกออก / ปรับยอดวัสดุ</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">รับเข้า / เบิกออก / ปรับยอดวัสดุ</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            ติดตามความเคลื่อนไหวของวัสดุจากคำขอจัดซื้อ การรับเข้า การเบิกออก และการปรับยอด
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-lg bg-white" asChild>
          <Link href="/procurement/inventory">
            <ArrowLeft className="size-4" />
            กลับทะเบียนวัสดุ
          </Link>
        </Button>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
        <div className="flex gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Info className="size-5" />
          </div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="font-extrabold text-primary">หน้านี้แสดงความเคลื่อนไหวจากข้อมูลจัดซื้อที่มีอยู่</h2>
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-black text-white">โหมดสรุปจากข้อมูลจัดซื้อ</span>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              ระบบยังไม่มีตารางรับเข้า/เบิกออก/ปรับยอดแบบคลังเต็มรูปแบบ จึงแสดงข้อมูลจากรายการจัดซื้อและสถานะพัสดุที่มีอยู่ในระบบก่อน
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={<ClipboardList className="size-5" />} label="ทั้งหมด" value={`${rows.length.toLocaleString("th-TH")} รายการ`} helper="จากทะเบียนพัสดุ" tone="primary" />
        <SummaryCard icon={<PackageCheck className="size-5" />} label="รับเข้า" value={`${receivedRows.length.toLocaleString("th-TH")} รายการ`} helper="จากสถานะรับเข้าแล้ว" tone="green" />
        <SummaryCard icon={<ArrowUpDown className="size-5" />} label="เบิกออก" value={`${issueRows.length.toLocaleString("th-TH")} รายการ`} helper="ยังไม่มีระบบเบิกออก" tone="amber" muted />
        <SummaryCard icon={<RefreshCw className="size-5" />} label="ปรับยอด" value={`${adjustRows.length.toLocaleString("th-TH")} รายการ`} helper="ยังไม่มีระบบปรับยอด" tone="blue" muted />
        <SummaryCard icon={<TrendingUp className="size-5" />} label="มูลค่ารับเข้ารวม" value={formatBaht(receivedValue)} helper="รวมรายการรับเข้า" tone="gold" />
        <SummaryCard icon={<AlertTriangle className="size-5" />} label="ควรตรวจสอบ" value={`${incompleteRows.toLocaleString("th-TH")} รายการ`} helper="ข้อมูลไม่ครบ/ยังไม่รับเข้า" tone="red" />
      </section>

      <StockMovementFilters
        fiscalYears={fiscalYears.map((year) => ({ value: year.id, label: year.yearName }))}
        departments={departments.map((department) => ({ value: department.id, label: department.name }))}
        statuses={validStatuses.map((item) => ({ value: item, label: STATUS_LABELS[item] }))}
        categories={validCategories.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }))}
      />

      <section className="grid gap-6 xl:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Package className="size-5 text-primary" />
              รายการความเคลื่อนไหววัสดุ
            </h2>
            <span className="text-xs font-bold text-slate-500">แสดง {displayRows.length.toLocaleString("th-TH")} รายการ</span>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">วันที่</th>
                  <th className="px-4 py-3 font-black">ประเภท</th>
                  <th className="px-4 py-3 font-black">รายการวัสดุ</th>
                  <th className="px-4 py-3 font-black">โครงการ / คำขอ</th>
                  <th className="px-4 py-3 text-right font-black">จำนวนก่อน</th>
                  <th className="px-4 py-3 text-right font-black">ความเคลื่อนไหว</th>
                  <th className="px-4 py-3 text-right font-black">คงเหลือ</th>
                  <th className="px-4 py-3 text-right font-black">มูลค่า</th>
                  <th className="px-4 py-3 font-black">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-500">ยังไม่มีรายการความเคลื่อนไหวตามตัวกรองนี้</td>
                  </tr>
                ) : displayRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-4 text-slate-700">{formatThaiDate(row.date)}</td>
                    <td className="px-4 py-4"><MovementPill type={row.type} label={row.typeLabel} /></td>
                    <td className="px-4 py-4">
                      <Link href={`/procurement/inventory/${row.id}`} className="font-bold text-slate-900 hover:text-primary hover:underline">{row.itemName}</Link>
                      <p className="mt-1 text-xs text-slate-500">รหัส: {row.code} · {row.categoryLabel}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-4">
                      <Link href={`/projects/${row.projectId}`} className="block truncate text-xs font-bold text-slate-700 hover:text-primary hover:underline">{row.projectName}</Link>
                      {row.requestId ? (
                        <Link href={`/procurement/${row.requestId}`} className="font-mono text-[11px] font-bold text-primary hover:underline">{row.requestNo}</Link>
                      ) : (
                        <span className="text-[11px] text-slate-400">ไม่มีคำขอจัดซื้อ</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-xs italic text-slate-400">ยังไม่มีข้อมูล</td>
                    <td className="px-4 py-4 text-right font-bold"><QuantityText row={row} /></td>
                    <td className="px-4 py-4 text-right text-xs italic text-slate-400">ยังไม่มีข้อมูลคงเหลือ</td>
                    <td className="px-4 py-4 text-right font-mono text-xs font-black text-primary">{formatBaht(row.value)}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{row.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {displayRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">ยังไม่มีรายการความเคลื่อนไหวตามตัวกรองนี้</div>
            ) : displayRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/procurement/inventory/${row.id}`} className="font-bold text-slate-900">{row.itemName}</Link>
                    <p className="mt-1 text-xs text-slate-500">{formatThaiDate(row.date)} · {row.code}</p>
                  </div>
                  <MovementPill type={row.type} label={row.typeLabel} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{row.projectName}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <MiniStat label="จำนวนก่อน" value="ยังไม่มีข้อมูล" />
                  <MiniStat label="เคลื่อนไหว" value={movementQuantityText(row)} primary />
                  <MiniStat label="มูลค่า" value={formatBaht(row.value)} primary />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <RailCard title="สัดส่วนสถานะพัสดุ">
            <div className="space-y-4">
              {byStatus.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-bold text-slate-700">{item.label}</span>
                    <span className="font-mono text-xs font-black text-primary">{item.count.toLocaleString("th-TH")}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, percent(item.count, rows.length)))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </RailCard>
          <RailCard title="รายการล่าสุด">
            <div className="space-y-3">
              {recentRows.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีความเคลื่อนไหว</p>
              ) : recentRows.map((row) => (
                <Link key={row.id} href={`/procurement/inventory/${row.id}`} className="flex gap-3 rounded-xl bg-slate-50 p-3 hover:bg-primary-fixed/40">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                    <Box className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{row.itemName}</p>
                    <p className="text-xs text-slate-500">{row.typeLabel} · {formatThaiDate(row.date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </RailCard>
          <RailCard title="ข้อจำกัดระบบคลังปัจจุบัน">
            <div className="space-y-3 text-sm text-slate-600">
              <p>ยังไม่มีตาราง stock ledger สำหรับจำนวนก่อนทำรายการ ยอดคงเหลือ การเบิกออก และการปรับยอด</p>
              <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                หากต้องการใช้งานคลังเต็มรูปแบบ ควรเพิ่ม schema `StockMovement` ในรอบถัดไป
              </p>
            </div>
          </RailCard>
        </aside>
      </section>
    </div>
  );
}

function getMovementType(status: ProcurementStatus): { type: MovementType; label: string } {
  if (status === "RECEIVED") return { type: "RECEIVE", label: "รับเข้า" };
  if (status === "CANCELLED") return { type: "CANCEL", label: "ยกเลิก" };
  return { type: "TRACK", label: STATUS_LABELS[status] };
}

function movementQuantityText(row: MovementRow) {
  if (row.type === "RECEIVE") return `+ ${row.quantity.toLocaleString("th-TH")}`;
  if (row.type === "CANCEL") return `ยกเลิก ${row.quantity.toLocaleString("th-TH")}`;
  return row.quantity.toLocaleString("th-TH");
}

function QuantityText({ row }: { row: MovementRow }) {
  const className = row.type === "RECEIVE"
    ? "text-emerald-600"
    : row.type === "CANCEL"
      ? "text-red-600"
      : "text-slate-700";
  return <span className={className}>{movementQuantityText(row)}</span>;
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  tone,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "green" | "amber" | "blue" | "gold" | "red";
  muted?: boolean;
}) {
  const toneClass = {
    primary: "bg-primary-fixed text-primary",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    gold: "bg-secondary-fixed text-[#5a4300]",
    red: "bg-red-100 text-red-700",
  }[tone];

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm", muted && "opacity-75")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <div className={cn("flex size-9 items-center justify-center rounded-xl", toneClass)}>{icon}</div>
      </div>
      <p className="text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function MovementPill({ type, label }: { type: MovementType; label: string }) {
  const className = {
    RECEIVE: "bg-emerald-100 text-emerald-700",
    ISSUE: "bg-orange-100 text-orange-700",
    ADJUST: "bg-blue-100 text-blue-700",
    CANCEL: "bg-red-100 text-red-700",
    TRACK: "bg-slate-100 text-slate-600",
  }[type];

  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-black", className)}>{label}</span>;
}

function MiniStat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate text-xs font-black", primary ? "text-primary" : "text-slate-600")}>{value}</p>
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
