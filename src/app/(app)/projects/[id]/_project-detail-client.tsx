"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovalStatus, ProjectStatus, PurchaseRequestStatus, Role } from "@prisma/client";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  History,
  Home,
  Landmark,
  LayoutList,
  Loader2,
  PackagePlus,
  Printer,
  ReceiptText,
  RotateCcw,
  Send,
  ShieldCheck,
  Target,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusAlert } from "@/components/ui/status-alert";
import { ROLE_LABELS } from "@/lib/rbac";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import type { BudgetTransactionKind } from "@/lib/budget-summary";

type ProjectTabKey =
  | "overview"
  | "activities"
  | "approvals"
  | "budget"
  | "procurement";

type WorkflowAction = "submit" | "review_approve" | "approve" | "reject";

export type ProjectDetailData = {
  currentUser: {
    id: string;
    role: Role;
    departmentId: string | null;
  };
  permissions: {
    canEdit: boolean;
    canSubmit: boolean;
    canReview: boolean;
    canApprove: boolean;
    canReject: boolean;
    canViewBudgetHistory: boolean;
    canCreatePurchaseRequest: boolean;
  };
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    status: string;
    academicYearName: string;
    departmentName: string;
    responsibleFullName: string;
    strategyLabel: string;
    fundSourceName: string;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    updatedAt: string;
    rationale: string | null;
    objectives: string | null;
    quantitativeTarget: string | null;
    qualitativeTarget: string | null;
    indicators: string | null;
    method: string | null;
    expectedOutcome: string | null;
    budgetRequested: number;
    budgetApproved: number;
    budgetNetSpent: number;
    budgetRemaining: number;
    budgetExpenseCount: number;
    budgetHistoryCount: number;
    budgetPercentUsed: number;
    budgetActive: boolean;
  };
  activities: Array<{
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    fundSourceName: string;
    budgetRequested: number;
    budgetApproved: number;
    netSpent: number;
    remaining: number;
    percentUsed: number;
  }>;
  approvals: Array<{
    id: string;
    stepOrder: number;
    status: ApprovalStatus;
    comment: string | null;
    approvedAt: string | null;
    approverName: string;
    approverRole: Role;
  }>;
  budgetHistory: {
    budgetType: BudgetTransactionKind | null;
    allowedTypes: BudgetTransactionKind[];
    page: number;
    totalPages: number;
    totalCount: number;
    rows: Array<{
      id: string;
      transactionType: BudgetTransactionKind;
      transactionDate: string;
      description: string | null;
      amount: number;
      balanceAfter: number;
      actorName: string;
    }>;
  };
  purchaseRequests: Array<{
    id: string;
    documentNo: string | null;
    documentDate: string;
    subject: string;
    requestedAmount: number;
    status: PurchaseRequestStatus;
    createdByName: string;
    activityName: string | null;
    itemCount: number;
    updatedAt: string;
  }>;
};

const tabItems: Array<{ id: ProjectTabKey; label: string; icon: ReactNode }> = [
  { id: "overview", label: "ข้อมูลโครงการ", icon: <FileText className="size-4" /> },
  { id: "activities", label: "กิจกรรมและงบประมาณ", icon: <FolderOpen className="size-4" /> },
  { id: "approvals", label: "ประวัติการอนุมัติ", icon: <ClipboardCheck className="size-4" /> },
  { id: "budget", label: "ประวัติใช้งบ", icon: <ReceiptText className="size-4" /> },
  { id: "procurement", label: "คำขอจัดซื้อ", icon: <PackagePlus className="size-4" /> },
];

const statusLabels: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "รอหัวหน้ากลุ่มตรวจ",
  REVIEWED: "รอผู้บริหารอนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ตีกลับ",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const statusStyles: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-amber-200 bg-amber-100 text-amber-800",
  REVIEWED: "border-blue-200 bg-blue-100 text-blue-800",
  APPROVED: "border-emerald-200 bg-emerald-100 text-emerald-800",
  REJECTED: "border-rose-200 bg-rose-100 text-rose-800",
  IN_PROGRESS: "border-violet-200 bg-violet-100 text-violet-800",
  COMPLETED: "border-indigo-200 bg-indigo-100 text-indigo-800",
  CANCELLED: "border-slate-300 bg-slate-200 text-slate-700",
};

const purchaseStatusLabels: Record<PurchaseRequestStatus, string> = {
  PENDING: "รอตรวจสอบแผน",
  PLAN_REVIEWED: "แผนตรวจแล้ว",
  FINANCE_REVIEWED: "การเงินตรวจแล้ว",
  PROCUREMENT_REVIEWED: "พัสดุตรวจแล้ว",
  BUDGET_REVIEWED: "งบประมาณตรวจแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ตีกลับ",
};

const transactionLabels: Record<BudgetTransactionKind, string> = {
  ALLOCATE: "จัดสรรงบประมาณ",
  EXPENSE: "เบิกจ่าย",
  REFUND: "คืนเงิน",
  ADJUST: "ปรับยอด",
};

