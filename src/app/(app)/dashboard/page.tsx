import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma, ProjectStatus, PurchaseRequestStatus, Role } from "@prisma/client";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileEdit,
  FilePlus2,
  FolderKanban,
  Gauge,
  History,
  ListChecks,
  PieChart,
  PlusCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Wallet,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canReadProject, canViewBudgetWallet, type Actor } from "@/lib/authorization";
import { authOptions } from "@/lib/auth";
import { calculateWalletBalance } from "@/lib/budget-wallets";
import { prisma } from "@/lib/prisma";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "REVIEWED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const PENDING_PROJECT_STATUSES: ProjectStatus[] = ["SUBMITTED", "REVIEWED"];
const APPROVED_PROJECT_STATUSES: ProjectStatus[] = [
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
];
const LOW_WALLET_PERCENT = 15;

type DashboardUser = {
  id: string;
  fullName?: string | null;
  role: Role;
  departmentId?: string | null;
};

type DashboardTask = {
  id: string;
  title: string;
  description: string;
  badge: string;
  href: string;
  actionLabel: string;
  tone: "gold" | "blue" | "green" | "red" | "purple" | "slate";
};

type DashboardListItem = {
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  status: string;
  href: string;
  date?: string | null;
};

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
};

type ProjectStatusRow = {
  status: ProjectStatus;
  label: string;
  value: number;
};

type BudgetOverview = {
  hasLockedPlan: boolean;
  planName: string | null;
  allocated: number;
  committed: number;
  spent: number;
  available: number;
  accountingBalance: number;
  walletCount: number;
  error?: boolean;
};

type DashboardData = {
  activeYear: { id: string; yearName: string } | null;
  todayText: string;
  projectSummary: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    purchaseRequests: number;
  };
  statusRows: ProjectStatusRow[];
  budget: BudgetOverview;
  tasks: DashboardTask[];
  approvalItems: DashboardListItem[];
  purchaseItems: DashboardListItem[];
  auditItems: Array<{
    id: string;
    actor: string;
    action: string;
    entity: string;
    date: string;
  }>;
  quickActions: QuickAction[];
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งขออนุมัติ",
  REVIEWED: "ตรวจสอบแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ตีกลับ",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const STATUS_TONES: Record<ProjectStatus, { badge: string; bar: string }> = {
  DRAFT: { badge: "border-slate-200 bg-slate-100 text-slate-700", bar: "bg-slate-400" },
  SUBMITTED: { badge: "border-amber-200 bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  REVIEWED: { badge: "border-blue-200 bg-blue-100 text-blue-800", bar: "bg-blue-500" },
  APPROVED: { badge: "border-emerald-200 bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  REJECTED: { badge: "border-red-200 bg-red-100 text-red-800", bar: "bg-red-500" },
  IN_PROGRESS: { badge: "border-violet-200 bg-violet-100 text-violet-800", bar: "bg-violet-500" },
  COMPLETED: { badge: "border-green-200 bg-green-100 text-green-800", bar: "bg-green-600" },
  CANCELLED: { badge: "border-slate-300 bg-slate-200 text-slate-700", bar: "bg-slate-500" },
};

const PURCHASE_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  PENDING: "รอตรวจแผน",
  PLAN_REVIEWED: "รอการเงินตรวจ",
  FINANCE_REVIEWED: "รอพัสดุตรวจ",
  PROCUREMENT_REVIEWED: "รองบประมาณตรวจ",
  BUDGET_REVIEWED: "รอผู้อำนวยการอนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ตีกลับ",
};

const roleNames: Record<Role, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  DEPT_HEAD: "หัวหน้ากลุ่มงาน",
  TEACHER: "ครูผู้รับผิดชอบโครงการ",
  FINANCE: "เจ้าหน้าที่การเงิน",
  PROCUREMENT: "เจ้าหน้าที่พัสดุ",
  COMMITTEE: "คณะกรรมการสถานศึกษา",
};

const thaiDateLong = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function getProjectScopeWhere(
  user: DashboardUser | undefined,
  activeYearId: string | null,
): Prisma.ProjectWhereInput {
  const academicYearFilter = activeYearId ? { academicYearId: activeYearId } : {};
  if (!user) return { ...academicYearFilter, id: "__no_access__" };

  if (
    user.role === "SUPER_ADMIN" ||
    user.role === "EXECUTIVE" ||
    user.role === "FINANCE" ||
    user.role === "PROCUREMENT"
  ) {
    return academicYearFilter;
  }

  if (user.role === "DEPT_HEAD" || user.role === "TEACHER") {
    return {
      ...academicYearFilter,
      OR: [
        { responsibleUserId: user.id },
        ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
      ],
    };
  }

  return {
    ...academicYearFilter,
    status: { in: ["IN_PROGRESS", "COMPLETED"] },
  };
}

function getPurchaseScopeWhere(
  user: DashboardUser | undefined,
  activeYearId: string | null,
): Prisma.PurchaseRequestWhereInput {
  const academicYearFilter = activeYearId
    ? { project: { academicYearId: activeYearId } }
    : {};
  if (!user) return { ...academicYearFilter, id: "__no_access__" };

  if (
    user.role === "SUPER_ADMIN" ||
    user.role === "EXECUTIVE" ||
    user.role === "FINANCE" ||
    user.role === "PROCUREMENT"
  ) {
    return academicYearFilter;
  }

  if (user.role === "DEPT_HEAD" || user.role === "TEACHER") {
    return {
      ...academicYearFilter,
      OR: [
        { createdById: user.id },
        { project: { responsibleUserId: user.id } },
        ...(user.departmentId
          ? [{ project: { departmentId: user.departmentId } }]
          : []),
      ],
    };
  }

  return {
    ...academicYearFilter,
    project: {
      ...(activeYearId ? { academicYearId: activeYearId } : {}),
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    },
  };
}

function mergeWhere(
  base: Prisma.PurchaseRequestWhereInput,
  extra: Prisma.PurchaseRequestWhereInput,
): Prisma.PurchaseRequestWhereInput {
  return { AND: [base, extra] };
}

function getRelativeTimeString(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "เมื่อครู่นี้";
  if (diffMins < 60) return `เมื่อ ${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `เมื่อ ${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays === 1) return "เมื่อวานนี้";
  if (diffDays < 7) return `เมื่อ ${diffDays} วันที่แล้ว`;

  return formatThaiDate(date);
}

