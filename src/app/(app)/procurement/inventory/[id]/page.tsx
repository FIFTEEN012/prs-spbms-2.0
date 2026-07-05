import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type {
  ProcurementCategory,
  ProcurementStatus,
  PurchaseRequestStatus,
} from "@prisma/client";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderKanban,
  History,
  Info,
  Package,
  PackageCheck,
  PackageX,
  ReceiptText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { canReadProject, type Actor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import { InventoryItemPrintButton } from "./_print-button";

const STATUS_LABELS: Record<ProcurementStatus, string> = {
  REQUESTED: "รอดำเนินการ",
  ORDERED: "สั่งซื้อแล้ว",
  RECEIVED: "รับเข้าแล้ว",
  CANCELLED: "ยกเลิก",
};

const REQUEST_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
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

type TimelineItem = {
  title: string;
  description: string;
  date?: Date | null;
  done: boolean;
};

export default async function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  if (!id) redirect("/procurement/inventory");

  const item = await prisma.procurement.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          department: true,
          responsibleUser: {
            select: { fullName: true, username: true },
          },
        },
      },
      purchaseRequest: {
        include: {
          activity: {
            include: {
              fundSource: true,
            },
          },
          fundSource: true,
          budgetWallet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              fullName: true,
              username: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!item) redirect("/procurement/inventory");

  const actor: Actor = {
    id: session.user.id,
    role: session.user.role,
    departmentId: session.user.departmentId ?? null,
  };

  const canRead =
    canReadProject(actor, {
      responsibleUserId: item.project.responsibleUserId,
      departmentId: item.project.departmentId,
      status: item.project.status,
    }) ||
    item.purchaseRequest?.createdById === session.user.id;

  if (!canRead) redirect("/procurement/inventory");

  const itemCode = item.purchaseRequest?.documentNo || item.id.slice(-8).toUpperCase();
  const categoryLabel = item.purchaseRequest?.category
    ? CATEGORY_LABELS[item.purchaseRequest.category]
    : "ไม่ระบุหมวด";
  const statusInfo = getStatusInfo(item.status);
  const timeline = buildTimeline(item);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-12 print:bg-white">
      <section className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <Link href="/procurement" className="hover:text-primary">พัสดุ/จัดซื้อ</Link>
            <span>/</span>
            <Link href="/procurement/inventory" className="hover:text-primary">ทะเบียนคุมสินค้าและวัสดุ</Link>
            <span>/</span>
            <span className="text-primary">รายละเอียดวัสดุ</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">รายละเอียดสินค้าและวัสดุ</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            ตรวจสอบข้อมูลรายการวัสดุ แหล่งที่มา โครงการ คำขอจัดซื้อ และสถานะการดำเนินการ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2 rounded-lg bg-white" asChild>
            <Link href="/procurement/inventory">
              <ArrowLeft className="size-4" />
              กลับทะเบียนวัสดุ
            </Link>
          </Button>
          {item.purchaseRequest && (
            <Button variant="outline" className="gap-2 rounded-lg bg-white" asChild>
              <Link href={`/procurement/${item.purchaseRequest.id}`}>
                <ReceiptText className="size-4" />
                ดูคำขอจัดซื้อ
              </Link>
            </Button>
          )}
          <Button className="gap-2 rounded-lg bg-primary text-white hover:bg-primary/90" asChild>
            <Link href={`/projects/${item.projectId}`}>
              <FolderKanban className="size-4" />
              ดูโครงการ
            </Link>
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-primary-fixed text-primary shadow-sm">
              <Package className="size-8" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900">{item.itemName}</h2>
                <StatusPill status={item.status} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span>รหัส/เลขที่: <b className="font-mono text-slate-800">{itemCode}</b></span>
                <span>โครงการ: <b className="text-slate-800">{item.project.projectName}</b></span>
                <span>วันที่สร้าง: <b className="text-slate-800">{formatThaiDate(item.createdAt)}</b></span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-500">มูลค่ารวม</p>
            <p className="font-mono text-2xl font-black text-primary">{formatBaht(Number(item.totalPrice))}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<ClipboardList className="size-5" />} label="จำนวน" value={item.quantity.toLocaleString("th-TH")} helper="จำนวนตามรายการจัดซื้อ" tone="primary" />
        <SummaryCard icon={<CircleDollarSign className="size-5" />} label="ราคาต่อหน่วย" value={formatBaht(Number(item.unitPrice))} helper="ราคาที่บันทึกในคำขอ" tone="slate" />
        <SummaryCard icon={<Banknote className="size-5" />} label="มูลค่ารวม" value={formatBaht(Number(item.totalPrice))} helper="จำนวน x ราคาต่อหน่วย" tone="gold" />
        <SummaryCard icon={statusInfo.icon} label="สถานะรายการ" value={STATUS_LABELS[item.status]} helper={statusInfo.helper} tone={statusInfo.tone} />
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <main className="space-y-6 xl:col-span-8">
          <div className={cn("relative overflow-hidden rounded-2xl p-6 text-white shadow-lg", statusInfo.bannerClass)}>
            <div className="relative z-10 flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/10">
                {statusInfo.icon}
              </div>
              <div>
                <h2 className="text-lg font-extrabold">{statusInfo.title}</h2>
                <p className="mt-1 text-sm text-white/85">{statusInfo.description}</p>
              </div>
            </div>
            <Package className="absolute -bottom-8 -right-8 size-36 text-white/10" />
          </div>

          <InfoCard icon={<Info className="size-5" />} title="ข้อมูลสินค้าและวัสดุ">
            <InfoGrid>
              <InfoItem label="ชื่อรายการ" value={item.itemName} />
              <InfoItem label="หมวดหมู่" value={categoryLabel} />
              <InfoItem label="ปริมาณ" value={`${item.quantity.toLocaleString("th-TH")} หน่วย`} />
              <InfoItem label="ราคาต่อหน่วย" value={formatBaht(Number(item.unitPrice))} />
              <InfoItem label="มูลค่ารวม" value={formatBaht(Number(item.totalPrice))} highlight />
              <InfoItem label="วันที่สร้างรายการ" value={formatThaiDate(item.createdAt)} />
            </InfoGrid>
          </InfoCard>

          <InfoCard icon={<ReceiptText className="size-5" />} title="ข้อมูลคำขอจัดซื้อ">
            {item.purchaseRequest ? (
              <InfoGrid>
                <InfoItem label="เลขที่เอกสาร" value={item.purchaseRequest.documentNo || "-"} mono href={`/procurement/${item.purchaseRequest.id}`} />
                <InfoItem label="สถานะคำขอ" value={REQUEST_STATUS_LABELS[item.purchaseRequest.status]} />
                <InfoItem label="เรื่อง" value={item.purchaseRequest.subject} wide />
                <InfoItem label="ยอดรวมคำขอ" value={formatBaht(Number(item.purchaseRequest.requestedAmount))} />
                <InfoItem label="ผู้สร้างคำขอ" value={item.purchaseRequest.createdBy?.fullName ?? "-"} />
                <InfoItem label="วันที่เอกสาร" value={formatThaiDate(item.purchaseRequest.documentDate)} />
                <InfoItem label="กระเป๋างบประมาณ" value={formatWallet(item.purchaseRequest.budgetWallet)} />
                <InfoItem label="แหล่งเงิน" value={item.purchaseRequest.fundSource?.name ?? "-"} />
              </InfoGrid>
            ) : (
              <EmptyText>รายการนี้ยังไม่มีคำขอจัดซื้อที่เชื่อมโยง</EmptyText>
            )}
          </InfoCard>

          <InfoCard icon={<FolderKanban className="size-5" />} title="โครงการและงบประมาณที่เกี่ยวข้อง">
            <InfoGrid>
              <InfoItem label="รหัสโครงการ" value={item.project.projectCode} mono href={`/projects/${item.projectId}`} />
              <InfoItem label="ชื่อโครงการ" value={item.project.projectName} wide />
              <InfoItem label="กลุ่มบริหาร" value={item.project.department?.name ?? "-"} />
              <InfoItem label="ผู้รับผิดชอบ" value={item.project.responsibleUser?.fullName ?? "-"} />
              <InfoItem label="งบอนุมัติโครงการ" value={formatBaht(Number(item.project.budgetApproved))} />
              <InfoItem label="สถานะโครงการ" value={item.project.status} />
              <InfoItem label="กิจกรรม" value={item.purchaseRequest?.activity?.name ?? "-"} wide />
              <InfoItem label="แหล่งเงินกิจกรรม" value={item.purchaseRequest?.activity?.fundSource?.name ?? "-"} />
            </InfoGrid>
          </InfoCard>

          <InfoCard icon={<FileText className="size-5" />} title="หมายเหตุและรายละเอียดเพิ่มเติม">
            {item.remarks ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.remarks}</p>
            ) : (
              <EmptyText>ยังไม่มีหมายเหตุเพิ่มเติมสำหรับรายการนี้</EmptyText>
            )}
          </InfoCard>

          <InfoCard icon={<History className="size-5" />} title="ประวัติรายการ">
            <div className="space-y-0">
              {timeline.map((step, index) => (
                <TimelineStep key={`${step.title}-${index}`} step={step} isLast={index === timeline.length - 1} />
              ))}
            </div>
          </InfoCard>
        </main>

        <aside className="space-y-4 xl:col-span-4">
          <div className="sticky top-24 space-y-4">
            <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white/85">
              <CardHeader className="border-b border-slate-200 bg-slate-50/80 p-5">
                <CardTitle className="text-base font-extrabold">สรุปข้อมูลสำคัญ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <SideRow label="สถานะปัจจุบัน" value={STATUS_LABELS[item.status]} strong />
                <SideRow label="มูลค่ารวม" value={formatBaht(Number(item.totalPrice))} strong />
                <SideRow label="เลขคำขอจัดซื้อ" value={item.purchaseRequest?.documentNo || "-"} mono />
                <SideRow label="รหัสโครงการ" value={item.project.projectCode} mono />
                <SideRow label="วันที่สร้างรายการ" value={formatThaiDate(item.createdAt)} />
              </CardContent>
              <div className="space-y-3 border-t border-slate-200 bg-slate-50/80 p-4 print:hidden">
                <InventoryItemPrintButton />
                {item.purchaseRequest && (
                  <Button variant="outline" className="w-full bg-white" asChild>
                    <Link href={`/procurement/${item.purchaseRequest.id}`}>ดูคำขอจัดซื้อ</Link>
                  </Button>
                )}
              </div>
            </Card>

            <div className={cn("rounded-2xl border p-5", item.status === "RECEIVED" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
              <div className="flex gap-3">
                <ShieldCheck className={cn("mt-0.5 size-5", item.status === "RECEIVED" ? "text-emerald-700" : "text-amber-700")} />
                <div>
                  <p className={cn("text-sm font-black", item.status === "RECEIVED" ? "text-emerald-800" : "text-amber-800")}>
                    {item.status === "RECEIVED" ? "ตรวจสอบแล้ว" : "รอติดตามสถานะ"}
                  </p>
                  <p className={cn("mt-1 text-xs leading-5", item.status === "RECEIVED" ? "text-emerald-700" : "text-amber-700")}>
                    {item.status === "RECEIVED"
                      ? "รายการนี้ผ่านกระบวนการอนุมัติและบันทึกรับเข้าตามข้อมูลในระบบแล้ว"
                      : "รายการนี้ยังไม่จบสถานะรับเข้า โปรดติดตามจากคำขอจัดซื้อที่เกี่ยวข้อง"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function getStatusInfo(status: ProcurementStatus): {
  title: string;
  description: string;
  helper: string;
  tone: "primary" | "gold" | "green" | "slate";
  bannerClass: string;
  icon: ReactNode;
} {
  if (status === "REQUESTED") {
    return {
      title: "รายการนี้ถูกบันทึกจากคำขอจัดซื้อแล้ว",
      description: "รายการนี้อยู่ระหว่างกระบวนการจัดซื้อหรือรอตรวจสอบเพิ่มเติม",
      helper: "รอขั้นตอนถัดไป",
      tone: "gold",
      bannerClass: "bg-[#785a00]",
      icon: <ClipboardList className="size-5" />,
    };
  }
  if (status === "ORDERED") {
    return {
      title: "รายการนี้อยู่ระหว่างสั่งซื้อ",
      description: "กรุณาติดตามการส่งมอบและบันทึกสถานะเมื่อได้รับสินค้า/วัสดุ",
      helper: "รอรับเข้า",
      tone: "primary",
      bannerClass: "bg-primary",
      icon: <Truck className="size-5" />,
    };
  }
  if (status === "RECEIVED") {
    return {
      title: "รายการนี้รับเข้าแล้ว",
      description: "รายการนี้ถูกบันทึกว่าได้รับสินค้า/วัสดุเรียบร้อยแล้ว",
      helper: "พร้อมตรวจสอบ",
      tone: "green",
      bannerClass: "bg-emerald-700",
      icon: <PackageCheck className="size-5" />,
    };
  }
  return {
    title: "รายการนี้ถูกยกเลิก",
    description: "รายการนี้ถูกบันทึกเป็นสถานะยกเลิกจากกระบวนการคำขอจัดซื้อที่เกี่ยวข้อง",
    helper: "ไม่ดำเนินการต่อ",
    tone: "slate",
    bannerClass: "bg-slate-700",
    icon: <PackageX className="size-5" />,
  };
}

function buildTimeline(item: {
  createdAt: Date;
  status: ProcurementStatus;
  purchaseRequest: {
    createdAt: Date;
    planApprovedAt: Date | null;
    financeApprovedAt: Date | null;
    procurementApprovedAt: Date | null;
    budgetApprovedAt: Date | null;
    directorApprovedAt: Date | null;
    createdBy?: { fullName: string } | null;
  } | null;
}): TimelineItem[] {
  const steps: TimelineItem[] = [];

  if (item.purchaseRequest) {
    steps.push({
      title: "สร้างคำขอจัดซื้อ",
      description: `จัดทำเอกสารตั้งต้นโดย ${item.purchaseRequest.createdBy?.fullName ?? "ผู้ใช้งานระบบ"}`,
      date: item.purchaseRequest.createdAt,
      done: true,
    });
    steps.push({
      title: "แผนงานตรวจสอบ",
      description: "ตรวจสอบความสอดคล้องของคำขอและแผนงาน",
      date: item.purchaseRequest.planApprovedAt,
      done: Boolean(item.purchaseRequest.planApprovedAt),
    });
    steps.push({
      title: "การเงินตรวจสอบ",
      description: "ตรวจสอบวงเงินและความพร้อมของงบประมาณ",
      date: item.purchaseRequest.financeApprovedAt,
      done: Boolean(item.purchaseRequest.financeApprovedAt),
    });
    steps.push({
      title: "พัสดุตรวจสอบรายการ",
      description: "ตรวจสอบรายการพัสดุ จำนวน หน่วย และราคา",
      date: item.purchaseRequest.procurementApprovedAt,
      done: Boolean(item.purchaseRequest.procurementApprovedAt),
    });
    steps.push({
      title: "หัวหน้างบเห็นชอบ",
      description: "กันวงเงินและเสนอผู้บริหารอนุมัติ",
      date: item.purchaseRequest.budgetApprovedAt,
      done: Boolean(item.purchaseRequest.budgetApprovedAt),
    });
    steps.push({
      title: "ผู้อำนวยการอนุมัติ",
      description: "อนุมัติคำขอจัดซื้อขั้นสุดท้าย",
      date: item.purchaseRequest.directorApprovedAt,
      done: Boolean(item.purchaseRequest.directorApprovedAt),
    });
  }

  steps.push({
    title: "บันทึกรายการพัสดุ",
    description: "รายการสินค้าและวัสดุถูกบันทึกเข้าทะเบียนคุม",
    date: item.createdAt,
    done: true,
  });

  if (item.status === "ORDERED" || item.status === "RECEIVED") {
    steps.push({
      title: "สั่งซื้อรายการพัสดุ",
      description: "รายการนี้ผ่านขั้นตอนพัสดุและอยู่ในกระบวนการจัดซื้อ",
      date: item.purchaseRequest?.procurementApprovedAt ?? item.createdAt,
      done: true,
    });
  }

  if (item.status === "RECEIVED") {
    steps.push({
      title: "รับเข้าพัสดุเรียบร้อยแล้ว",
      description: "รายการนี้ถูกบันทึกว่าได้รับสินค้า/วัสดุเรียบร้อยแล้ว",
      date: item.purchaseRequest?.directorApprovedAt ?? item.createdAt,
      done: true,
    });
  }

  if (item.status === "CANCELLED") {
    steps.push({
      title: "ยกเลิกรายการพัสดุ",
      description: "รายการนี้ถูกยกเลิกจากกระบวนการคำขอจัดซื้อ",
      date: item.createdAt,
      done: true,
    });
  }

  return steps;
}

function formatWallet(wallet: { code: string | null; name: string } | null) {
  if (!wallet) return "-";
  return wallet.code ? `${wallet.code} - ${wallet.name}` : wallet.name;
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
  tone: "primary" | "gold" | "green" | "slate";
}) {
  const toneClass = {
    primary: "bg-primary-fixed text-primary",
    gold: "bg-secondary-fixed text-[#5a4300]",
    green: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <Card className="rounded-2xl border-slate-200 bg-white/85">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", toneClass)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: ProcurementStatus }) {
  const className = {
    REQUESTED: "bg-amber-100 text-amber-700 border-amber-200",
    ORDERED: "bg-blue-100 text-blue-700 border-blue-200",
    RECEIVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  }[status];

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-black", className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white/85">
      <CardHeader className="border-b border-slate-200 bg-slate-50/80 p-5">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold text-primary">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">{children}</div>;
}

function InfoItem({
  label,
  value,
  href,
  mono,
  wide,
  highlight,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  wide?: boolean;
  highlight?: boolean;
}) {
  const contentClass = cn(
    "text-sm font-bold",
    mono && "font-mono",
    highlight ? "text-primary" : "text-slate-900",
  );

  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <p className="mb-1 text-xs font-bold text-slate-500">{label}</p>
      {href ? (
        <Link href={href} className={cn(contentClass, "hover:underline")}>{value || "-"}</Link>
      ) : (
        <p className={contentClass}>{value || "-"}</p>
      )}
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function TimelineStep({ step, isLast }: { step: TimelineItem; isLast: boolean }) {
  return (
    <div className="relative pb-8 pl-9 last:pb-0">
      {!isLast && <div className="absolute left-[11px] top-6 h-full w-0.5 bg-slate-200" />}
      <div className={cn(
        "absolute left-0 top-0 z-10 size-6 rounded-full border-4",
        step.done ? "border-emerald-100 bg-emerald-500" : "border-white bg-slate-300",
      )} />
      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <p className={cn("text-sm font-black", step.done ? "text-slate-900" : "text-slate-500")}>{step.title}</p>
          <p className="mt-1 text-sm text-slate-500">{step.description}</p>
        </div>
        <p className="shrink-0 font-mono text-xs text-slate-400">{step.date ? formatThaiDate(step.date) : "รอดำเนินการ"}</p>
      </div>
    </div>
  );
}

function SideRow({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-right font-bold text-slate-900", strong && "text-primary", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