export function ProjectDetailClient({ data }: { data: ProjectDetailData }) {
  const [activeTab, setActiveTab] = useState<ProjectTabKey>("overview");
  const [dialogAction, setDialogAction] = useState<WorkflowAction | null>(null);
  const [comment, setComment] = useState("");
  const [approvedBudget, setApprovedBudget] = useState(data.project.budgetRequested);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const nextAction = getNextAction(data);
  const canOpenProcurement = data.permissions.canCreatePurchaseRequest;

  const openAction = (action: WorkflowAction) => {
    setDialogAction(action);
    setComment("");
    setApprovedBudget(data.project.budgetRequested);
    setMessage(null);
    setError(null);
  };

  const closeAction = () => {
    if (loading) return;
    setDialogAction(null);
    setComment("");
    setError(null);
  };

  const submitWorkflow = async () => {
    if (!dialogAction) return;
    if (dialogAction === "reject" && !comment.trim()) {
      setError("กรุณาระบุเหตุผลที่ตีกลับ เพื่อให้ผู้รับผิดชอบนำไปแก้ไขได้ถูกต้อง");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${data.project.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dialogAction,
          comment: comment.trim() || undefined,
          budget: dialogAction === "approve" ? approvedBudget : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "ดำเนินการไม่สำเร็จ");
      }
      setMessage("ดำเนินการเรียบร้อยแล้ว");
      setDialogAction(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSection data={data} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-6">
          {message && <StatusAlert variant="success">{message}</StatusAlert>}

          <NextActionCard
            data={data}
            nextAction={nextAction}
            onWorkflow={openAction}
            onBudgetTab={() => setActiveTab("budget")}
          />

          <BudgetSummaryCards data={data} />
          <ApprovalTimeline data={data} />

          <section className="rounded-lg border border-border/70 bg-card/90 shadow-sm backdrop-blur">
            <div className="overflow-x-auto border-b border-border/70 px-3 pt-3">
              <div className="flex min-w-max gap-1">
                {tabItems.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-sm font-bold transition",
                      activeTab === tab.id
                        ? "border-border bg-background text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-primary",
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 md:p-5">
              {activeTab === "overview" && <OverviewTab data={data} />}
              {activeTab === "activities" && <ActivitiesTab data={data} />}
              {activeTab === "approvals" && <ApprovalHistoryTab data={data} />}
              {activeTab === "budget" && <BudgetHistoryTab data={data} />}
              {activeTab === "procurement" && (
                <PurchaseRequestsTab data={data} canOpenProcurement={canOpenProcurement} />
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <RightInfoPanel data={data} nextAction={nextAction} setActiveTab={setActiveTab} />
        </aside>
      </div>

      {dialogAction && (
        <WorkflowDialog
          action={dialogAction}
          data={data}
          approvedBudget={approvedBudget}
          comment={comment}
          error={error}
          loading={loading}
          setApprovedBudget={setApprovedBudget}
          setComment={setComment}
          onClose={closeAction}
          onConfirm={submitWorkflow}
        />
      )}
    </div>
  );
}

function HeaderSection({ data }: { data: ProjectDetailData }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur md:p-6">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Home className="size-3.5" />
        <span>หน้าหลัก</span>
        <span>/</span>
        <Link href="/projects" className="hover:text-primary">
          โครงการ
        </Link>
        <span>/</span>
        <span className="text-primary">รายละเอียดโครงการ</span>
      </div>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex rounded-full border border-primary/10 bg-primary/5 px-3 py-1 font-mono text-xs font-bold text-primary">
            {data.project.projectCode}
          </div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
              {data.project.projectName}
            </h1>
            <StatusBadge status={data.project.status} />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
            <HeaderMeta icon={<CalendarDays className="size-4" />} label={`ปีการศึกษา ${data.project.academicYearName}`} />
            <HeaderMeta icon={<Landmark className="size-4" />} label={data.project.departmentName} />
            <HeaderMeta icon={<UserRound className="size-4" />} label={data.project.responsibleFullName} />
            <HeaderMeta icon={<Clock3 className="size-4" />} label={`อัปเดต ${formatThaiDate(data.project.updatedAt)}`} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row xl:flex-col xl:items-end">
          {data.permissions.canEdit && (
            <Button asChild variant="outline" className="w-full gap-2 rounded-lg sm:w-auto">
              <Link href={`/projects/${data.project.id}/edit`}>
                <Edit3 className="size-4" />
                แก้ไขโครงการ
              </Link>
            </Button>
          )}
          {data.permissions.canCreatePurchaseRequest && (
            <Button asChild className="w-full gap-2 rounded-lg sm:w-auto">
              <Link href={`/procurement/new?projectId=${data.project.id}`}>
                <PackagePlus className="size-4" />
                สร้างคำขอจัดซื้อ
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function HeaderMeta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function NextActionCard({
  data,
  nextAction,
  onWorkflow,
  onBudgetTab,
}: {
  data: ProjectDetailData;
  nextAction: ReturnType<typeof getNextAction>;
  onWorkflow: (action: WorkflowAction) => void;
  onBudgetTab: () => void;
}) {
  return (
    <Card className="overflow-hidden rounded-lg border-primary/15 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {nextAction.icon}
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-primary/75">งานถัดไป</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">{nextAction.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {nextAction.description}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          {data.permissions.canEdit && (
            <Button asChild variant="outline" className="gap-2 rounded-lg">
              <Link href={`/projects/${data.project.id}/edit`}>
                <Edit3 className="size-4" />
                แก้ไขโครงการ
              </Link>
            </Button>
          )}
          {data.permissions.canSubmit && (
            <Button className="gap-2 rounded-lg" onClick={() => onWorkflow("submit")}>
              <Send className="size-4" />
              ส่งขออนุมัติ
            </Button>
          )}
          {data.permissions.canReview && (
            <Button className="gap-2 rounded-lg" onClick={() => onWorkflow("review_approve")}>
              <CheckCircle2 className="size-4" />
              ตรวจสอบผ่าน
            </Button>
          )}
          {data.permissions.canApprove && (
            <Button className="gap-2 rounded-lg" onClick={() => onWorkflow("approve")}>
              <ShieldCheck className="size-4" />
              อนุมัติโครงการ
            </Button>
          )}
          {data.permissions.canReject && (
            <Button
              variant="destructive"
              className="gap-2 rounded-lg"
              onClick={() => onWorkflow("reject")}
            >
              <RotateCcw className="size-4" />
              ตีกลับ
            </Button>
          )}
          {data.permissions.canCreatePurchaseRequest && (
            <Button asChild className="gap-2 rounded-lg">
              <Link href={`/procurement/new?projectId=${data.project.id}`}>
                <PackagePlus className="size-4" />
                สร้างคำขอจัดซื้อ
              </Link>
            </Button>
          )}
          {data.permissions.canViewBudgetHistory && data.project.budgetActive && (
            <Button variant="outline" className="gap-2 rounded-lg" onClick={onBudgetTab}>
              <History className="size-4" />
              ดูประวัติใช้งบ
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetSummaryCards({ data }: { data: ProjectDetailData }) {
  const cards = [
    {
      label: "งบประมาณที่ขอ",
      value: formatBaht(data.project.budgetRequested),
      icon: <Wallet className="size-5" />,
      tone: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "งบประมาณที่อนุมัติ",
      value: data.project.budgetApproved > 0 ? formatBaht(data.project.budgetApproved) : "ยังไม่มีงบอนุมัติ",
      icon: <CheckCircle2 className="size-5" />,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "ใช้จ่ายแล้ว",
      value: formatBaht(data.project.budgetNetSpent),
      icon: <ReceiptText className="size-5" />,
      tone: "text-rose-700",
      bg: "bg-rose-50",
    },
    {
      label: "งบคงเหลือ",
      value: data.project.budgetApproved > 0 ? formatBaht(data.project.budgetRemaining) : "ยังไม่มีงบอนุมัติ",
      icon: <Banknote className="size-5" />,
      tone: getRemainingTone(data.project.budgetRemaining, data.project.budgetApproved),
      bg: "bg-amber-50",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-lg border-border/70 bg-card/90">
            <CardContent className="flex items-start gap-3 p-4">
              <div className={cn("rounded-lg p-2", card.bg, card.tone)}>{card.icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                <p className={cn("mt-1 break-words text-xl font-bold", card.tone)}>
                  {card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-lg border-border/70 bg-card/90">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-primary">ภาพรวมการใช้งบประมาณ</p>
            <p className={cn("text-sm font-bold", getProgressTone(data.project.budgetPercentUsed))}>
              ใช้งบไปแล้ว {data.project.budgetPercentUsed.toFixed(1)}%
            </p>
          </div>
          {data.project.budgetApproved > 0 ? (
            <>
              <div className="h-3 overflow-hidden rounded-full border bg-slate-100">
                <div
                  className={cn("h-full rounded-full", getProgressBar(data.project.budgetPercentUsed))}
                  style={{ width: `${Math.min(data.project.budgetPercentUsed, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>ใช้ {formatBaht(data.project.budgetNetSpent)}</span>
                <span>เหลือ {formatBaht(data.project.budgetRemaining)}</span>
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              ยังไม่มีงบประมาณที่อนุมัติ ระบบจะแสดง progress การใช้งบเมื่อโครงการได้รับอนุมัติแล้ว
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ApprovalTimeline({ data }: { data: ProjectDetailData }) {
  const steps = buildTimelineSteps(data);

  return (
    <Card className="rounded-lg border-border/70 bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-primary">
          <ClipboardCheck className="size-5" />
          เส้นทางการอนุมัติ
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-5">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={cn(
                "relative rounded-lg border p-3",
                step.state === "completed" && "border-emerald-200 bg-emerald-50",
                step.state === "current" && "border-primary/30 bg-primary/5",
                step.state === "rejected" && "border-rose-200 bg-rose-50",
                step.state === "pending" && "border-border/70 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    step.state === "completed" && "bg-emerald-600 text-white",
                    step.state === "current" && "bg-primary text-primary-foreground",
                    step.state === "rejected" && "bg-rose-600 text-white",
                    step.state === "pending" && "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-sm font-bold text-foreground">{step.title}</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">{step.label}</p>
              {step.actor && <p className="mt-1 text-xs text-foreground">{step.actor}</p>}
              {step.date && <p className="mt-1 text-[11px] text-muted-foreground">{formatThaiDate(step.date)}</p>}
              {step.comment && (
                <p className={cn("mt-2 rounded-md p-2 text-[11px]", step.state === "rejected" ? "bg-rose-100 text-rose-800" : "bg-background/70 text-muted-foreground")}>
                  {step.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ data }: { data: ProjectDetailData }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="ข้อมูลทั่วไป" icon={<Landmark className="size-5" />}>
          <InfoRow label="รหัสโครงการ" value={data.project.projectCode} />
          <InfoRow label="ชื่อโครงการ" value={data.project.projectName} />
          <InfoRow label="ปีการศึกษา" value={data.project.academicYearName} />
          <InfoRow label="กลุ่มบริหาร" value={data.project.departmentName} />
          <InfoRow label="ยุทธศาสตร์/กลยุทธ์" value={data.project.strategyLabel} />
          <InfoRow label="แหล่งเงิน" value={data.project.fundSourceName} />
          <InfoRow label="ผู้รับผิดชอบ" value={data.project.responsibleFullName} />
          <InfoRow label="ระยะเวลาดำเนินการ" value={formatDateRange(data.project.startDate, data.project.endDate)} />
        </InfoCard>
        <InfoCard title="เป้าหมายของโครงการ" icon={<Target className="size-5" />}>
          <NarrativeBlock title="เป้าหมายเชิงปริมาณ" body={data.project.quantitativeTarget} compact />
          <NarrativeBlock title="เป้าหมายเชิงคุณภาพ" body={data.project.qualitativeTarget} compact />
          <NarrativeBlock title="ตัวชี้วัด" body={data.project.indicators} compact />
        </InfoCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <NarrativeCard title="หลักการและเหตุผล" body={data.project.rationale} />
        <NarrativeCard title="วัตถุประสงค์" body={data.project.objectives} />
        <NarrativeCard title="วิธีดำเนินการ" body={data.project.method} />
        <NarrativeCard title="ผลที่คาดว่าจะได้รับ" body={data.project.expectedOutcome} />
      </div>
    </div>
  );
}

function ActivitiesTab({ data }: { data: ProjectDetailData }) {
  if (data.activities.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="size-6" />}
        title="ยังไม่มีกิจกรรมย่อย"
        description="เมื่อเพิ่มกิจกรรมย่อยของโครงการ รายการกิจกรรม งบประมาณ และยอดคงเหลือจะแสดงที่นี่"
      />
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {data.activities.map((activity) => (
          <Card key={activity.id} className="rounded-lg">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="font-bold text-foreground">{activity.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateRange(activity.startDate, activity.endDate)}
                </p>
              </div>
              <InfoRow label="กระเป๋างบ/แหล่งเงิน" value={activity.fundSourceName} />
              <InfoRow label="งบที่ขอ" value={formatBaht(activity.budgetRequested)} />
              <InfoRow label="งบอนุมัติ" value={formatBaht(activity.budgetApproved)} />
              <InfoRow label="ใช้จ่ายแล้ว" value={formatBaht(activity.netSpent)} />
              <InfoRow label="คงเหลือ" value={formatBaht(activity.remaining)} />
              <ProgressBar percent={activity.percentUsed} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs font-bold text-muted-foreground">
              <th className="p-3">กิจกรรม</th>
              <th className="p-3">ระยะเวลา</th>
              <th className="p-3">กระเป๋างบ/แหล่งเงิน</th>
              <th className="p-3 text-right">งบที่ขอ</th>
              <th className="p-3 text-right">งบอนุมัติ</th>
              <th className="p-3 text-right">ใช้จ่ายแล้ว</th>
              <th className="p-3 text-right">คงเหลือ</th>
              <th className="p-3">ความคืบหน้า</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data.activities.map((activity) => (
              <tr key={activity.id} className="hover:bg-muted/15">
                <td className="p-3 font-bold text-foreground">{activity.name}</td>
                <td className="p-3 text-muted-foreground">
                  {formatDateRange(activity.startDate, activity.endDate)}
                </td>
                <td className="p-3 text-muted-foreground">{activity.fundSourceName}</td>
                <td className="p-3 text-right font-mono font-semibold">
                  {formatBaht(activity.budgetRequested)}
                </td>
                <td className="p-3 text-right font-mono font-semibold">
                  {formatBaht(activity.budgetApproved)}
                </td>
                <td className="p-3 text-right font-mono font-semibold text-rose-700">
                  {formatBaht(activity.netSpent)}
                </td>
                <td className={cn("p-3 text-right font-mono font-bold", getRemainingTone(activity.remaining, activity.budgetApproved))}>
                  {formatBaht(activity.remaining)}
                </td>
                <td className="w-44 p-3">
                  <ProgressBar percent={activity.percentUsed} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ApprovalHistoryTab({ data }: { data: ProjectDetailData }) {
  if (data.approvals.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-6" />}
        title="ยังไม่มีประวัติการอนุมัติ"
        description="เมื่อโครงการถูกส่งตรวจสอบหรืออนุมัติ ประวัติและความเห็นจะแสดงที่นี่"
      />
    );
  }

  return (
    <div className="space-y-3">
      {data.approvals.map((approval) => (
        <div
          key={approval.id}
          className={cn(
            "rounded-lg border p-4",
            approval.status === "REJECTED"
              ? "border-rose-200 bg-rose-50"
              : "border-border/70 bg-background/70",
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">
                ขั้นที่ {approval.stepOrder}: {ROLE_LABELS[approval.approverRole]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{approval.approverName}</p>
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <ApprovalBadge status={approval.status} />
              <span className="text-xs text-muted-foreground">
                {formatThaiDate(approval.approvedAt)}
              </span>
            </div>
          </div>
          {approval.comment ? (
            <p
              className={cn(
                "mt-3 rounded-lg p-3 text-sm leading-relaxed",
                approval.status === "REJECTED"
                  ? "bg-white text-rose-800"
                  : "bg-muted/30 text-muted-foreground",
              )}
            >
              “{approval.comment}”
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">ไม่มีความเห็นเพิ่มเติม</p>
          )}
        </div>
      ))}
    </div>
  );
}

function BudgetHistoryTab({ data }: { data: ProjectDetailData }) {
  const history = data.budgetHistory;

  if (!data.permissions.canViewBudgetHistory) {
    return (
      <EmptyState
        icon={<ReceiptText className="size-6" />}
        title="บัญชีนี้ไม่มีสิทธิ์ดูรายละเอียดประวัติการเงินของโครงการ"
        description="ระบบจะแสดงเฉพาะข้อมูลภาพรวมที่ผู้ใช้มีสิทธิ์เข้าถึง"
      />
    );
  }

  return (
    <div id="budget-history" className="scroll-mt-24 space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-primary">ประวัติการใช้งบประมาณ</p>
          <p className="text-xs text-muted-foreground">
            ทั้งหมด {data.project.budgetHistoryCount} รายการ ใช้จ่ายจริง {data.project.budgetExpenseCount} ครั้ง
          </p>
        </div>
        <form method="get" action={`/projects/${data.project.id}`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="budgetType" className="text-xs font-semibold text-muted-foreground">
            ประเภท
          </label>
          <select
            id="budgetType"
            name="budgetType"
            defaultValue={history.budgetType ?? ""}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {history.allowedTypes.map((type) => (
              <option key={type} value={type}>
                {transactionLabels[type]}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline" className="rounded-lg">
            กรอง
          </Button>
        </form>
      </div>

      {history.rows.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" />}
          title="ยังไม่มีประวัติใช้งบประมาณ"
          description="เมื่อมีการจัดสรร เบิกจ่าย คืนเงิน หรือปรับยอด รายการจะแสดงที่นี่"
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {history.rows.map((row) => (
              <BudgetHistoryMobileCard key={row.id} row={row} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-bold text-muted-foreground">
                  <th className="p-3">วันที่</th>
                  <th className="p-3">ประเภท</th>
                  <th className="p-3">รายละเอียด</th>
                  <th className="p-3">ผู้บันทึก</th>
                  <th className="p-3 text-right">จำนวนเงิน</th>
                  <th className="p-3 text-right">ยอดคงเหลือหลังรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {history.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/15">
                    <td className="whitespace-nowrap p-3">{formatThaiDate(row.transactionDate)}</td>
                    <td className="p-3">
                      <TransactionBadge type={row.transactionType} />
                    </td>
                    <td className="max-w-md p-3">{row.description || "-"}</td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{row.actorName}</td>
                    <td className={cn("whitespace-nowrap p-3 text-right font-mono font-semibold", getTransactionTone(row.transactionType))}>
                      {row.transactionType === "EXPENSE" ? "-" : row.transactionType === "REFUND" ? "+" : ""}
                      {formatBaht(row.amount)}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right font-mono font-bold">
                      {formatBaht(row.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              หน้า {history.page} จาก {history.totalPages} · {history.totalCount} รายการ
            </span>
            <div className="flex gap-2">
              <HistoryPageButton href={history.page <= 1 ? null : buildHistoryHref(data.project.id, history.budgetType, history.page - 1)}>
                ก่อนหน้า
              </HistoryPageButton>
              <HistoryPageButton href={history.page >= history.totalPages ? null : buildHistoryHref(data.project.id, history.budgetType, history.page + 1)}>
                ถัดไป
              </HistoryPageButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PurchaseRequestsTab({
  data,
  canOpenProcurement,
}: {
  data: ProjectDetailData;
  canOpenProcurement: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-primary">คำขอจัดซื้อ/จัดจ้างของโครงการนี้</p>
          <p className="text-xs text-muted-foreground">
            แสดงรายการล่าสุดสูงสุด 50 รายการที่เชื่อมกับโครงการนี้
          </p>
        </div>
        {canOpenProcurement && (
          <Button asChild className="gap-2 rounded-lg">
            <Link href={`/procurement/new?projectId=${data.project.id}`}>
              <PackagePlus className="size-4" />
              สร้างคำขอจัดซื้อ
            </Link>
          </Button>
        )}
      </div>

      {data.purchaseRequests.length === 0 ? (
        <EmptyState
          icon={<PackagePlus className="size-6" />}
          title="ยังไม่มีคำขอจัดซื้อ"
          description="เมื่อโครงการได้รับอนุมัติแล้ว สามารถสร้างคำขอจัดซื้อจากโครงการนี้ได้"
          action={
            canOpenProcurement ? (
              <Button asChild className="mt-4 gap-2 rounded-lg">
                <Link href={`/procurement/new?projectId=${data.project.id}`}>
                  <PackagePlus className="size-4" />
                  สร้างคำขอจัดซื้อ
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {data.purchaseRequests.map((request) => (
              <PurchaseRequestMobileCard key={request.id} request={request} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-bold text-muted-foreground">
                  <th className="p-3">เลขที่เอกสาร</th>
                  <th className="p-3">เรื่อง</th>
                  <th className="p-3">วันที่</th>
                  <th className="p-3 text-right">ยอดขอ</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">ผู้สร้าง</th>
                  <th className="p-3 text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.purchaseRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-muted/15">
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {request.documentNo ?? "-"}
                    </td>
                    <td className="max-w-md p-3">
                      <p className="font-semibold text-foreground">{request.subject}</p>
                      {request.activityName && (
                        <p className="mt-1 text-xs text-muted-foreground">{request.activityName}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3">{formatThaiDate(request.documentDate)}</td>
                    <td className="whitespace-nowrap p-3 text-right font-mono font-bold">
                      {formatBaht(request.requestedAmount)}
                    </td>
                    <td className="p-3">
                      <PurchaseStatusBadge status={request.status} />
                    </td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {request.createdByName}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <IconLink href={`/procurement/${request.id}`} label="ดูรายละเอียด" icon={<Eye className="size-4" />} />
                        <IconLink href={`/procurement/${request.id}/print`} label="พิมพ์เอกสาร" icon={<Printer className="size-4" />} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RightInfoPanel({
  data,
  nextAction,
  setActiveTab,
}: {
  data: ProjectDetailData;
  nextAction: ReturnType<typeof getNextAction>;
  setActiveTab: (tab: ProjectTabKey) => void;
}) {
  return (
    <Card className="rounded-lg border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-primary">
          <LayoutList className="size-5" />
          ข้อมูลสำคัญ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <InfoRow label="สถานะปัจจุบัน" valueNode={<StatusBadge status={data.project.status} />} />
          <InfoRow label="ผู้รับผิดชอบ" value={data.project.responsibleFullName} />
          <InfoRow label="กลุ่มบริหาร" value={data.project.departmentName} />
          <InfoRow label="วันที่สร้าง" value={formatThaiDate(data.project.createdAt)} />
          <InfoRow label="อัปเดตล่าสุด" value={formatThaiDate(data.project.updatedAt)} />
          <InfoRow
            label="งบคงเหลือ"
            value={data.project.budgetApproved > 0 ? formatBaht(data.project.budgetRemaining) : "ยังไม่มีงบอนุมัติ"}
            valueClassName={getRemainingTone(data.project.budgetRemaining, data.project.budgetApproved)}
          />
        </div>
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
          <p className="text-xs font-bold text-primary">งานถัดไป</p>
          <p className="mt-1 text-sm font-bold text-foreground">{nextAction.title}</p>
        </div>
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-bold text-muted-foreground">Quick links</p>
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-muted-foreground transition hover:bg-muted/40 hover:text-primary"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowDialog({
  action,
  data,
  approvedBudget,
  comment,
  error,
  loading,
  setApprovedBudget,
  setComment,
  onClose,
  onConfirm,
}: {
  action: WorkflowAction;
  data: ProjectDetailData;
  approvedBudget: number;
  comment: string;
  error: string | null;
  loading: boolean;
  setApprovedBudget: (value: number) => void;
  setComment: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const meta = getWorkflowMeta(action);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <h2 className={cn("flex items-center gap-2 text-lg font-bold", meta.titleTone)}>
            {meta.icon}
            {meta.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="ปิด"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {error && <StatusAlert variant="error">{error}</StatusAlert>}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="font-mono text-xs text-muted-foreground">{data.project.projectCode}</p>
            <p className="mt-1 font-bold text-foreground">{data.project.projectName}</p>
            <div className="mt-3">
              <StatusBadge status={data.project.status} />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
          {action === "approve" && (
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">งบประมาณที่อนุมัติ (บาท)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={approvedBudget}
                onChange={(event) => setApprovedBudget(Number(event.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
          )}
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">
              {action === "reject" ? "เหตุผลที่ตีกลับ (บังคับ)" : "ความเห็นเพิ่มเติม (ไม่บังคับ)"}
            </span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder={
                action === "reject"
                  ? "ระบุเหตุผลเพื่อให้ผู้รับผิดชอบนำไปปรับแก้"
                  : "ระบุความเห็นเพื่อบันทึกในประวัติการอนุมัติ"
              }
            />
          </label>
          {meta.warning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-900">
              {meta.warning}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading || (action === "reject" && !comment.trim())}
              className={cn("min-w-[140px] gap-2", meta.buttonClass)}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : meta.buttonIcon}
              {loading ? "กำลังบันทึก..." : meta.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-lg border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-primary">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function NarrativeCard({ title, body }: { title: string; body: string | null }) {
  return (
    <Card className="rounded-lg border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-primary">
          <FileText className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <NarrativeBody body={body} />
      </CardContent>
    </Card>
  );
}

function NarrativeBlock({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string | null;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
      <p className="text-xs font-bold text-primary">{title}</p>
      <div className={cn("mt-1", compact && "text-sm")}>
        <NarrativeBody body={body} />
      </div>
    </div>
  );
}

function NarrativeBody({ body }: { body: string | null }) {
  if (!body?.trim()) {
    return <p className="text-sm text-muted-foreground">ยังไม่ได้ระบุ</p>;
  }

  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>;
}

function InfoRow({
  label,
  value,
  valueNode,
  valueClassName,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-left font-medium sm:text-right", valueClassName)}>
        {valueNode ?? value}
      </span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-dashed border-border bg-muted/15 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold",
        statusStyles[status] ?? statusStyles.DRAFT,
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const label =
    status === "APPROVED" ? "อนุมัติแล้ว" : status === "REJECTED" ? "ตีกลับ" : "รอดำเนินการ";
  const tone =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
      : status === "REJECTED"
        ? "border-rose-200 bg-rose-100 text-rose-800"
        : "border-amber-200 bg-amber-100 text-amber-800";
  return <span className={cn("w-fit rounded-full border px-2.5 py-1 text-xs font-bold", tone)}>{label}</span>;
}

function PurchaseStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const tone =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
      : status === "REJECTED"
        ? "border-rose-200 bg-rose-100 text-rose-800"
        : "border-blue-200 bg-blue-100 text-blue-800";
  return (
    <span className={cn("inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-bold", tone)}>
      {purchaseStatusLabels[status]}
    </span>
  );
}

function TransactionBadge({ type }: { type: BudgetTransactionKind }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", getTransactionBadgeTone(type))}>
      {transactionLabels[type]}
    </span>
  );
}

function IconLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs font-bold text-muted-foreground transition hover:border-primary/30 hover:text-primary"
    >
      {icon}
      {label}
    </Link>
  );
}

function BudgetHistoryMobileCard({
  row,
}: {
  row: ProjectDetailData["budgetHistory"]["rows"][number];
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <TransactionBadge type={row.transactionType} />
            <p className="mt-2 text-sm text-muted-foreground">{formatThaiDate(row.transactionDate)}</p>
          </div>
          <p className={cn("font-mono text-sm font-bold", getTransactionTone(row.transactionType))}>
            {row.transactionType === "EXPENSE" ? "-" : row.transactionType === "REFUND" ? "+" : ""}
            {formatBaht(row.amount)}
          </p>
        </div>
        <InfoRow label="รายละเอียด" value={row.description || "-"} />
        <InfoRow label="ผู้บันทึก" value={row.actorName} />
        <InfoRow label="คงเหลือหลังรายการ" value={formatBaht(row.balanceAfter)} />
      </CardContent>
    </Card>
  );
}

function PurchaseRequestMobileCard({
  request,
}: {
  request: ProjectDetailData["purchaseRequests"][number];
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{request.documentNo ?? "-"}</p>
            <p className="mt-1 font-bold text-foreground">{request.subject}</p>
          </div>
          <PurchaseStatusBadge status={request.status} />
        </div>
        <InfoRow label="วันที่" value={formatThaiDate(request.documentDate)} />
        <InfoRow label="ยอดขอ" value={formatBaht(request.requestedAmount)} />
        <InfoRow label="ผู้สร้าง" value={request.createdByName} />
        <div className="flex gap-2 border-t border-border/50 pt-3">
          <IconLink href={`/procurement/${request.id}`} label="รายละเอียด" icon={<Eye className="size-4" />} />
          <IconLink href={`/procurement/${request.id}/print`} label="พิมพ์" icon={<Printer className="size-4" />} />
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full border bg-slate-100">
        <div
          className={cn("h-full rounded-full", getProgressBar(percent))}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
        <span>ใช้ {percent.toFixed(0)}%</span>
        <span>เหลือ {Math.max(100 - percent, 0).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function HistoryPageButton({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) {
    return (
      <Button size="sm" variant="outline" disabled className="rounded-lg">
        {children}
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant="outline" className="rounded-lg">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function buildTimelineSteps(data: ProjectDetailData) {
  const status = data.project.status;
  const reviewApproval = data.approvals.find((approval) => approval.stepOrder === 1);
  const executiveApproval = data.approvals.find((approval) => approval.stepOrder === 2);
  const rejectedApproval = data.approvals.find((approval) => approval.status === "REJECTED");

  return [
    {
      title: "สร้างโครงการ",
      label: "เสร็จสิ้น",
      state: "completed",
      actor: data.project.responsibleFullName,
      date: data.project.createdAt,
      comment: null,
    },
    {
      title: "ส่งขออนุมัติ",
      label: status === "DRAFT" ? "รอดำเนินการ" : "เสร็จสิ้น",
      state: status === "DRAFT" ? "current" : "completed",
      actor: data.project.responsibleFullName,
      date: status === "DRAFT" ? null : data.project.updatedAt,
      comment: null,
    },
    {
      title: "หัวหน้ากลุ่มตรวจสอบ",
      label: getTimelineLabel(status, "SUBMITTED", reviewApproval),
      state: getTimelineState(status, "SUBMITTED", reviewApproval, Boolean(rejectedApproval)),
      actor: reviewApproval?.approverName ?? "หัวหน้ากลุ่มงาน",
      date: reviewApproval?.approvedAt ?? null,
      comment: reviewApproval?.comment ?? null,
    },
    {
      title: "ผู้บริหารอนุมัติ",
      label: getTimelineLabel(status, "REVIEWED", executiveApproval),
      state: getTimelineState(status, "REVIEWED", executiveApproval, Boolean(rejectedApproval)),
      actor: executiveApproval?.approverName ?? "ผู้บริหาร",
      date: executiveApproval?.approvedAt ?? null,
      comment: executiveApproval?.comment ?? null,
    },
    {
      title: "ดำเนินงาน/ใช้งบ",
      label:
        status === "APPROVED" || status === "IN_PROGRESS" || status === "COMPLETED"
          ? status === "COMPLETED"
            ? "เสร็จสิ้น"
            : "กำลังดำเนินการ"
          : status === "REJECTED"
            ? "หยุดรอแก้ไข"
            : "ยังไม่เริ่ม",
      state:
        status === "COMPLETED"
          ? "completed"
          : status === "APPROVED" || status === "IN_PROGRESS"
            ? "current"
            : status === "REJECTED"
              ? "rejected"
              : "pending",
      actor: null,
      date: null,
      comment: rejectedApproval?.status === "REJECTED" ? rejectedApproval.comment : null,
    },
  ] as const;
}

function getTimelineLabel(
  status: string,
  currentStatus: ProjectStatus,
  approval: ProjectDetailData["approvals"][number] | undefined,
) {
  if (approval?.status === "REJECTED") return "ตีกลับ";
  if (approval?.status === "APPROVED") return "เสร็จสิ้น";
  if (status === currentStatus) return "รอดำเนินการ";
  if (status === "REJECTED") return "ตีกลับ";
  return "ยังไม่เริ่ม";
}

function getTimelineState(
  status: string,
  currentStatus: ProjectStatus,
  approval: ProjectDetailData["approvals"][number] | undefined,
  hasRejected: boolean,
) {
  if (approval?.status === "REJECTED") return "rejected";
  if (approval?.status === "APPROVED") return "completed";
  if (status === currentStatus) return "current";
  if (status === "REJECTED" && hasRejected) return "rejected";
  return "pending";
}

function getNextAction(data: ProjectDetailData) {
  if (data.permissions.canSubmit) {
    return {
      title: "โครงการนี้ยังเป็นฉบับร่าง",
      description: "กรอกข้อมูลให้ครบถ้วน แล้วกด “ส่งขออนุมัติ” เพื่อให้หัวหน้ากลุ่มตรวจสอบ",
      icon: <Send className="size-5" />,
    };
  }
  if (data.permissions.canReview) {
    return {
      title: "โครงการนี้รอหัวหน้ากลุ่มตรวจสอบ",
      description: "กรุณาตรวจสอบรายละเอียดโครงการ งบประมาณ และตัวชี้วัดก่อนส่งต่อให้ผู้บริหาร",
      icon: <ClipboardCheck className="size-5" />,
    };
  }
  if (data.permissions.canApprove) {
    return {
      title: "โครงการนี้รอผู้บริหารอนุมัติ",
      description: "กรุณาตรวจสอบงบประมาณที่ขอ หากอนุมัติแล้วระบบจะกันวงเงินให้อัตโนมัติ",
      icon: <ShieldCheck className="size-5" />,
    };
  }
  if (data.project.status === "APPROVED" || data.project.status === "IN_PROGRESS" || data.project.status === "COMPLETED") {
    return {
      title: "โครงการนี้ได้รับอนุมัติแล้ว",
      description: data.permissions.canCreatePurchaseRequest
        ? "สามารถดำเนินโครงการและสร้างคำขอจัดซื้อ/จัดจ้างได้"
        : "บัญชีนี้สามารถติดตามข้อมูลโครงการและงบประมาณตามสิทธิ์ที่ได้รับ",
      icon: <CheckCircle2 className="size-5" />,
    };
  }
  if (data.project.status === "REJECTED") {
    return {
      title: "โครงการถูกตีกลับ",
      description: data.permissions.canEdit
        ? "กรุณาตรวจสอบเหตุผลที่ตีกลับ แก้ไขข้อมูล แล้วส่งขออนุมัติอีกครั้ง"
        : "บัญชีนี้สามารถดูเหตุผลการตีกลับได้ แต่ไม่มีสิทธิ์แก้ไขโครงการนี้",
      icon: <RotateCcw className="size-5" />,
    };
  }
  return {
    title: "บัญชีนี้สามารถดูข้อมูลโครงการได้เท่านั้น",
    description: "ยังไม่มีงานที่ต้องดำเนินการสำหรับบทบาทของคุณในสถานะปัจจุบัน",
    icon: <Eye className="size-5" />,
  };
}

function getWorkflowMeta(action: WorkflowAction) {
  switch (action) {
    case "submit":
      return {
        title: "ยืนยันการส่งขออนุมัติ",
        description: "เมื่อส่งแล้วจะไม่สามารถแก้ไขข้อมูลได้ จนกว่าจะถูกตีกลับ",
        confirmLabel: "ยืนยันส่งขออนุมัติ",
        icon: <Send className="size-5" />,
        buttonIcon: <Send className="size-4" />,
        titleTone: "text-amber-700",
        buttonClass: "bg-amber-600 text-white hover:bg-amber-700",
        warning: null,
      };
    case "review_approve":
      return {
        title: "ตรวจสอบโครงการ",
        description: "บันทึกผลการตรวจสอบและส่งต่อให้ผู้บริหารพิจารณาอนุมัติ",
        confirmLabel: "ตรวจสอบผ่าน",
        icon: <ClipboardCheck className="size-5" />,
        buttonIcon: <CheckCircle2 className="size-4" />,
        titleTone: "text-blue-700",
        buttonClass: "",
        warning: null,
      };
    case "approve":
      return {
        title: "อนุมัติโครงการ",
        description: "ยืนยันงบประมาณที่อนุมัติและบันทึกความเห็นผู้บริหาร",
        confirmLabel: "อนุมัติโครงการ",
        icon: <ShieldCheck className="size-5" />,
        buttonIcon: <ShieldCheck className="size-4" />,
        titleTone: "text-emerald-700",
        buttonClass: "bg-emerald-600 text-white hover:bg-emerald-700",
        warning: "หลังอนุมัติ ระบบจะกันวงเงินและบันทึกรายการงบประมาณอัตโนมัติตาม workflow เดิม",
      };
    case "reject":
      return {
        title: "ตีกลับโครงการ",
        description: "ระบุเหตุผลที่ชัดเจนเพื่อให้ผู้รับผิดชอบนำไปปรับแก้",
        confirmLabel: "ตีกลับโครงการ",
        icon: <RotateCcw className="size-5" />,
        buttonIcon: <XCircle className="size-4" />,
        titleTone: "text-rose-700",
        buttonClass: "bg-rose-600 text-white hover:bg-rose-700",
        warning: "ผู้รับผิดชอบโครงการจะเห็นข้อความนี้เพื่อนำไปแก้ไข",
      };
  }
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "ยังไม่ได้ระบุ";
  return `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
}

function buildHistoryHref(projectId: string, type: BudgetTransactionKind | null, page: number) {
  const params = new URLSearchParams();
  if (type) params.set("budgetType", type);
  params.set("budgetPage", String(page));
  return `/projects/${projectId}?${params.toString()}#budget-history`;
}

function getProgressBar(percentUsed: number) {
  if (percentUsed <= 60) return "bg-emerald-500";
  if (percentUsed <= 85) return "bg-amber-500";
  return "bg-rose-500";
}

function getProgressTone(percentUsed: number) {
  if (percentUsed <= 60) return "text-emerald-700";
  if (percentUsed <= 85) return "text-amber-700";
  return "text-rose-700";
}

function getRemainingTone(remaining: number, total: number) {
  if (remaining < 0) return "font-bold text-rose-700";
  if (total > 0 && remaining <= total * 0.15) return "font-bold text-amber-700";
  return "font-bold text-emerald-700";
}

function getTransactionTone(type: BudgetTransactionKind) {
  if (type === "EXPENSE") return "text-rose-700";
  if (type === "REFUND" || type === "ALLOCATE") return "text-emerald-700";
  return "text-blue-700";
}

function getTransactionBadgeTone(type: BudgetTransactionKind) {
  if (type === "EXPENSE") return "border-rose-200 bg-rose-50 text-rose-700";
  if (type === "REFUND" || type === "ALLOCATE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}