async function getDashboardData(user: DashboardUser | undefined): Promise<DashboardData> {
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
    select: { id: true, yearName: true },
  });
  const activeYearId = activeYear?.id ?? null;
  const projectWhere = getProjectScopeWhere(user, activeYearId);
  const purchaseWhere = getPurchaseScopeWhere(user, activeYearId);

  const [
    projectGroups,
    purchaseRequestCount,
    budget,
    tasks,
    approvalItems,
    purchaseItems,
    auditItems,
  ] = await Promise.all([
    prisma.project.groupBy({
      by: ["status"],
      where: projectWhere,
      _count: { _all: true },
    }),
    prisma.purchaseRequest.count({ where: purchaseWhere }),
    getBudgetOverview(user, activeYearId),
    getRoleTasks(user, activeYearId),
    getApprovalItems(user, activeYearId),
    getRecentPurchaseItems(user, activeYearId),
    getRecentAuditItems(),
  ]);

  const statusMap = new Map<ProjectStatus, number>(
    projectGroups.map((group) => [group.status, group._count._all]),
  );
  const statusRows = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    value: statusMap.get(status) ?? 0,
  }));
  const total = statusRows.reduce((sum, row) => sum + row.value, 0);

  return {
    activeYear,
    todayText: `วันนี้ ${thaiDateLong.format(new Date())}`,
    projectSummary: {
      total,
      draft: statusMap.get("DRAFT") ?? 0,
      pending: PENDING_PROJECT_STATUSES.reduce(
        (sum, status) => sum + (statusMap.get(status) ?? 0),
        0,
      ),
      approved: APPROVED_PROJECT_STATUSES.reduce(
        (sum, status) => sum + (statusMap.get(status) ?? 0),
        0,
      ),
      purchaseRequests: purchaseRequestCount,
    },
    statusRows,
    budget,
    tasks,
    approvalItems,
    purchaseItems,
    auditItems,
    quickActions: getQuickActions(user?.role),
  };
}

async function getBudgetOverview(
  user: DashboardUser | undefined,
  activeYearId: string | null,
): Promise<BudgetOverview> {
  try {
    const lockedPlan = await prisma.budgetPlan.findFirst({
      where: {
        status: "LOCKED",
        ...(activeYearId ? { academicYearId: activeYearId } : {}),
      },
      orderBy: { lockedAt: "desc" },
      select: {
        id: true,
        name: true,
        wallets: {
          select: {
            departmentId: true,
            ledgerEntries: {
              select: { entryType: true, amount: true },
            },
          },
        },
      },
    });

    if (!lockedPlan) {
      return {
        hasLockedPlan: false,
        planName: null,
        allocated: 0,
        committed: 0,
        spent: 0,
        available: 0,
        accountingBalance: 0,
        walletCount: 0,
      };
    }

    const actor = user ? toActor(user) : null;
    const visibleWallets = actor
      ? lockedPlan.wallets.filter((wallet) => canViewBudgetWallet(actor, wallet))
      : [];
    const balances = visibleWallets.map((wallet) =>
      calculateWalletBalance(wallet.ledgerEntries),
    );

    return {
      hasLockedPlan: true,
      planName: lockedPlan.name,
      allocated: balances.reduce((sum, item) => sum + item.allocated, 0),
      committed: balances.reduce((sum, item) => sum + item.committed, 0),
      spent: balances.reduce((sum, item) => sum + item.netDisbursed, 0),
      available: balances.reduce((sum, item) => sum + item.availableBalance, 0),
      accountingBalance: balances.reduce(
        (sum, item) => sum + item.accountingBalance,
        0,
      ),
      walletCount: visibleWallets.length,
    };
  } catch (error) {
    console.error("Failed to fetch budget plan data gracefully:", error);
    return {
      hasLockedPlan: false,
      planName: null,
      allocated: 0,
      committed: 0,
      spent: 0,
      available: 0,
      accountingBalance: 0,
      walletCount: 0,
      error: true,
    };
  }
}

async function getRoleTasks(
  user: DashboardUser | undefined,
  activeYearId: string | null,
): Promise<DashboardTask[]> {
  if (!user) return [];
  const academicYearFilter = activeYearId ? { academicYearId: activeYearId } : {};

  if (user.role === "TEACHER") {
    const [projects, approvedWithoutPurchase, rejectedPurchases] =
      await Promise.all([
        prisma.project.findMany({
          where: {
            ...academicYearFilter,
            responsibleUserId: user.id,
            status: { in: ["DRAFT", "REJECTED"] },
          },
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            status: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
        }),
        prisma.project.findMany({
          where: {
            ...academicYearFilter,
            responsibleUserId: user.id,
            status: "APPROVED",
            purchaseRequests: { none: {} },
          },
          select: { id: true, projectCode: true, projectName: true },
          orderBy: { updatedAt: "desc" },
          take: 3,
        }),
        prisma.purchaseRequest.findMany({
          where: {
            createdById: user.id,
            status: "REJECTED",
            ...(activeYearId
              ? { project: { academicYearId: activeYearId } }
              : {}),
          },
          select: { id: true, subject: true, project: { select: { projectCode: true } } },
          orderBy: { updatedAt: "desc" },
          take: 3,
        }),
      ]);

    return [
      ...projects.map((project) => ({
        id: `project-${project.id}`,
        title: project.projectName,
        description:
          project.status === "DRAFT"
            ? `${project.projectCode} ยังเป็นร่างโครงงานที่ค้างอยู่`
            : `${project.projectCode} ถูกตีกลับโดยผู้อนุมัติ โปรดตรวจสอบเพื่อดำเนินการแก้ไข`,
        badge: project.status === "DRAFT" ? "ร่างโครงการ" : "โครงการถูกตีกลับ",
        href: `/projects/${project.id}/edit`,
        actionLabel: "แก้ไขโครงการ",
        tone: project.status === "DRAFT" ? ("slate" as const) : ("red" as const),
      })),
      ...approvedWithoutPurchase.map((project) => ({
        id: `purchase-${project.id}`,
        title: project.projectName,
        description: `${project.projectCode} ได้รับอนุมัติโครงการแล้ว สามารถสร้างคำขอจัดซื้อจัดจ้างเพื่อดำเนินงานต่อ`,
        badge: "พร้อมดำเนินงานจัดซื้อ",
        href: "/procurement/new",
        actionLabel: "สร้างคำขอจัดซื้อ",
        tone: "green" as const,
      })),
      ...rejectedPurchases.map((request) => ({
        id: `rejected-request-${request.id}`,
        title: request.subject,
        description: `${request.project.projectCode} เอกสารคำขอจัดซื้อ/จัดจ้างนี้ถูกตีกลับ โปรดแก้ไขข้อมูล`,
        badge: "คำขอจัดซื้อถูกตีกลับ",
        href: `/procurement/${request.id}`,
        actionLabel: "ดูรายละเอียดคำขอ",
        tone: "red" as const,
      })),
    ].slice(0, 6) satisfies DashboardTask[];
  }

  if (user.role === "DEPT_HEAD") {
    const departmentId = user.departmentId ?? "__no_department__";
    const [projects, purchases] = await Promise.all([
      prisma.project.findMany({
        where: {
          ...academicYearFilter,
          departmentId,
          status: "SUBMITTED",
        },
        select: { id: true, projectCode: true, projectName: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.purchaseRequest.findMany({
        where: {
          status: "PENDING",
          project: {
            ...academicYearFilter,
            departmentId,
          },
        },
        select: { id: true, subject: true, project: { select: { projectCode: true } } },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
    ]);

    return [
      ...projects.map((project) => ({
        id: `project-${project.id}`,
        title: project.projectName,
        description: `${project.projectCode} รอหัวหน้ากลุ่มงานดำเนินการตรวจสอบรายละเอียดโครงการ`,
        badge: "รอตรวจสอบโครงการ",
        href: `/projects/${project.id}`,
        actionLabel: "ตรวจสอบโครงการ",
        tone: "gold" as const,
      })),
      ...purchases.map((request) => ({
        id: `purchase-${request.id}`,
        title: request.subject,
        description: `${request.project.projectCode} รอหัวหน้ากลุ่มงานลงความเห็นและตรวจสอบความถูกต้องตามแผนปฏิบัติการ`,
        badge: "รอตรวจแผนจัดซื้อ",
        href: `/procurement/${request.id}`,
        actionLabel: "ตรวจแผนจัดซื้อ",
        tone: "blue" as const,
      })),
    ].slice(0, 6) satisfies DashboardTask[];
  }

  if (user.role === "EXECUTIVE") {
    const [projects, plans, purchases] = await Promise.all([
      prisma.project.findMany({
        where: { ...academicYearFilter, status: "REVIEWED" },
        select: { id: true, projectCode: true, projectName: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.budgetPlan.findMany({
        where: {
          status: "SUBMITTED",
          ...(activeYearId ? { academicYearId: activeYearId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 2,
      }),
      prisma.purchaseRequest.findMany({
        where: mergeWhere(getPurchaseScopeWhere(user, activeYearId), {
          status: "BUDGET_REVIEWED",
        }),
        select: { id: true, subject: true, project: { select: { projectCode: true } } },
        orderBy: { updatedAt: "desc" },
        take: 2,
      }),
    ]);

    return [
      ...projects.map((project) => ({
        id: `project-${project.id}`,
        title: project.projectName,
        description: `${project.projectCode} ผ่านการทบทวนแล้ว รอผู้อำนวยการอนุมัติโครงการ`,
        badge: "รออนุมัติโครงการ",
        href: `/projects/${project.id}`,
        actionLabel: "อนุมัติโครงการ",
        tone: "blue" as const,
      })),
      ...plans.map((plan) => ({
        id: `plan-${plan.id}`,
        title: plan.name,
        description: "แผนจัดสรรงบประมาณประจำปีของโรงเรียนรอการอนุมัติจากผู้บริหาร",
        badge: "รออนุมัติแผนงบ",
        href: "/budget-allocation",
        actionLabel: "ตรวจแผนงบประมาณ",
        tone: "purple" as const,
      })),
      ...purchases.map((request) => ({
        id: `purchase-${request.id}`,
        title: request.subject,
        description: `${request.project.projectCode} รอผู้อำนวยการลงนามอนุมัติคำขอจัดซื้อ/จัดจ้าง`,
        badge: "รออนุมัติจัดซื้อ",
        href: `/procurement/${request.id}`,
        actionLabel: "อนุมัติคำขอจัดซื้อ",
        tone: "gold" as const,
      })),
    ].slice(0, 6);
  }

  if (user.role === "FINANCE") {
    const [plans, purchases, lowWallets] = await Promise.all([
      prisma.budgetPlan.findMany({
        where: {
          status: { in: ["DRAFT", "REJECTED"] },
          ...(activeYearId ? { academicYearId: activeYearId } : {}),
        },
        select: { id: true, name: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.purchaseRequest.findMany({
        where: mergeWhere(getPurchaseScopeWhere(user, activeYearId), {
          status: "PLAN_REVIEWED",
        }),
        select: { id: true, subject: true, project: { select: { projectCode: true } } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      getLowWalletTasks(user, activeYearId),
    ]);

    return [
      ...plans.map((plan) => ({
        id: `plan-${plan.id}`,
        title: plan.name,
        description:
          plan.status === "DRAFT"
            ? "แผนงบประมาณอยู่ในขั้นตอนการจัดสรรหรือยังไม่สมบูรณ์"
            : "แผนจัดสรรงบประมาณประจำปีถูกตีกลับ โปรดแก้ไขข้อมูลตามความเห็นเพิ่มเติม",
        badge: plan.status === "DRAFT" ? "ร่างแผนงบประมาณ" : "แผนงบถูกตีกลับ",
        href: "/budget-allocation",
        actionLabel: "จัดสรรงบประจำปี",
        tone: plan.status === "DRAFT" ? ("slate" as const) : ("red" as const),
      })),
      ...purchases.map((request) => ({
        id: `purchase-${request.id}`,
        title: request.subject,
        description: `${request.project.projectCode} รอเจ้าหน้าที่การเงินตรวจสอบสิทธิ์และยอดวงเงินงบประมาณคงเหลือ`,
        badge: "รอการเงินตรวจสอบ",
        href: `/procurement/${request.id}`,
        actionLabel: "ตรวจสอบคำขอ",
        tone: "blue" as const,
      })),
      ...lowWallets,
    ].slice(0, 6);
  }

  if (user.role === "PROCUREMENT") {
    const rows = await prisma.purchaseRequest.findMany({
      where: mergeWhere(getPurchaseScopeWhere(user, activeYearId), {
        status: { in: ["FINANCE_REVIEWED", "PROCUREMENT_REVIEWED"] },
      }),
      select: {
        id: true,
        subject: true,
        status: true,
        project: { select: { projectCode: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    });

    return rows.map((request) => ({
      id: request.id,
      title: request.subject,
      description: `${request.project.projectCode} ${
        request.status === "FINANCE_REVIEWED"
          ? "รอเจ้าหน้าที่พัสดุตรวจสอบเอกสารและข้อกำหนดเสนอจัดซื้อ"
          : "ผ่านการอนุมัติแล้ว รอเจ้าหน้าที่พัสดุบันทึกทะเบียนตัดยอดพัสดุโรงเรียน"
      }`,
      badge:
        request.status === "FINANCE_REVIEWED" ? "รอพัสดุตรวจสอบ" : "รอบันทึกตัดยอด",
      href: `/procurement/${request.id}`,
      actionLabel: "ดำเนินการเอกสาร",
      tone: "purple" as const,
    }));
  }

  if (user.role === "SUPER_ADMIN") {
    const [users, years, latestProjects] = await Promise.all([
      prisma.user.count(),
      prisma.academicYear.count(),
      prisma.project.findMany({
        where: academicYearFilter,
        select: { id: true, projectCode: true, projectName: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
    ]);

    return [
      {
        id: "users",
        title: "จัดการบัญชีผู้ใช้ระบบ",
        description: `ปัจจุบันมีผู้ใช้งานในระบบทั้งหมด ${users} บัญชี ควรตรวจเช็กสถานะการใช้งานอย่างต่อเนื่อง`,
        badge: "บัญชีผู้ใช้ระบบ",
        href: "/users",
        actionLabel: "จัดการผู้ใช้งาน",
        tone: "purple" as const,
      },
      {
        id: "years",
        title: "ตั้งค่าปีการศึกษาเริ่มต้น",
        description: `มีข้อมูลปีการศึกษาทั้งหมด ${years} รายการ ควรเปิดใช้งานปีปัจจุบันให้ถูกต้องตามรอบจริง`,
        badge: "ข้อมูลตั้งต้นโรงเรียน",
        href: "/academic-years",
        actionLabel: "ตั้งค่าปีการศึกษา",
        tone: "blue" as const,
      },
      ...latestProjects.map((project) => ({
        id: project.id,
        title: project.projectName,
        description: `${project.projectCode} ได้รับการสร้างหรืออัปเดตข้อมูลล่าสุดในฐานข้อมูลระบบ`,
        badge: "ความเคลื่อนไหวโครงการ",
        href: `/projects/${project.id}`,
        actionLabel: "ดูรายละเอียดโครงการ",
        tone: "slate" as const,
      })),
    ].slice(0, 6);
  }

  return [];
}

async function getLowWalletTasks(
  user: DashboardUser,
  activeYearId: string | null,
): Promise<DashboardTask[]> {
  const plan = await prisma.budgetPlan.findFirst({
    where: {
      status: "LOCKED",
      ...(activeYearId ? { academicYearId: activeYearId } : {}),
    },
    orderBy: { lockedAt: "desc" },
    select: {
      wallets: {
        select: {
          id: true,
          name: true,
          warningPercent: true,
          departmentId: true,
          ledgerEntries: { select: { entryType: true, amount: true } },
        },
      },
    },
  });
  if (!plan) return [];

  const actor = toActor(user);
  return plan.wallets
    .filter((wallet) => canViewBudgetWallet(actor, wallet))
    .map((wallet) => {
      const balance = calculateWalletBalance(wallet.ledgerEntries);
      const percent =
        balance.allocated > 0
          ? (balance.availableBalance / balance.allocated) * 100
          : 100;
      return {
        wallet,
        balance,
        percent,
      };
    })
    .filter(
      (row) =>
        row.balance.allocated > 0 &&
        row.percent <= Number(row.wallet.warningPercent ?? LOW_WALLET_PERCENT),
    )
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 3)
    .map((row) => ({
      id: `wallet-${row.wallet.id}`,
      title: row.wallet.name,
      description: `งบประมาณคงเหลือพร้อมใช้งานใกล้หมด: ${formatBaht(
        row.balance.availableBalance,
      )} (${row.percent.toFixed(0)}%)`,
      badge: "งบประมาณคงเหลือต่ำ",
      href: "/budget",
      actionLabel: "ดูรายละเอียดงบ",
      tone: "red",
    }));
}

async function getApprovalItems(
  user: DashboardUser | undefined,
  activeYearId: string | null,
): Promise<DashboardListItem[]> {
  if (!user) return [];
  const baseWhere = getProjectScopeWhere(user, activeYearId);
  const statusWhere =
    user.role === "TEACHER"
      ? {}
      : user.role === "DEPT_HEAD"
      ? { status: "SUBMITTED" as const }
      : user.role === "EXECUTIVE" || user.role === "SUPER_ADMIN"
      ? { status: { in: ["SUBMITTED", "REVIEWED"] as ProjectStatus[] } }
      : { status: { in: PENDING_PROJECT_STATUSES } };

  const rows = await prisma.project.findMany({
    where: { AND: [baseWhere, statusWhere] },
    select: {
      id: true,
      projectCode: true,
      projectName: true,
      budgetRequested: true,
      status: true,
      updatedAt: true,
      responsibleUser: { select: { fullName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return rows
    .filter((project) =>
      user.role === "TEACHER" ? canReadProject(toActor(user), project) : true,
    )
    .map((project) => ({
      id: project.id,
      title: project.projectName,
      subtitle: `${project.projectCode} · ${
        project.responsibleUser?.fullName ?? "ไม่ระบุผู้รับผิดชอบ"
      }`,
      amount: Number(project.budgetRequested),
      status: STATUS_LABELS[project.status],
      href: `/projects/${project.id}`,
      date: project.updatedAt.toISOString(),
    }));
}

async function getRecentPurchaseItems(
  user: DashboardUser | undefined,
  activeYearId: string | null,
): Promise<DashboardListItem[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: getPurchaseScopeWhere(user, activeYearId),
    select: {
      id: true,
      subject: true,
      requestedAmount: true,
      status: true,
      updatedAt: true,
      project: { select: { projectCode: true, projectName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return rows.map((request) => ({
    id: request.id,
    title: request.subject,
    subtitle: `${request.project.projectCode} · ${request.project.projectName}`,
    amount: Number(request.requestedAmount),
    status: PURCHASE_STATUS_LABELS[request.status],
    href: `/procurement/${request.id}`,
    date: request.updatedAt.toISOString(),
  }));
}

async function getRecentAuditItems() {
  const rows = await prisma.auditLog.findMany({
    select: {
      id: true,
      action: true,
      entityName: true,
      createdAt: true,
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return rows.map((row) => ({
    id: row.id,
    actor: row.user?.fullName ?? "ระบบส่วนกลาง",
    action: translateAuditAction(row.action),
    entity: translateEntity(row.entityName),
    date: row.createdAt.toISOString(),
  }));
}

function getQuickActions(role: Role | undefined): QuickAction[] {
  switch (role) {
    case "TEACHER":
      return [
        { label: "สร้างโครงการใหม่", href: "/projects/new", icon: FilePlus2, primary: true },
        { label: "ดูโครงการของฉัน", href: "/projects", icon: FolderKanban },
        { label: "สร้างคำขอจัดซื้อ", href: "/procurement/new", icon: ShoppingCart },
      ];
    case "DEPT_HEAD":
      return [
        { label: "ตรวจงานอนุมัติ", href: "/approvals", icon: ClipboardCheck, primary: true },
        { label: "ดูโครงการในกลุ่มงาน", href: "/projects", icon: FolderKanban },
      ];
    case "EXECUTIVE":
      return [
        { label: "งานอนุมัติ", href: "/approvals", icon: ClipboardCheck, primary: true },
        { label: "ดูงบประมาณ", href: "/budget", icon: Wallet },
        { label: "ดูโครงการทั้งหมด", href: "/projects", icon: FolderKanban },
      ];
    case "FINANCE":
      return [
        { label: "จัดสรรงบประจำปี", href: "/budget-allocation", icon: Banknote, primary: true },
        { label: "ดูงบประมาณ", href: "/budget", icon: Wallet },
        { label: "ดูคำขอจัดซื้อ", href: "/procurement", icon: ShoppingCart },
      ];
    case "PROCUREMENT":
      return [
        { label: "พัสดุ/จัดซื้อ", href: "/procurement", icon: ShoppingCart, primary: true },
        { label: "สร้างคำขอจัดซื้อ", href: "/procurement/new", icon: PlusCircle },
      ];
    case "SUPER_ADMIN":
      return [
        { label: "ผู้ใช้งาน", href: "/users", icon: Users, primary: true },
        { label: "ปีการศึกษา", href: "/academic-years", icon: CalendarDays },
        { label: "จัดสรรงบประจำปี", href: "/budget-allocation", icon: Banknote },
      ];
    case "COMMITTEE":
      return [
        { label: "ดูโครงการทั้งหมด", href: "/projects", icon: FolderKanban, primary: true },
        { label: "ดูงบประมาณ", href: "/budget", icon: Wallet },
      ];
    default:
      return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as DashboardUser | undefined;
  const data = await getDashboardData(user);

  const roleName = roleNames[user?.role ?? "COMMITTEE"];
  const welcomeName = user?.fullName?.trim()
    ? user.role === "TEACHER"
      ? user.fullName.startsWith("ครู")
        ? user.fullName
        : `ครู${user.fullName}`
      : user.fullName
    : roleName;

  const welcome = getWelcomeContent(user, data.tasks.length);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* 1. Header Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-700 to-indigo-800 bg-clip-text text-transparent">
              แดชบอร์ด
            </span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-medium font-body-md">
            ภาพรวมแผนปฏิบัติการ โครงการ งบประมาณ และงานที่ต้องดำเนินการ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data.activeYear ? (
            <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-2 text-xs sm:text-sm font-extrabold text-violet-700">
              <CalendarDays className="h-4 w-4 text-violet-600" />
              ปีการศึกษา {data.activeYear.yearName}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs sm:text-sm font-bold text-amber-700">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              ไม่มีปีการศึกษาที่เปิดใช้งาน กรุณาตั้งค่าปีการศึกษา
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-slate-700 shadow-sm">
            <Clock3 className="h-4 w-4 text-slate-500" />
            {data.todayText}
          </div>
        </div>
      </section>

      {/* 2. Welcome / Next Action Card */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-purple-800 to-violet-900 text-white p-6 sm:p-8 shadow-xl shadow-indigo-950/10 transition-all duration-300 hover:shadow-2xl">
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 space-y-3.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950 uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              {roleName}
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black">
              สวัสดี {welcomeName}
            </h2>
            <p className="text-indigo-100 font-medium text-xs sm:text-sm md:text-base max-w-2xl leading-relaxed opacity-90">
              {welcome.description}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {welcome.actions.map((action, index) => (
                <Button
                  key={action.href}
                  asChild
                  className={cn(
                    "rounded-xl font-bold transition-all duration-300 active:scale-95 text-xs sm:text-sm h-11 px-5",
                    index === 0
                      ? "bg-amber-400 hover:bg-amber-500 text-amber-950 hover:scale-[1.03]"
                      : "bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                  )}
                >
                  <Link href={action.href}>
                    {index === 0 ? <PlusCircle className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
          <div className="hidden lg:block shrink-0 w-36 h-36 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10">
            <span className="material-symbols-outlined text-[64px] text-amber-400 animate-pulse">
              rocket_launch
            </span>
          </div>
        </div>
      </section>

      {/* 3. Summary Cards (6 Grid) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard
          label="โครงการทั้งหมด"
          value={data.projectSummary.total}
          helper="รวมโครงการตามสิทธิ์ในปีการศึกษานี้"
          icon={FolderKanban}
          tone="blue"
        />
        <SummaryCard
          label="ร่างโครงการ"
          value={data.projectSummary.draft}
          helper="โครงการที่ยังไม่ส่งขออนุมัติ"
          icon={FileEdit}
          tone="slate"
        />
        <SummaryCard
          label="รออนุมัติ"
          value={data.projectSummary.pending}
          helper="โครงการที่ยื่นส่งขออนุมัติ"
          icon={Clock3}
          tone="gold"
        />
        <SummaryCard
          label="อนุมัติแล้ว"
          value={data.projectSummary.approved}
          helper="โครงการที่ผ่านการอนุมัติแล้ว"
          icon={BadgeCheck}
          tone="green"
        />
        <SummaryCard
          label="คำขอจัดซื้อ"
          value={data.projectSummary.purchaseRequests}
          helper="คำขอจัดซื้อ/จัดจ้างที่เกี่ยวข้อง"
          icon={ShoppingCart}
          tone="purple"
        />
        <SummaryCard
          label="งานของฉัน"
          value={data.tasks.length}
          helper="รายการงานที่คุณต้องดำเนินการต่อ"
          icon={ListChecks}
          tone="gold"
          highlighted={data.tasks.length > 0}
        />
      </section>

      {/* 4. My Tasks & 5. Budget Overview Section */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <TaskList tasks={data.tasks} role={user?.role} />
        <BudgetOverviewCard budget={data.budget} />
      </div>

      {/* 6. Project Status & 7. Pending Approvals */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectStatusCard rows={data.statusRows} total={data.projectSummary.total} />
        <PendingApprovalsCard
          title={user?.role === "TEACHER" ? "สถานะโครงการของฉัน" : "รายการรออนุมัติ"}
          rows={data.approvalItems}
        />
      </div>

      {/* 8. Recent Purchases & 9. Recent Activity */}
      <div className="grid gap-6 xl:grid-cols-2">
        <RecentPurchasesCard rows={data.purchaseItems} />
        <RecentActivityCard rows={data.auditItems} />
      </div>

      {/* 10. Quick Actions */}
      <QuickActionsCard actions={data.quickActions} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  highlighted = false,
}: {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  tone: "blue" | "slate" | "gold" | "green" | "purple";
  highlighted?: boolean;
}) {
  const toneClass = {
    blue: "border-l-indigo-600 bg-white hover:border-indigo-400 text-indigo-700",
    slate: "border-l-slate-400 bg-white hover:border-slate-300 text-slate-600",
    gold: "border-l-amber-500 bg-white hover:border-amber-400 text-amber-700",
    green: "border-l-emerald-500 bg-white hover:border-emerald-400 text-emerald-700",
    purple: "border-l-violet-600 bg-white hover:border-violet-400 text-violet-700",
  }[tone];

  const iconContainerClass = {
    blue: "bg-indigo-50 text-indigo-700",
    slate: "bg-slate-50 text-slate-600",
    gold: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
  }[tone];

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/60 border-l-4 shadow-sm transition-all duration-305 hover:-translate-y-1 hover:shadow-md",
        highlighted
          ? "ring-2 ring-amber-400 ring-offset-2 bg-gradient-to-br from-amber-50/20 to-orange-50/20 border-l-amber-500"
          : toneClass
      )}
    >
      <CardContent className="flex min-h-[136px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          <div className={cn("rounded-xl p-2 transition-transform duration-300", iconContainerClass)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800">
            {value}
          </p>
          <p className="mt-1 text-[10px] sm:text-[11px] font-medium text-slate-400 leading-normal">
            {helper}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskList({ tasks, role }: { tasks: DashboardTask[]; role?: Role }) {
  const readOnly = role === "COMMITTEE";
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-amber-50/30 to-orange-50/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
          <div className="rounded-lg bg-amber-100 p-1.5 text-amber-800 flex items-center justify-center">
            <ListChecks className="h-5 w-5" />
          </div>
          งานที่ต้องทำของฉัน
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {readOnly ? (
          <EmptyState
            icon={ShieldCheck}
            title="ไม่มีงานที่ต้องดำเนินการ"
            description="บัญชีนี้เป็นโหมดอ่านอย่างเดียวสำหรับติดตามภาพรวมโครงการและงบประมาณโรงเรียน"
            tone="slate"
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="ไม่มีงานที่ต้องดำเนินการ"
            description="ขณะนี้ไม่มีรายการที่รอการดำเนินการจากคุณ ขอให้เป็นวันที่ดี!"
            tone="green"
          />
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskItem({ task }: { task: DashboardTask }) {
  return (
    <div className="group grid gap-4 rounded-xl border border-slate-100 bg-slate-50/30 p-4 transition-all duration-300 hover:border-violet-200 hover:bg-violet-50/10 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="mb-2">
          <ToneBadge tone={task.tone}>{task.badge}</ToneBadge>
        </div>
        <h3 className="line-clamp-2 font-bold text-slate-800 group-hover:text-violet-855 transition-colors text-sm sm:text-base leading-snug">
          {task.title}
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
          {task.description}
        </p>
      </div>
      <Button
        asChild
        variant="default"
        className="rounded-xl font-bold bg-violet-750 hover:bg-violet-850 text-white shadow-sm hover:shadow active:scale-95 transition-all text-xs sm:text-sm h-10 px-4"
      >
        <Link href={task.href}>
          {task.actionLabel}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Link>
      </Button>
    </div>
  );
}

function BudgetOverviewCard({ budget }: { budget: BudgetOverview }) {
  if (budget.error) {
    return (
      <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
            <div className="rounded-lg bg-red-100 p-1.5 text-red-800 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            ภาพรวมงบประมาณ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 flex flex-col items-center justify-center min-h-[220px]">
          <div className="rounded-full bg-red-100 p-3 text-red-800 mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="font-bold text-slate-800 text-center text-sm sm:text-base">
            ไม่สามารถโหลดข้อมูลบางส่วนได้
          </p>
          <p className="text-xs sm:text-sm text-slate-400 text-center mt-1">
            กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบโรงเรียน
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!budget.hasLockedPlan) {
    return (
      <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
            <div className="rounded-lg bg-slate-100 p-1.5 text-slate-700 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            ภาพรวมงบประมาณ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <EmptyState
            icon={Wallet}
            title="ยังไม่มีแผนงบประมาณที่พร้อมใช้งาน"
            description="กรุณาสร้างและอนุมัติแผนจัดสรรงบประมาณประจำปีก่อนดำเนินโครงการ"
            action={{ href: "/budget-allocation", label: "ไปที่จัดสรรงบประจำปี" }}
            tone="slate"
          />
        </CardContent>
      </Card>
    );
  }

  const committedPercent =
    budget.allocated > 0 ? (budget.committed / budget.allocated) * 100 : 0;
  const spentPercent =
    budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0;
  const availablePercent =
    budget.allocated > 0 ? (budget.available / budget.allocated) * 100 : 0;

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
          <div className="rounded-lg bg-violet-100 p-1.5 text-violet-800 flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
          ภาพรวมงบประมาณ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700 border border-violet-100">
            <TrendingUp className="h-3 w-3" />
            {budget.planName}
          </span>
          <p className="mt-2 text-[11px] font-medium text-slate-400 leading-relaxed font-body-md">
            คำนวณจากกระเป๋างบประมาณ {budget.walletCount} รายการที่คุณมีสิทธิ์ตรวจสอบข้อมูล
          </p>
        </div>

        <div className="grid gap-3 grid-cols-2">
          <BudgetMetric label="งบรวมทั้งหมด" value={budget.allocated} />
          <BudgetMetric
            label="คงเหลือพร้อมใช้"
            value={budget.available}
            tone="text-emerald-700 bg-emerald-50/20 border-emerald-100"
          />
          <BudgetMetric
            label="กันวงเงินแล้ว"
            value={budget.committed}
            tone="text-amber-800 bg-amber-50/20 border-amber-100"
          />
          <BudgetMetric
            label="ใช้จ่ายแล้ว"
            value={budget.spent}
            tone="text-red-700 bg-red-50/20 border-red-100"
          />
        </div>

        <div className="space-y-3.5 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
            <span className="text-slate-700">สถานะการใช้งบประมาณ</span>
            <span className="text-violet-700 font-mono">
              ใช้จ่ายแล้ว {((budget.spent / (budget.allocated || 1)) * 100).toFixed(0)}%
            </span>
          </div>
          <StackedBudgetBar
            committedPercent={committedPercent}
            spentPercent={spentPercent}
            availablePercent={availablePercent}
          />
          <div className="grid gap-3 text-[11px] text-slate-400 sm:grid-cols-3 pt-1">
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 rounded bg-red-550 shrink-0 mt-0.5"></span>
              <p>
                <span className="font-bold text-red-600">ใช้จ่ายแล้ว</span>
                <br />
                งบประมาณที่เบิกจ่ายจริง
              </p>
            </div>
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 rounded bg-yellow-500 shrink-0 mt-0.5"></span>
              <p>
                <span className="font-bold text-amber-700">กันวงเงินแล้ว</span>
                <br />
                งบที่ถูกจองไว้ให้โครงการ แต่ยังไม่เบิกจ่าย
              </p>
            </div>
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-550 shrink-0 mt-0.5"></span>
              <p>
                <span className="font-bold text-emerald-600">คงเหลือพร้อมใช้</span>
                <br />
                งบที่ยังนำไปจัดสรรหรือใช้ต่อได้
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetMetric({
  label,
  value,
  tone = "text-slate-800 bg-slate-50 border-slate-100",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3 sm:p-3.5 transition-all duration-300 hover:shadow-sm", tone)}>
      <p className="text-[10px] sm:text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-sm sm:text-base md:text-lg font-black tracking-tight">
        {formatBaht(value)}
      </p>
    </div>
  );
}

function StackedBudgetBar({
  committedPercent,
  spentPercent,
  availablePercent,
}: {
  committedPercent: number;
  spentPercent: number;
  availablePercent: number;
}) {
  const total = committedPercent + spentPercent + availablePercent || 1;
  return (
    <div className="h-4 overflow-hidden rounded-full bg-slate-100 border border-slate-200/50 p-0.5">
      <div className="flex h-full w-full rounded-full overflow-hidden">
        {spentPercent > 0 && (
          <div
            className="bg-red-500 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.05)] transition-all duration-500 animate-in slide-in-from-left-2"
            style={{ width: `${(spentPercent / total) * 100}%` }}
          />
        )}
        {committedPercent > 0 && (
          <div
            className="bg-yellow-500 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.05)] transition-all duration-500"
            style={{ width: `${(committedPercent / total) * 100}%` }}
          />
        )}
        {availablePercent > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${(availablePercent / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function ProjectStatusCard({
  rows,
  total,
}: {
  rows: ProjectStatusRow[];
  total: number;
}) {
  const visibleRows = rows.filter((row) => row.value > 0);
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
          <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-800 flex items-center justify-center">
            <PieChart className="h-5 w-5" />
          </div>
          สถานะโครงการ
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {visibleRows.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="ยังไม่มีโครงการ"
            description="เมื่อมีโครงการในระบบ แถบแสดงสัดส่วนสถานะการดำเนินงานของโครงการจะแสดงขึ้นที่นี่"
            tone="slate"
          />
        ) : (
          <div className="space-y-4">
            {visibleRows.map((row) => {
              const percent = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <div key={row.status} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-black", STATUS_TONES[row.status].badge)}>
                        {row.label}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-slate-400">
                      {row.value} รายการ · {percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", STATUS_TONES[row.status].bar)}
                      style={{ width: `${Math.max(percent, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <Button
              asChild
              variant="outline"
              className="mt-3 w-full rounded-xl font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 h-10 transition-colors"
            >
              <Link href="/projects">
                ดูโครงการทั้งหมด
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingApprovalsCard({
  title,
  rows,
}: {
  title: string;
  rows: DashboardListItem[];
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white flex flex-col justify-between">
      <div>
        <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
            <div className="rounded-lg bg-orange-100 p-1.5 text-orange-800 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="ไม่มีรายการรออนุมัติ"
              description="ขณะนี้ไม่มีรายละเอียดโครงการที่ค้างหน้าขออนุมัติเอกสารในระบบ"
              tone="slate"
            />
          ) : (
            <div className="space-y-3.5">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="group relative rounded-xl border border-slate-100 bg-slate-50/10 p-4 transition-all duration-300 hover:border-violet-200 hover:bg-violet-50/5 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] sm:text-xs font-bold text-violet-755 bg-violet-50 px-2 py-0.5 rounded border border-violet-100/50">
                          {row.subtitle.split(" · ")[0] /* Project Code */}
                        </span>
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
                          {row.status}
                        </span>
                      </div>
                      <h4 className="mt-2 font-bold text-slate-850 text-xs sm:text-sm md:text-base line-clamp-1 group-hover:text-violet-800 transition-colors">
                        {row.title}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                          {row.subtitle.split(" · ")[1] /* Responsible User */}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                          รอมานาน: {getRelativeTimeString(row.date)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100/80 pt-3 sm:mt-0 sm:border-0 sm:pt-0 sm:flex-col sm:items-end">
                      {row.amount != null && (
                        <p className="font-mono text-sm font-black text-violet-700 sm:text-right">
                          {formatBaht(row.amount)}
                        </p>
                      )}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-lg font-bold border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 text-xs h-8 px-3"
                      >
                        <Link href={row.href}>
                          ดูรายละเอียด
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>
      {rows.length > 0 && (
        <div className="px-5 pb-5">
          <Button
            asChild
            variant="outline"
            className="w-full rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 h-10 transition-colors"
          >
            <Link href="/approvals">ดูรายการอนุมัติทั้งหมด</Link>
          </Button>
        </div>
      )}
    </Card>
  );
}

function RecentPurchasesCard({ rows }: { rows: DashboardListItem[] }) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white flex flex-col justify-between">
      <div>
        <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
            <div className="rounded-lg bg-purple-100 p-1.5 text-purple-800 flex items-center justify-center">
              <ReceiptText className="h-5 w-5" />
            </div>
            คำขอจัดซื้อ/จัดจ้างล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {rows.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="ยังไม่มีคำขอจัดซื้อ"
              description="ประวัติการยื่นเอกสารใบเสนอความต้องการจัดซื้อจัดจ้างจะแสดงขึ้นที่นี่"
              tone="slate"
            />
          ) : (
            <div className="space-y-3.5">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="group relative rounded-xl border border-slate-100 bg-slate-50/10 p-4 transition-all duration-300 hover:border-violet-200 hover:bg-violet-50/5 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/50">
                          {row.subtitle.split(" · ")[0] /* Project Code */}
                        </span>
                        <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-800">
                          {row.status}
                        </span>
                      </div>
                      <h4 className="mt-2 font-bold text-slate-800 text-xs sm:text-sm md:text-base line-clamp-1 group-hover:text-violet-800 transition-colors">
                        {row.title}
                      </h4>
                      <p className="mt-1.5 font-medium text-slate-400 text-[11px] truncate font-body-md">
                        โครงการ: {row.subtitle.split(" · ")[1] /* Project Name */}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        วันที่ขอ: {formatThaiDate(row.date)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100/80 pt-3 sm:mt-0 sm:border-0 sm:pt-0 sm:flex-col sm:items-end">
                      {row.amount != null && (
                        <p className="font-mono text-sm font-black text-violet-700 sm:text-right">
                          {formatBaht(row.amount)}
                        </p>
                      )}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-lg font-bold border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 text-xs h-8 px-3"
                      >
                        <Link href={row.href}>
                          ดูรายละเอียด
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>
      {rows.length > 0 && (
        <div className="px-5 pb-5">
          <Button
            asChild
            variant="outline"
            className="w-full rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 h-10 transition-colors"
          >
            <Link href="/procurement">ดูคำขอจัดซื้อทั้งหมด</Link>
          </Button>
        </div>
      )}
    </Card>
  );
}

function RecentActivityCard({ rows }: { rows: DashboardData["auditItems"] }) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
          <div className="rounded-lg bg-pink-100 p-1.5 text-pink-800 flex items-center justify-center">
            <History className="h-5 w-5" />
          </div>
          ความเคลื่อนไหวล่าสุด
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {rows.length === 0 ? (
          <EmptyState
            icon={History}
            title="ยังไม่มีความเคลื่อนไหวล่าสุด"
            description="ประวัติการบันทึกแก้ไขและทำรายการในระบบจะแสดงขึ้นที่นี่"
            tone="slate"
          />
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {rows.map((row) => (
              <div key={row.id} className="relative flex gap-3 group">
                <div className="absolute -left-[20px] mt-1.5 h-2.5 w-2.5 rounded-full bg-violet-600 ring-4 ring-white transition-all duration-300 group-hover:scale-125" />
                <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/25 p-3 transition-colors duration-300 group-hover:bg-slate-50/70">
                  <p className="text-xs sm:text-sm font-bold text-slate-700 leading-normal">
                    <span className="text-violet-750 font-extrabold">{row.actor}</span>{" "}
                    {row.action}{" "}
                    <span className="text-slate-900 font-extrabold">{row.entity}</span>
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                    <Clock3 className="h-3 w-3" />
                    {getRelativeTimeString(row.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-200/50 bg-slate-50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-800">
          <div className="rounded-lg bg-teal-100 p-1.5 text-teal-800 flex items-center justify-center">
            <Gauge className="h-5 w-5" />
          </div>
          เมนูลัด
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3.5 p-5 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <DashboardButton key={action.href} action={action} primary={action.primary} />
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardButton({
  action,
  primary = false,
}: {
  action: QuickAction;
  primary?: boolean;
}) {
  const Icon = action.icon;
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={cn(
        "h-12 justify-between rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 text-xs sm:text-sm px-4",
        primary
          ? "bg-violet-700 hover:bg-violet-800 text-white shadow-sm hover:shadow"
          : "border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800"
      )}
    >
      <Link href={action.href}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          {action.label}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </Button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "slate",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
  tone?: "slate" | "green" | "gold";
}) {
  const colorClass = {
    slate: "bg-slate-50 text-slate-400 border-slate-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    gold: "bg-amber-50 text-amber-600 border-amber-100",
  }[tone];

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/10 px-4 py-8 text-center flex flex-col items-center justify-center">
      <div className={cn("mx-auto flex h-12 w-12 items-center justify-center rounded-full shadow-sm mb-3", colorClass)}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-bold text-slate-800 text-sm sm:text-base">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
        {description}
      </p>
      {action && (
        <Button
          asChild
          variant="outline"
          className="mt-4 rounded-xl font-bold border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 h-9 text-xs sm:text-sm px-4"
        >
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

function ToneBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: DashboardTask["tone"];
}) {
  const cls = {
    gold: "border-amber-205 bg-amber-50 text-amber-900",
    blue: "border-blue-205 bg-blue-50 text-blue-800",
    green: "border-emerald-205 bg-emerald-50 text-emerald-850",
    red: "border-red-205 bg-red-50 text-red-850",
    purple: "border-violet-205 bg-violet-50 text-violet-850",
    slate: "border-slate-205 bg-slate-50 text-slate-700",
  }[tone];

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-extrabold", cls)}>
      {children}
    </span>
  );
}

function getWelcomeContent(
  user: DashboardUser | undefined,
  taskCount: number,
): { title: string; description: string; actions: QuickAction[] } {
  const name = user?.fullName?.trim() || roleNames[user?.role ?? "COMMITTEE"];
  const actions = getQuickActions(user?.role).slice(0, 2);

  switch (user?.role) {
    case "TEACHER":
      return {
        title: `สวัสดี ครู${name}`,
        description:
          "วันนี้คุณมีโครงการที่ต้องติดตาม และสามารถสร้างโครงการใหม่หรือคำขอจัดซื้อจากโครงการที่อนุมัติแล้วได้ เพื่อให้การดำเนินงานของแผนโรงเรียนเป็นไปตามเป้าหมาย",
        actions,
      };
    case "DEPT_HEAD":
      return {
        title: `สวัสดี หัวหน้ากลุ่มงาน`,
        description: `มีโครงการและเอกสารเสนอจัดซื้อรวม ${taskCount} รายการในกลุ่มงานของคุณที่รอการตรวจสอบข้อมูล เพื่ออนุมัติในขั้นถัดไป`,
        actions,
      };
    case "EXECUTIVE":
      return {
        title: `สวัสดี ผู้บริหาร`,
        description:
          "ภาพรวมโครงการ แผนงบประมาณประจำปี และคำขอจัดซื้อจัดจ้างที่รอผู้อำนวยการอนุมัติ เพื่อสนับสนุนการบริหารจัดการการศึกษาอย่างโปร่งใส",
        actions,
      };
    case "FINANCE":
      return {
        title: `สวัสดี เจ้าหน้าที่การเงิน`,
        description:
          "มีแผนงบประมาณประจำปีและใบเสนอจัดซื้อจัดจ้างที่รอตรวจพิกัดบัญชีและตรวจสอบวงเงินงบประมาณคงเหลือพร้อมเบิกจ่ายของโรงเรียน",
        actions,
      };
    case "PROCUREMENT":
      return {
        title: `สวัสดี เจ้าหน้าที่พัสดุ`,
        description:
          "โปรดตรวจสอบเอกสารคำเสนอขอจัดซื้อ/จัดจ้าง ดำเนินการออกเลขใบเสนอซื้อ และลงทะเบียนคุมเพื่อตัดยอดพัสดุตามงวดกิจกรรม",
        actions,
      };
    case "SUPER_ADMIN":
      return {
        title: `สวัสดี ผู้ดูแลระบบ`,
        description:
          "ตรวจสอบสถานะการทำงานของระบบประมวลผล สรุปข้อมูล และตั้งค่าสิทธิ์ผู้เข้าใช้งานระบบ รวมถึงนำเข้าปีการศึกษาสำหรับการเริ่มต้นรอบแผนงาน",
        actions,
      };
    case "COMMITTEE":
      return {
        title: `สวัสดี คณะกรรมการสถานศึกษา`,
        description:
          "สรุปข้อมูลโครงการและสถานะงบประมาณทั้งหมดในรูปแบบโหมดอ่านอย่างเดียว เพื่อติดตามความโปร่งใสและทิศทางการดำเนินงานของโรงเรียน",
        actions,
      };
    default:
      return {
        title: "สวัสดี",
        description: "กรุณาเข้าสู่ระบบเพื่อดูแดชบอร์ดตามบทบาทของคุณ",
        actions: [],
      };
  }
}

function translateAuditAction(action: string) {
  const map: Record<string, string> = {
    SUBMIT: "ส่งโครงการ",
    REVIEW_APPROVE: "ตรวจสอบผ่าน",
    APPROVE: "อนุมัติ",
    REJECT: "ตีกลับ",
    CREATE: "สร้างข้อมูล",
    UPDATE: "แก้ไขข้อมูล",
    DELETE: "ลบข้อมูล",
  };
  return map[action] ?? action;
}

function translateEntity(entity: string) {
  const map: Record<string, string> = {
    Project: "โครงการ",
    PurchaseRequest: "คำขอจัดซื้อ",
    BudgetPlan: "แผนงบประมาณ",
    BudgetWallet: "กระเป๋างบ",
  };
  return map[entity] ?? entity;
}

function toActor(user: DashboardUser): Actor {
  return {
    id: user.id,
    role: user.role,
    departmentId: user.departmentId,
  };
}
