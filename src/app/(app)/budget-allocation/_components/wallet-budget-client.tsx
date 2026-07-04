"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Landmark,
  Send,
  AlertTriangle,
  Trash2,
  Edit2,
  Plus,
  X,
  Check,
  Loader2,
  Coins,
  ChevronRight,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import { cn, formatBaht } from "@/lib/utils";
import {
  DEFAULT_WALLET_PERCENTAGES,
  FormulaWalletCode,
  WalletCode,
  WalletFormula,
  calculateWalletAllocationPreview,
} from "@/lib/budget-wallets";

type YearOption = { id: string; yearName: string };
type SourceAccount = {
  id: string;
  code: string;
  name: string;
  net: number;
  entries: Array<{ id: string; entryType: string; amount: number; description: string; documentNo: string | null; entryDate: string }>;
};
type WalletItem = {
  id: string;
  code: WalletCode;
  name: string;
  spendMode: string;
  balance: { allocated: number; committed: number; netDisbursed: number; accountingBalance: number; availableBalance: number };
};
type PlanData = {
  id: string;
  name: string;
  status: string;
  academicYearName: string;
  fiscalYearName: string;
  formula: WalletFormula;
  rejectComment?: string | null;
  sourceAccounts: SourceAccount[];
  wallets: WalletItem[];
  transfers: Array<{ id: string; fromWalletName: string; toWalletName: string; amount: number; reason: string; status: string }>;
  operatingExpenses: Array<{ id: string; walletName: string; amount: number; description: string; status: string }>;
};

const SOURCE_LABELS: Record<string, string> = {
  GENERAL_SUBSIDY: "เงินอุดหนุนทั่วไป",
  LEARNER_ACTIVITY: "เงินกิจกรรมพัฒนาผู้เรียน",
  SCHOOL_INCOME: "รายได้สถานศึกษา",
};
const ENTRY_LABELS: Record<string, string> = {
  RECEIPT: "รับเงิน",
  CARRY_FORWARD: "ยอดยกมา",
  DEDUCTION: "รายการหัก",
  RETURN: "ส่งคืน",
  CORRECTION_INCREASE: "ปรับเพิ่ม",
  CORRECTION_DECREASE: "ปรับลด",
};
const WALLET_LABELS: Record<WalletCode, string> = {
  RESERVE: "งบสำรอง",
  UTILITIES: "ค่าสาธารณูปโภค",
  CENTRAL: "งบกลาง",
  ACADEMIC: "กลุ่มบริหารวิชาการ",
  BUDGET: "กลุ่มบริหารงบประมาณ",
  PERSONNEL: "กลุ่มบริหารงานบุคคล",
  GENERAL: "กลุ่มบริหารทั่วไป",
  LEARNER_ACTIVITY: "กิจกรรมพัฒนาผู้เรียน",
  SCHOOL_INCOME: "รายได้สถานศึกษา",
};

const PLAN_STATUS_MAP: Record<string, { label: string; tone: string; alertBg: string; text: string }> = {
  DRAFT: { label: "ฉบับร่าง", tone: "bg-slate-100 text-slate-700 border-slate-200/60", alertBg: "bg-slate-50 border-slate-200/50 text-slate-800", text: "แผนจัดสรรงบประมาณอยู่ในขั้นตอนการสร้างร่างและปรับปรุงสูตรโดยเจ้าหน้าที่การเงิน" },
  SUBMITTED: { label: "ส่งขออนุมัติ", tone: "bg-amber-100 text-amber-800 border-amber-200", alertBg: "bg-amber-50/50 border-amber-200/50 text-amber-900", text: "แผนจัดสรรงบประมาณผ่านการตรวจสอบสูตรจัดสรรแล้วและอยู่ระหว่างรอผู้บริหารพิจารณาอนุมัติ" },
  APPROVED: { label: "อนุมัติแล้ว", tone: "bg-emerald-100 text-emerald-800 border-emerald-200", alertBg: "bg-emerald-50/50 border-emerald-200/50 text-emerald-900", text: "แผนจัดสรรงบประมาณได้รับการอนุมัติแล้ว" },
  LOCKED: { label: "ล็อกแล้ว", tone: "bg-emerald-600 text-white border-emerald-700", alertBg: "bg-emerald-50/30 border-emerald-200/50 text-emerald-950", text: "แผนจัดสรรงบประมาณได้รับอนุมัติและทำการล็อกข้อมูลเพื่อใช้งานจริงเรียบร้อยแล้ว" },
  REJECTED: { label: "ตีกลับให้แก้ไข", tone: "bg-red-100 text-red-800 border-red-200", alertBg: "bg-red-50/50 border-red-200/50 text-red-900", text: "แผนจัดสรรงบประมาณถูกตีกลับไปแก้ไขโดยผู้บริหาร" },
  CANCELLED: { label: "ยกเลิก", tone: "bg-slate-300 text-slate-700 border-slate-400", alertBg: "bg-slate-100 border-slate-300 text-slate-700", text: "แผนจัดสรรงบประมาณรายการนี้ถูกยกเลิกการใช้งานแล้ว" }
};


function toDateInputValue(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}


function getFlatPercentages(f: any): any {
  if (f && typeof f === "object" && "operating" in f && "quality" in f) {
    return {
      RESERVE: (f.operatingPercent * f.operating.RESERVE) / 100,
      UTILITIES: (f.operatingPercent * f.operating.UTILITIES) / 100,
      CENTRAL: (f.operatingPercent * f.operating.CENTRAL) / 100,
      ACADEMIC: (f.qualityPercent * f.quality.ACADEMIC) / 100,
      BUDGET: (f.qualityPercent * f.quality.BUDGET) / 100,
      PERSONNEL: (f.qualityPercent * f.quality.PERSONNEL) / 100,
      GENERAL: (f.qualityPercent * f.quality.GENERAL) / 100,
    };
  }
  return f;
}

export function WalletBudgetClient({
  role,
  academicYears,
  fiscalYears,
  plan,
}: {
  role: string;
  academicYears: YearOption[];
  fiscalYears: YearOption[];
  plan: PlanData | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [percentages, setPercentages] = useState<Record<FormulaWalletCode, number>>(() => {
    const f = plan?.formula ?? DEFAULT_WALLET_PERCENTAGES;
    return getFlatPercentages(f);
  });
  const [entryForm, setEntryForm] = useState({ sourceCode: "GENERAL_SUBSIDY", entryType: "RECEIPT", amount: "", description: "", documentNo: "" });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryForm, setEditEntryForm] = useState({ entryType: "RECEIPT", amount: "", description: "", documentNo: "", entryDate: "" });
  const [transferForm, setTransferForm] = useState({ fromWalletId: "", toWalletId: "", amount: "", reason: "" });
  const [expenseForm, setExpenseForm] = useState({ walletId: "", amount: "", description: "", documentNo: "" });
  const [migrationPreview, setMigrationPreview] = useState<any>(null);
  const [resolvedMappings, setResolvedMappings] = useState<Record<string, WalletCode>>({});
  const [resolvedCovers, setResolvedCovers] = useState<Record<string, WalletCode>>({});
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [workflowAction, setWorkflowAction] = useState<{
    endpoint: string;
    action: "submit" | "approve" | "reject" | "pay";
    successMessage: string;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    variant?: "default" | "destructive" | "warning";
    reasonRequired?: boolean;
    reasonLabel?: string;
  } | null>(null);
  const [workflowReason, setWorkflowReason] = useState("");
  const [workflowReasonError, setWorkflowReasonError] = useState<string | null>(null);
  const [isMigrationConfirmOpen, setIsMigrationConfirmOpen] = useState(false);
  const [migrationReason, setMigrationReason] = useState("");
  const [migrationReasonError, setMigrationReasonError] = useState<string | null>(null);

  const run = (task: () => Promise<Response>, message: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const response = await task();
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
        setSuccess(message);
        setEditingEntryId(null);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "เกิดข้อผิดพลาด");
      }
    });
  };

  const beginEditEntry = (entry: SourceAccount["entries"][number]) => {
    setEditingEntryId(entry.id);
    setEditEntryForm({
      entryType: entry.entryType,
      amount: String(entry.amount),
      description: entry.description,
      documentNo: entry.documentNo ?? "",
      entryDate: toDateInputValue(entry.entryDate),
    });
  };

  const deleteEntry = (entryId: string) => {
    setDeleteEntryId(entryId);
  };

  const confirmDeleteEntry = () => {
    if (!deleteEntryId || !plan) return;
    const entryId = deleteEntryId;
    setDeleteEntryId(null);
    run(
      () => fetch(`/api/budget-plans/${plan.id}/source-entries/${entryId}`, { method: "DELETE" }),
      "ลบรายการแหล่งเงินแล้ว",
    );
  };

  const runWorkflowAction = (
    endpoint: string,
    action: "submit" | "approve" | "reject" | "pay",
    successMessage: string,
    comment?: string,
  ) => {
    run(
      () =>
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, comment }),
        }),
      successMessage,
    );
  };

  const openWorkflowAction = (
    endpoint: string,
    action: "submit" | "approve" | "reject" | "pay",
    successMessage: string,
    title: string,
    description: React.ReactNode,
    confirmLabel?: string,
    variant?: "default" | "destructive" | "warning",
    reasonRequired?: boolean,
    reasonLabel?: string,
  ) => {
    setWorkflowReason("");
    setWorkflowReasonError(null);
    setWorkflowAction({
      endpoint,
      action,
      successMessage,
      title,
      description,
      confirmLabel,
      variant,
      reasonRequired,
      reasonLabel,
    });
  };

  const confirmWorkflowAction = () => {
    if (!workflowAction) return;
    const reason = workflowReason.trim();
    if (workflowAction.reasonRequired && !reason) {
      setWorkflowReasonError(workflowAction.reasonLabel ? `กรุณาระบุ${workflowAction.reasonLabel}` : "กรุณาระบุเหตุผล");
      return;
    }

    const current = workflowAction;
    setWorkflowAction(null);
    setWorkflowReason("");
    setWorkflowReasonError(null);
    runWorkflowAction(current.endpoint, current.action, current.successMessage, reason || undefined);
  };

  const confirmMigration = () => {
    if (!migrationPreview) return;
    const reason = migrationReason.trim();
    if (!reason) {
      setMigrationReasonError("กรุณาระบุเหตุผลยืนยัน migration");
      return;
    }

    setIsMigrationConfirmOpen(false);
    setMigrationReason("");
    setMigrationReasonError(null);
    run(
      () =>
        fetch(`/api/budget-migrations/${migrationPreview.runId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, mappings: resolvedMappings, covers: resolvedCovers }),
        }),
      "ย้ายข้อมูลเดิมสำเร็จ",
    );
  };

  const editable = role === "SUPER_ADMIN" || role === "FINANCE";
  const canApprove = role === "SUPER_ADMIN" || role === "EXECUTIVE";

  // 1. Render empty state if there is no plan.
  if (!plan) {
    if (!editable) {
      return (
        <div className="mx-auto max-w-lg text-center py-20 px-4 flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-5 border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
          </div>
          <h2 className="text-xl font-black text-slate-800">ยังไม่มีแผนจัดสรรงบให้แสดง</h2>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-sm font-body-md">
            เมื่อเจ้าหน้าที่การเงินทำการสร้างแผนงบประมาณประจำปี และได้รับการอนุมัติล็อกโดยผู้บริหารแล้ว รายละเอียดการจัดสรรงบประมาณของแต่ละกระเป๋าจะแสดงขึ้นที่นี่
          </p>
        </div>
      );
    }
    return (
      <CreatePlanCard
        academicYears={academicYears}
        fiscalYears={fiscalYears}
        pending={pending}
        error={error}
        onCreate={(payload) => run(() => fetch("/api/budget-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), "สร้างแผนจัดสรรแล้ว")}
      />
    );
  }

  // Derived budget info
  const sourceNet = (code: string) => plan.sourceAccounts.find((source) => source.code === code)?.net ?? 0;
  const totalPercent = Object.values(percentages).reduce((sum, v) => sum + v, 0);
  const isFormulaValid = Math.abs(totalPercent - 100) < 0.0001;
  const previewState = calculateWalletAllocationPreview({
    generalSubsidyNet: sourceNet("GENERAL_SUBSIDY"),
    learnerActivityNet: sourceNet("LEARNER_ACTIVITY"),
    schoolIncomeNet: sourceNet("SCHOOL_INCOME"),
    formula: percentages,
  });
  const preview = previewState.allocations;
  const effectivePercentages = percentages;

  // Validation checklists
  const totalEntries = plan.sourceAccounts.reduce((sum, s) => sum + s.entries.length, 0);
  const totalFundAmount = plan.sourceAccounts.reduce((sum, s) => sum + s.net, 0);
  const noNegativeSources = plan.sourceAccounts.every(s => s.net >= 0);

  const checklist = {
    hasYear: !!plan.academicYearName,
    hasEntries: totalEntries > 0,
    amountGreaterThanZero: totalFundAmount > 0,
    hasFormula: totalPercent > 0,
    formula100: isFormulaValid,
    noNegativeSources: noNegativeSources,
  };
  const isAllValid = Object.values(checklist).every(Boolean);

  const statusStyle = PLAN_STATUS_MAP[plan.status] || { label: plan.status, tone: "bg-slate-100 text-slate-700", alertBg: "bg-slate-50", text: "" };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <ConfirmDialog
        open={deleteEntryId !== null}
        title="ยืนยันการลบรายการแหล่งเงิน"
        description="การลบรายการนี้จะปรับยอดสุทธิของแหล่งเงินทันทีหลังบันทึก"
        confirmLabel="ลบรายการ"
        variant="destructive"
        loading={pending}
        onConfirm={confirmDeleteEntry}
        onClose={() => setDeleteEntryId(null)}
      />

      <ConfirmDialog
        open={workflowAction !== null}
        title={workflowAction?.title ?? "ระบุเหตุผล"}
        description={workflowAction?.description}
        confirmLabel={workflowAction?.confirmLabel}
        variant={workflowAction?.variant}
        loading={pending}
        error={workflowReasonError}
        reasonLabel={workflowAction?.reasonLabel ?? "เหตุผล"}
        reasonValue={workflowReason}
        reasonPlaceholder="ระบุรายละเอียดประกอบความเห็น..."
        reasonRequired={workflowAction?.reasonRequired}
        onReasonChange={(value) => {
          setWorkflowReason(value);
          setWorkflowReasonError(null);
        }}
        onConfirm={confirmWorkflowAction}
        onClose={() => {
          setWorkflowAction(null);
          setWorkflowReason("");
          setWorkflowReasonError(null);
        }}
      />

      <ConfirmDialog
        open={isMigrationConfirmOpen}
        title="ยืนยัน migration ข้อมูลเดิม"
        description="ระบบจะบันทึกการย้ายข้อมูลเดิมด้วย mapping และรายการชดเชยที่เลือกไว้"
        confirmLabel="ยืนยัน migration"
        variant="warning"
        loading={pending}
        error={migrationReasonError}
        reasonLabel="เหตุผลยืนยัน"
        reasonValue={migrationReason}
        reasonPlaceholder="ระบุเหตุผลหรือเลขอ้างอิงการตรวจสอบก่อนย้ายข้อมูล"
        reasonRequired
        onReasonChange={(value) => {
          setMigrationReason(value);
          setMigrationReasonError(null);
        }}
        onConfirm={confirmMigration}
        onClose={() => {
          setIsMigrationConfirmOpen(false);
          setMigrationReason("");
          setMigrationReasonError(null);
        }}
      />

      {/* 1. Header Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl flex items-center gap-2">
            <span className="text-primary font-bold">
              จัดสรรงบประจำปี
            </span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-medium font-body-md">
            กำหนดแผนจัดสรรงบประมาณ แหล่งเงินทุน และสัดส่วนโควตากระเป๋างบประมาณโรงเรียน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-xs sm:text-sm font-extrabold text-primary shadow-sm">
            <CalendarDays className="h-4 w-4 text-violet-600 animate-pulse" />
            ปีการศึกษา {plan.academicYearName}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-slate-700 shadow-sm">
            <Clock className="h-4 w-4 text-slate-500" />
            ปีงบประมาณ {plan.fiscalYearName}
          </div>
        </div>
      </section>

      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {success && <StatusAlert variant="success">{success}</StatusAlert>}

      {/* 2. Current Budget Plan Status Card */}
      <section className="grid gap-6 xl:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6">
          {/* Status Alert Banner */}
          <div className={cn("rounded-2xl border p-5 flex items-start gap-4 shadow-sm", statusStyle.alertBg)}>
            <div className="mt-0.5 rounded-full p-2 bg-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldAlert className="h-5 w-5 text-violet-700" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">สถานะแผนงบประมาณปัจจุบัน:</h3>
                <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-black", statusStyle.tone)}>
                  {statusStyle.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed font-body-md">
                {statusStyle.text}
              </p>
            </div>
          </div>

          {/* Rejection comment if exists */}
          {plan.status === "REJECTED" && (
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 flex items-start gap-4">
              <div className="bg-red-100 text-red-800 p-2 rounded-xl flex items-center justify-center shrink-0 border border-red-200/40">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-red-900 text-xs sm:text-sm">ข้อความที่ตีกลับแก้ไข:</h4>
                <p className="text-xs sm:text-sm text-red-700 font-medium leading-relaxed font-body-md">
                  {plan.rejectComment || "ไม่ระบุเหตุผลประกอบในการตีกลับแผนการจัดสรร"}
                </p>
              </div>
            </div>
          )}

          {/* Stepper Card */}
          <WorkflowStepper status={plan.status} />

          {/* 3. Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryStatCard
              label="งบรวมทั้งหมด"
              value={totalFundAmount}
              helper="ยอดสุทธิทุกแหล่งเงินในปีนี้"
              tone="violet"
            />
            <SummaryStatCard
              label="เงินอุดหนุนทั่วไป"
              value={sourceNet("GENERAL_SUBSIDY")}
              helper="งบประมาณอุดหนุนทั่วไปรายปี"
              tone="blue"
            />
            <SummaryStatCard
              label="เงินกิจกรรมพัฒนาผู้เรียน"
              value={sourceNet("LEARNER_ACTIVITY")}
              helper="กิจกรรมพัฒนาวิชาการและผู้เรียน"
              tone="gold"
            />
            <SummaryStatCard
              label="รายได้สถานศึกษา"
              value={sourceNet("SCHOOL_INCOME")}
              helper="รายรับภายใน/จัดเก็บของโรงเรียน"
              tone="purple"
            />
            <SummaryQuotaCard
              complete={isFormulaValid}
              allocatedPercent={isFormulaValid ? 100 : 0}
            />
          </div>

          {/* 4. Fund Sources Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2.5">
              <StepTitle number="1" title="แหล่งเงินงบประมาณ" description="บันทึกยอดเงินรายปีจัดเก็บแยกตามบัญชีแหล่งรายรับ" />
              {plan.status === "LOCKED" && (
                <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-extrabold text-slate-500">
                  แผนนี้ถูกล็อกแล้ว ไม่สามารถแก้ไขได้
                </span>
              )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {plan.sourceAccounts.map((source) => (
                <Card key={source.id} className="overflow-hidden border-slate-200/60 shadow-sm bg-white">
                  <CardHeader className="pb-3 border-b border-slate-100/80 bg-slate-50/50">
                    <CardTitle className="text-sm font-extrabold text-slate-700 flex items-center justify-between">
                      <span>{SOURCE_LABELS[source.code] ?? source.name}</span>
                      <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 bg-white border px-1.5 py-0.5 rounded">
                        {source.code.split("_")[0]}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs text-slate-400 font-bold">ยอดสุทธิพร้อมจัดสรร</span>
                      <span className="font-mono text-xl font-black text-violet-700">{formatBaht(source.net)}</span>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {source.entries.map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/20 p-3 text-xs space-y-2 relative group">
                          {editingEntryId === entry.id ? (
                            <div className="grid gap-2">
                              <select
                                className="h-9 rounded-lg border bg-background px-2 text-xs font-bold"
                                value={editEntryForm.entryType}
                                onChange={(event) => setEditEntryForm({ ...editEntryForm, entryType: event.target.value })}
                              >
                                {Object.entries(ENTRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                              <div className="grid gap-2 grid-cols-2">
                                <Input type="number" min="0.01" step="0.01" value={editEntryForm.amount} onChange={(event) => setEditEntryForm({ ...editEntryForm, amount: event.target.value })} />
                                <Input type="date" value={editEntryForm.entryDate} onChange={(event) => setEditEntryForm({ ...editEntryForm, entryDate: event.target.value })} />
                              </div>
                              <Input placeholder="รายละเอียด" value={editEntryForm.description} onChange={(event) => setEditEntryForm({ ...editEntryForm, description: event.target.value })} />
                              <Input placeholder="เลขที่เอกสาร" value={editEntryForm.documentNo} onChange={(event) => setEditEntryForm({ ...editEntryForm, documentNo: event.target.value })} />
                              <div className="flex justify-end gap-2 pt-1">
                                <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs font-bold" disabled={pending} onClick={() => setEditingEntryId(null)}>ยกเลิก</Button>
                                <Button
                                  size="sm"
                                  className="rounded-lg h-8 text-xs font-bold bg-violet-700 hover:bg-violet-800"
                                  disabled={pending || !editEntryForm.amount || !editEntryForm.description}
                                  onClick={() => run(
                                    () => fetch(`/api/budget-plans/${plan.id}/source-entries/${entry.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ ...editEntryForm, amount: Number(editEntryForm.amount) }),
                                    }),
                                    "บันทึกรายการแหล่งเงินแล้ว",
                                  )}
                                >
                                  บันทึก
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="font-extrabold text-slate-700 leading-normal flex items-center gap-1.5">
                                    <span className={cn(
                                      "inline-flex rounded px-1.5 py-0.5 text-[10px] font-black border uppercase tracking-wider",
                                      entry.entryType === "RECEIPT" ? "bg-emerald-50 text-emerald-800 border-emerald-200/50" : "bg-slate-50 text-slate-700 border-slate-200/60"
                                    )}>
                                      {ENTRY_LABELS[entry.entryType]}
                                    </span>
                                    <span className="truncate">{entry.description}</span>
                                  </div>
                                  {entry.documentNo && <p className="mt-1 text-[10px] text-slate-400 font-medium">เอกสาร: {entry.documentNo}</p>}
                                </div>
                                <span className="font-mono font-bold text-slate-800 whitespace-nowrap">{formatBaht(entry.amount)}</span>
                              </div>
                              {editable && plan.status === "DRAFT" && (
                                <div className="flex justify-end gap-1.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button size="sm" variant="outline" className="rounded-lg h-7 px-2 text-[10px] font-bold border-slate-200 text-slate-600 hover:bg-slate-50" disabled={pending} onClick={() => beginEditEntry(entry)}>
                                    <Edit2 className="h-3 w-3 mr-1" />
                                    แก้ไข
                                  </Button>
                                  <Button size="sm" variant="destructive" className="rounded-lg h-7 px-2 text-[10px] font-bold" disabled={pending} onClick={() => deleteEntry(entry.id)}>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    ลบ
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {source.entries.length === 0 && (
                        <div className="text-center py-6 text-slate-400 font-medium">
                          <Coins className="h-8 w-8 mx-auto text-slate-300 stroke-1 mb-1.5" />
                          <p className="text-[11px]">ยังไม่มีรายการแหล่งเงิน</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick entry form for Finance */}
            {editable && plan.status === "DRAFT" && (
              <Card className="border border-dashed border-violet-200/80 bg-violet-50/10 rounded-2xl overflow-hidden mt-3">
                <CardContent className="grid gap-3 p-4 md:grid-cols-[160px_140px_1fr_1.5fr_auto] items-center">
                  <select
                    className="h-10 rounded-xl border bg-background px-3 text-xs sm:text-sm font-bold text-slate-700"
                    value={entryForm.sourceCode}
                    onChange={(event) => setEntryForm({ ...entryForm, sourceCode: event.target.value })}
                  >
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select
                    className="h-10 rounded-xl border bg-background px-3 text-xs sm:text-sm font-bold text-slate-700"
                    value={entryForm.entryType}
                    onChange={(event) => setEntryForm({ ...entryForm, entryType: event.target.value })}
                  >
                    {Object.entries(ENTRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <Input type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน (บาท)" value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                  <Input placeholder="รายละเอียด/คำอธิบาย" value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                  <Button
                    disabled={pending || !entryForm.amount || !entryForm.description}
                    className="rounded-xl h-10 font-bold bg-violet-700 hover:bg-violet-800 w-full"
                    onClick={() => run(
                      () => fetch(`/api/budget-plans/${plan.id}/source-entries`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...entryForm, amount: Number(entryForm.amount) })
                      }),
                      "บันทึกรายการแหล่งเงินแล้ว"
                    )}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    เพิ่มรายการ
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>

          {/* 5. Allocation Formula Section */}
          <section className="glass-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">calculate</span>
                  สูตรการจัดสรรงบประมาณย่อย (กระเป๋างบประมาณ)
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">กำหนดสัดส่วนร้อยละของงบประมาณอุดหนุนทั่วไปในการแบ่งโควตาลงแต่ละกระเป๋า</p>
              </div>
              {editable && plan.status === "DRAFT" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const f = plan?.formula ?? DEFAULT_WALLET_PERCENTAGES;
                      setPercentages(getFlatPercentages(f));
                    }}
                    className="px-3 py-1 text-xs text-outline hover:bg-surface-container-high rounded-xl transition-colors font-bold border border-outline-variant/60"
                  >
                    รีเซ็ต
                  </button>
                  <button
                    onClick={() => setPercentages(DEFAULT_WALLET_PERCENTAGES)}
                    className="px-3 py-1 text-xs text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors font-bold border border-primary/10"
                  >
                    ใช้สูตรมาตรฐาน
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(DEFAULT_WALLET_PERCENTAGES) as FormulaWalletCode[]).map((code) => {
                const isCentralOrAcademic = code === "ACADEMIC" || code === "CENTRAL";
                return (
                  <div
                    key={code}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all",
                      isCentralOrAcademic
                        ? "bg-primary/5 border-primary/20 text-primary"
                        : "bg-surface-container-low/50 border-outline-variant/30 text-on-surface-variant"
                    )}
                  >
                    <label className={cn("text-xs font-bold", isCentralOrAcademic ? "text-primary" : "text-on-surface-variant")}>
                      {WALLET_LABELS[code]}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={!editable || plan.status !== "DRAFT"}
                        value={percentages[code]}
                        onChange={(e) => setPercentages({ ...percentages, [code]: Number(e.target.value) })}
                        className={cn(
                          "w-20 bg-white border rounded-lg text-right font-mono font-bold focus:ring-primary h-9 text-xs",
                          isCentralOrAcademic ? "border-primary/30 text-primary animate-pulse" : "border-outline-variant text-slate-800"
                        )}
                      />
                      <span className="text-[11px] font-bold opacity-70">%</span>
                    </div>
                  </div>
                );
              })}

              {/* Formula Checklist and Save action */}
              <div className="md:col-span-2 mt-2">
                <div className={cn(
                  "p-5 border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4",
                  isFormulaValid ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                )}>
                  <div>
                    <p className={cn("text-[10px] font-bold uppercase mb-1", isFormulaValid ? "text-emerald-800" : "text-red-800")}>
                      สัดส่วนรวมเป้าหมาย (ต้องครบ 100%)
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className={cn("text-2xl font-black leading-none", isFormulaValid ? "text-emerald-600" : "text-red-650")}>
                        {totalPercent.toFixed(2)}%
                      </p>
                      <span className={cn("material-symbols-outlined text-[20px]", isFormulaValid ? "text-emerald-600" : "text-red-500")} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isFormulaValid ? "verified" : "error"}
                      </span>
                    </div>
                  </div>

                  {editable && plan.status === "DRAFT" && (
                    <Button
                      disabled={pending || !isFormulaValid}
                      className={cn(
                        "px-6 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95",
                        isFormulaValid
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      )}
                      onClick={() => run(() => fetch(`/api/budget-plans/${plan.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ percentages })
                      }), "บันทึกสูตรจัดสรรเรียบร้อย")}
                    >
                      บันทึกสูตร
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>


          {/* 6. Budget Wallets Section (Preview or Live) */}
          <section className="glass-card overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/30 flex items-center gap-2 bg-surface-container-low/20">
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              <h3 className="text-sm font-extrabold text-on-surface">
                {plan.status === "LOCKED" ? "สถานะกระเป๋าเงินใช้งานจริง (Live Tracking)" : "เปรียบเทียบ Preview จัดสรรกระเป๋างบประมาณ"}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-[10px] font-black uppercase tracking-widest border-b border-outline-variant/30">
                    <th className="px-6 py-3.5">กระเป๋างบประมาณ</th>
                    <th className="px-6 py-3.5 text-right">งบจัดสรร (บาท)</th>
                    <th className="px-6 py-3.5 text-right">กันวงเงิน</th>
                    <th className="px-6 py-3.5 text-right">คงเหลือ</th>
                    <th className="px-6 py-3.5">สถานะการใช้จ่าย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-xs">
                  {preview ? (
                    (Object.entries(preview) as Array<[WalletCode, number]>).map(([code, amount]) => {
                      const liveWallet = plan.wallets.find(w => w.code === code);
                      const isSpecial = code === "LEARNER_ACTIVITY" || code === "SCHOOL_INCOME";

                      if (plan.status === "LOCKED" && liveWallet) {
                        const balance = liveWallet.balance;
                        const spentPct = balance.allocated > 0 ? (balance.netDisbursed / balance.allocated) * 100 : 0;
                        const committedPct = balance.allocated > 0 ? (balance.committed / balance.allocated) * 100 : 0;
                        const totalSpentPct = spentPct + committedPct;

                        return (
                          <tr key={code} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-on-surface">
                              {liveWallet.name}
                              <p className="text-[10px] text-outline font-bold mt-0.5 uppercase">{liveWallet.spendMode}</p>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">{formatBaht(balance.allocated).replace(" บาท", "")}</td>
                            <td className="px-6 py-4 text-right font-mono text-outline font-semibold">{formatBaht(balance.committed).replace(" บาท", "")}</td>
                            <td className="px-6 py-4 text-right font-mono text-primary font-bold">{formatBaht(balance.availableBalance).replace(" บาท", "")}</td>
                            <td className="px-6 py-4 min-w-[160px]">
                              <div className="flex justify-between items-center text-[10px] font-bold text-outline mb-1">
                                <span>เบิกจ่ายไปแล้ว</span>
                                <span className="font-mono text-slate-800">{totalSpentPct.toFixed(0)}%</span>
                              </div>
                              <div className="progress-bar">
                                <div className="progress-fill bg-emerald-500 transition-all duration-500" style={{ width: `${spentPct}%` }} />
                                <div className="progress-fill bg-amber-400 transition-all duration-500" style={{ width: `${committedPct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={code} className="hover:bg-surface-container-low/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-on-surface">
                            {WALLET_LABELS[code]}
                            <p className="text-[10px] text-outline font-semibold mt-0.5">
                              {isSpecial ? "ยอดอ้างจากแหล่งเงินตรง" : `${(effectivePercentages?.[code] ?? 0).toFixed(2)}% ของเงินอุดหนุนสุทธิ`}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-primary">{formatBaht(amount).replace(" บาท", "")}</td>
                          <td className="px-6 py-4 text-right font-mono text-outline">0.00</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-primary">{formatBaht(amount).replace(" บาท", "")}</td>
                          <td className="px-6 py-4 min-w-[160px]">
                            <div className="progress-bar"><div className="progress-fill bg-slate-200" style={{ width: "0%" }}></div></div>
                            <p className="text-[9px] text-outline font-bold mt-1 uppercase">0% SPENT</p>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-red-650 font-bold">
                        ไม่สามารถประมวลผลกระเป๋างบประมาณได้ในขณะนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>


          {/* 7. Validation Checklist & Workflow Submission Card */}
          {(plan.status === "DRAFT" || plan.status === "REJECTED") && (
            <section className="space-y-3">
              <StepTitle number="4" title="ตรวจสอบความถูกต้องและส่งอนุมัติ" description="ตรวจสอบรายการตรวจสอบความพร้อมก่อนส่งพิจารณาโครงการแก่ผู้บริหาร" />
              <Card className="border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden p-5 space-y-4">
                <h4 className="font-extrabold text-slate-700 text-sm">รายการตรวจสอบเพื่อความปลอดภัย:</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChecklistItem label="ระบุข้อมูลรอบปีการศึกษาและปีงบประมาณแล้ว" checked={checklist.hasYear} />
                  <ChecklistItem label="มีการระบุรายการแหล่งเงินงบประมาณแล้ว" checked={checklist.hasEntries} />
                  <ChecklistItem label="ยอดรวมงบประมาณรายรับทั้งหมดมากกว่า 0 บาท" checked={checklist.amountGreaterThanZero} />
                  <ChecklistItem label="สูตรจัดสรรสัดส่วนหลักและย่อยรวม 100% ครบถ้วน" checked={checklist.formula100} />
                  <ChecklistItem label="ไม่มีรายการยอดบัญชีสุทธิติดลบ" checked={checklist.noNegativeSources} />
                </div>

                <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-xs text-slate-400 font-medium leading-relaxed max-w-md font-body-md">
                    * เมื่อส่งอนุมัติแล้ว แผนงานจะถูกส่งไปยังผู้บริหารโรงเรียนเพื่อตรวจสอบ และเจ้าหน้าที่การเงินจะไม่สามารถเพิ่ม/แก้ไขหรือลบรายการแหล่งเงินได้จนกว่าแผนจะถูกส่งกลับหรือยกเลิก
                  </div>

                  {editable && (
                    <Button
                      disabled={pending || !isAllValid}
                      className="rounded-xl font-bold bg-primary hover:opacity-90 h-11 px-6 whitespace-nowrap active:scale-95 transition-all shadow-md shadow-primary/30 text-xs sm:text-sm"
                      onClick={() => openWorkflowAction(
                        `/api/budget-plans/${plan.id}/workflow`,
                        "submit",
                        "ส่งแผนจัดสรรงบประมาณให้ผู้บริหารอนุมัติสำเร็จ",
                        "ส่งขออนุมัติแผนจัดสรรงบประมาณ",
                        "คุณแน่ใจหรือไม่ว่าต้องการส่งแผนการจัดสรรงบประจำปีนี้ให้ผู้บริหารพิจารณาอนุมัติ?",
                        "ยืนยันส่งอนุมัติ",
                        "default",
                        false
                      )}
                    >
                      {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      ส่งให้ผู้บริหารอนุมัติ
                    </Button>
                  )}
                </div>
              </Card>
            </section>
          )}

          {/* 8. Director Approval alert for EXECUTIVE/SUPER_ADMIN */}
          {canApprove && plan.status === "SUBMITTED" && (
            <section className="space-y-3">
              <StepTitle number="4" title="ส่วนงานตรวจสอบสำหรับผู้บริหาร" description="ตรวจสอบข้อมูลโครงสร้างการแบ่งสัดส่วนและการเงินก่อนพิจารณาทำรายการ" />
              <Card className="border border-violet-200 bg-violet-50/10 rounded-2xl overflow-hidden shadow-sm p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="bg-violet-100 text-violet-800 p-2.5 rounded-full flex items-center justify-center shrink-0 border border-violet-200/40">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-violet-900 text-base">มีแผนจัดสรรงบประมาณรออนุมัติและล็อก</h3>
                    <p className="text-xs sm:text-sm text-violet-850 font-medium leading-relaxed mt-1 font-body-md">
                      กรุณาตรวจสอบความถูกต้องของยอดแหล่งเงิน สูตรจัดสรร และงบแต่ละกระเป๋าก่อนดำเนินงานอนุมัติและล็อกแผนเพื่อเปิดใช้งานจริงในระบบ
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 pt-2">
                  <div className="rounded-xl border bg-white p-3.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">งบรวมทั้งหมด</p>
                    <p className="text-base sm:text-lg font-mono font-black text-slate-800 mt-1">{formatBaht(totalFundAmount)}</p>
                  </div>
                  <div className="rounded-xl border bg-white p-3.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">จำนวนแหล่งเงิน</p>
                    <p className="text-base sm:text-lg font-mono font-black text-slate-800 mt-1">3 แหล่งเงิน</p>
                  </div>
                  <div className="rounded-xl border bg-white p-3.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">จัดสรรครบ 100%</p>
                    <p className="text-base sm:text-lg font-black text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> ใช่</p>
                  </div>
                  <div className="rounded-xl border bg-white p-3.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">จำนวนกระเป๋างบ</p>
                    <p className="text-base sm:text-lg font-mono font-black text-slate-800 mt-1">9 ใบ</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/50">
                  <Button
                    disabled={pending}
                    variant="outline"
                    className="rounded-xl font-bold border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 h-10 px-5 text-xs sm:text-sm"
                    onClick={() => openWorkflowAction(
                      `/api/budget-plans/${plan.id}/workflow`,
                      "reject",
                      "ตีกลับแผนจัดสรรงบประมาณเรียบร้อย",
                      "ตีกลับแผนจัดสรรงบประมาณ",
                      "กรุณาระบุรายละเอียดหรือจุดแก้ไขประกอบการส่งคืนคำร้องแก้ไขแผนจัดสรรงบประจำปีนี้",
                      "ตีกลับแผน",
                      "destructive",
                      true,
                      "เหตุผลการตีกลับ"
                    )}
                  >
                    ตีกลับแผนจัดสรร
                  </Button>
                  <Button
                    disabled={pending}
                    className="rounded-xl font-bold bg-emerald-700 hover:bg-emerald-800 text-white h-10 px-5 active:scale-95 transition-all shadow-md shadow-emerald-700/10 text-xs sm:text-sm"
                    onClick={() => openWorkflowAction(
                      `/api/budget-plans/${plan.id}/workflow`,
                      "approve",
                      "อนุมัติและล็อกแผนจัดสรรงบประมาณประจำปีสำเร็จ",
                      "อนุมัติและล็อกแผนจัดสรรงบประมาณ",
                      "เมื่ออนุมัติแล้ว ระบบจะทำโพสต์ยอดจัดสรรงบ (Allocation Ledger Entry) เข้ากระเป๋างบทั้ง 9 ใบ เพื่อควบคุมยอด และไม่สามารถแก้ไขสัดส่วนเปอร์เซ็นต์ได้โดยตรงหลังจากจุดนี้",
                      "อนุมัติและล็อกแผน",
                      "warning",
                      false,
                      "ความคิดเห็นผู้บริหาร"
                    )}
                  >
                    {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    อนุมัติและล็อกแผน
                  </Button>
                </div>
              </Card>
            </section>
          )}

          {/* 9. Locked Operations: Transfers, Expenses, Migrations */}
          {plan.status === "LOCKED" && (
            <section className="space-y-6">
              {editable && (
                <div className="grid gap-5 lg:grid-cols-2 pt-2">
                  <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-500">swap_horiz</span>
                        เสนอโอนย้ายงบประมาณระหว่างกระเป๋า
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid gap-3 grid-cols-2">
                        <select
                          className="h-10 rounded-xl border bg-background px-3 text-xs font-bold text-slate-650"
                          value={transferForm.fromWalletId}
                          onChange={(event) => setTransferForm({ ...transferForm, fromWalletId: event.target.value })}
                        >
                          <option value="">เลือกกระเป๋าต้นทาง</option>
                          {plan.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <select
                          className="h-10 rounded-xl border bg-background px-3 text-xs font-bold text-slate-650"
                          value={transferForm.toWalletId}
                          onChange={(event) => setTransferForm({ ...transferForm, toWalletId: event.target.value })}
                        >
                          <option value="">เลือกกระเป๋าปลายทาง</option>
                          {plan.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      <Input type="number" min="0.01" step="0.01" placeholder="จำนวนเงินโอน (บาท)" value={transferForm.amount} onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                      <Input placeholder="ระบุเหตุผลการโยกงบประมาณ" value={transferForm.reason} onChange={(event) => setTransferForm({ ...transferForm, reason: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                      <Button
                        className="w-full rounded-xl font-bold bg-violet-750 hover:bg-violet-850 h-10 text-xs sm:text-sm"
                        disabled={pending || !transferForm.fromWalletId || !transferForm.toWalletId || !transferForm.amount || !transferForm.reason}
                        onClick={() => run(() => fetch("/api/budget-transfers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ...transferForm, budgetPlanId: plan.id, amount: Number(transferForm.amount) })
                        }), "ส่งคำเสนอขอโอนงบเรียบร้อยแล้ว")}
                      >
                        ส่งเสนอขอโอนย้ายงบประมาณ
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-500">payments</span>
                        บันทึกคำขออนุมัติค่าใช้จ่ายดำเนินงาน
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid gap-3 grid-cols-2">
                        <select
                          className="h-10 rounded-xl border bg-background px-3 text-xs font-bold text-slate-650 col-span-2"
                          value={expenseForm.walletId}
                          onChange={(event) => setExpenseForm({ ...expenseForm, walletId: event.target.value })}
                        >
                          <option value="">เลือกกระเป๋างบประมาณ</option>
                          {plan.wallets.filter((wallet) => wallet.spendMode === "OPERATING" || wallet.spendMode === "FLEXIBLE").map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                        </select>
                      </div>
                      <div className="grid gap-3 grid-cols-2">
                        <Input type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน (บาท)" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                        <Input placeholder="เลขที่เอกสาร" value={expenseForm.documentNo} onChange={(event) => setExpenseForm({ ...expenseForm, documentNo: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                      </div>
                      <Input placeholder="รายละเอียด/รายการค่าใช้จ่าย" value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} className="rounded-xl h-10 text-xs sm:text-sm font-semibold" />
                      <Button
                        className="w-full rounded-xl font-bold bg-violet-750 hover:bg-violet-850 h-10 text-xs sm:text-sm"
                        disabled={pending || !expenseForm.walletId || !expenseForm.amount || !expenseForm.description}
                        onClick={() => run(() => fetch("/api/operating-expenses", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ...expenseForm, budgetPlanId: plan.id, amount: Number(expenseForm.amount) })
                        }), "ส่งรายละเอียดขออนุมัติค่าใช้จ่ายดำเนินงานสำเร็จ")}
                      >
                        ส่งอนุมัติค่าใช้จ่ายดำเนินงาน
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <RequestList
                  title="ประวัติคำขอโอนงบระหว่างกระเป๋า"
                  rows={plan.transfers.map((item) => ({ id: item.id, title: `${item.fromWalletName} → ${item.toWalletName}`, description: item.reason, amount: item.amount, status: item.status }))}
                  role={role}
                  pending={pending}
                  onAction={(id: string, action: "approve" | "reject" | "pay") =>
                    openWorkflowAction(
                      `/api/budget-transfers/${id}/workflow`,
                      action,
                      action === "approve" ? "อนุมัติคำขอโอนงบประมาณแล้ว" : "ปฏิเสธการโอนงบแล้ว",
                      action === "approve" ? "ยืนยันอนุมัติการโอนงบประมาณ" : "ปฏิเสธคำขอโอนงบประมาณ",
                      action === "approve"
                        ? "คุณแน่ใจว่าต้องการอนุมัติการโอนย้ายงบประมาณในส่วนนี้?"
                        : "ระบุข้อความประกอบการปฏิเสธคำร้องขอโอนงบนี้",
                      action === "approve" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ",
                      action === "approve" ? "default" : "destructive",
                      action !== "approve",
                      "เหตุผลประกอบความเห็น"
                    )
                  }
                />
                <RequestList
                  title="ประวัติค่าใช้จ่ายดำเนินงาน"
                  rows={plan.operatingExpenses.map((item) => ({ id: item.id, title: item.walletName, description: item.description, amount: item.amount, status: item.status }))}
                  role={role}
                  pending={pending}
                  operating
                  onAction={(id: string, action: "approve" | "reject" | "pay") =>
                    openWorkflowAction(
                      `/api/operating-expenses/${id}/workflow`,
                      action,
                      action === "approve" ? "อนุมัติค่าใช้จ่ายดำเนินงานแล้ว" : action === "pay" ? "บันทึกข้อมูลการจ่ายจริงแล้ว" : "ปฏิเสธการจ่ายสำเร็จ",
                      action === "approve" ? "อนุมัติค่าใช้จ่ายดำเนินงาน" : action === "pay" ? "บันทึกจ่ายงบดำเนินงาน" : "ปฏิเสธค่าใช้จ่ายดำเนินงาน",
                      action === "approve"
                        ? "ยืนยันการอนุมัติใบเสนอค่าใช้จ่ายสำหรับกระเป๋าใบนี้?"
                        : action === "pay"
                        ? "ยืนยันว่าดำเนินการจ่ายเงินสำหรับใบงานนี้เสร็จสิ้น?"
                        : "ระบุข้อความประกอบการปฏิเสธยอดดำเนินงานนี้",
                      action === "approve" ? "อนุมัติใบงาน" : action === "pay" ? "ยืนยันบันทึกจ่าย" : "ยืนยันปฏิเสธ",
                      action === "approve" ? "default" : action === "pay" ? "warning" : "destructive",
                      action === "reject",
                      "เหตุผลประกอบความเห็น"
                    )
                  }
                />
              </div>

              {/* Migration reconciliation preview for Super Admin */}
              {role === "SUPER_ADMIN" && (() => {
                const allUnresolvedMapped = migrationPreview
                  ? (migrationPreview.unresolved ?? []).every((u: any) => resolvedMappings[u.projectId])
                  : false;

                const allNegativesCovered = migrationPreview
                  ? (migrationPreview.negativeWallets ?? []).every((w: any) => resolvedCovers[w.code])
                  : false;

                const canConfirmMigration = migrationPreview
                  ? migrationPreview.canConfirm || (allUnresolvedMapped && allNegativesCovered)
                  : false;

                return (
                  <Card className="border border-amber-200 bg-amber-50/10 rounded-2xl overflow-hidden animate-in fade-in duration-300">
                    <CardHeader className="pb-3 border-b border-amber-100 bg-amber-50/40">
                      <CardTitle className="text-sm font-extrabold text-amber-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined">settings_backup_restore</span>
                        การสมานข้อมูลประวัติ (Migration Reconciliation)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      <p className="text-xs text-slate-500 leading-relaxed font-medium font-body-md">
                        ทำการจำลองแผนจับคู่เพื่อย้ายโครงการจากระบบเดิมเข้าสู่โมเดลกระเป๋าใหม่เพื่อรองรับการควบคุมยอด
                      </p>
                      <Button
                        variant="outline"
                        className="rounded-xl font-bold border-amber-200 text-amber-800 hover:bg-amber-50 h-9 text-xs"
                        disabled={pending}
                        onClick={() => startTransition(async () => {
                          setError(null);
                          const response = await fetch("/api/budget-migrations/preview", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ budgetPlanId: plan.id })
                          });
                          const data = await response.json();
                          if (!response.ok) setError(data.error);
                          else {
                            setMigrationPreview(data);
                            setResolvedMappings({});
                            setResolvedCovers({});
                          }
                        })}
                      >
                        สร้าง Migration Preview
                      </Button>

                      {migrationPreview && (
                        <div className="rounded-xl border bg-white p-4 space-y-4">
                          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 text-xs">
                            <BalanceStat label="โครงการเดิม" value={migrationPreview.projectCount} emphasize />
                            <BalanceStat label="จัดสรรเดิม" value={migrationPreview.legacyAllocation} />
                            <BalanceStat label="จ่ายเดิม" value={migrationPreview.legacyExpense} />
                            <BalanceStat label="รายการค้างแก้" value={(migrationPreview.unresolved?.length ?? 0) + (migrationPreview.negativeWallets?.length ?? 0)} tone="red" emphasize={!canConfirmMigration} />
                          </div>

                          {migrationPreview.unresolved?.length > 0 && (
                            <div className="rounded-xl border border-red-100 bg-red-50/30 p-4 space-y-3">
                              <h3 className="font-bold text-red-800 text-xs">ระบุกระเป๋ารับเงินสำหรับโครงการที่จับคู่เดิมไม่ได้ ({migrationPreview.unresolved.length} รายการ):</h3>
                              <div className="space-y-2">
                                {migrationPreview.unresolved.map((proj: any) => (
                                  <div key={proj.projectId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-white p-3 shadow-sm text-xs">
                                    <div className="min-w-0">
                                      <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/50 mr-2">{proj.projectCode}</span>
                                      <span className="font-bold text-slate-700">{proj.projectName}</span>
                                    </div>
                                    <select
                                      className="h-9 w-full sm:w-60 rounded-lg border bg-background px-2.5 text-xs font-bold text-slate-600"
                                      value={resolvedMappings[proj.projectId] || ""}
                                      onChange={(e) => setResolvedMappings({ ...resolvedMappings, [proj.projectId]: e.target.value as WalletCode })}
                                    >
                                      <option value="">เลือกกระเป๋าเงินเพื่อจับคู่...</option>
                                      {plan.wallets.map((w) => (
                                        <option key={w.id} value={w.code}>{w.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {migrationPreview.negativeWallets?.length > 0 && (
                            <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 space-y-3">
                              <h3 className="font-bold text-amber-800 text-xs">เลือกแหล่งกระเป๋าโอนชดเชยสำหรับกระเป๋าที่มีแนวโน้มติดลบ:</h3>
                              <div className="space-y-2">
                                {migrationPreview.negativeWallets.map((wallet: any) => (
                                  <div key={wallet.code} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-white p-3 shadow-sm text-xs">
                                    <div>
                                      <span className="font-bold text-slate-700">{wallet.name}</span>
                                      <span className="text-red-600 font-extrabold ml-2">ขาดอีก {formatBaht(Math.abs(wallet.projectedAvailable))}</span>
                                    </div>
                                    <select
                                      className="h-9 w-full sm:w-60 rounded-lg border bg-background px-2.5 text-xs font-bold text-slate-600"
                                      value={resolvedCovers[wallet.code] || ""}
                                      onChange={(e) => setResolvedCovers({ ...resolvedCovers, [wallet.code]: e.target.value as WalletCode })}
                                    >
                                      <option value="">เลือกกระเป๋าชดเชย...</option>
                                      {plan.wallets
                                        .filter((w) => w.code !== wallet.code)
                                        .map((w) => (
                                          <option key={w.id} value={w.code}>{w.name}</option>
                                        ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {canConfirmMigration && (
                            <Button
                              className="rounded-xl font-bold bg-amber-700 hover:bg-amber-800 h-10 px-5 active:scale-95 transition-all shadow-md shadow-amber-800/10 text-xs"
                              onClick={() => {
                                setMigrationReason("");
                                setMigrationReasonError(null);
                                setIsMigrationConfirmOpen(true);
                              }}
                            >
                              ยืนยันการทำ Migration
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </section>
          )}
        </div>

        {/* 10. Right Side Sticky Panel */}
        <aside className="sticky top-6 flex flex-col gap-6">
          <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden p-5 space-y-4">
            <h3 className="text-slate-800 text-sm font-extrabold flex items-center gap-1.5 border-b pb-2">
              <span className="material-symbols-outlined text-violet-750">insights</span>
              สรุปแผนจัดสรร
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200/40 rounded-xl text-center">
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">อัตราการจัดสรรเฉลี่ย</p>
                <div className="flex items-baseline justify-center gap-1">
                  <p className={cn("text-3xl font-black", isFormulaValid ? "text-emerald-700" : "text-amber-600")}>
                    {isFormulaValid ? "100%" : "ยังไม่สมบูรณ์"}
                  </p>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
                  <div className={cn("h-full transition-all duration-500", isFormulaValid ? "bg-emerald-500" : "bg-amber-400")} style={{ width: isFormulaValid ? "100%" : "30%" }} />
                </div>
              </div>

              <div className="space-y-2 px-1 text-xs font-semibold text-slate-500">
                <div className="flex justify-between items-center">
                  <span>งบรายรับรวม</span>
                  <span className="font-bold font-mono text-slate-850">{formatBaht(totalFundAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>จำนวนแหล่งเงิน</span>
                  <span className="font-bold text-slate-850">3 บัญชี</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>จำนวนกระเป๋าเงิน</span>
                  <span className="font-bold text-slate-850">9 กระเป๋า</span>
                </div>
                {plan.status === "LOCKED" && (
                  <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[11px]">
                    <span>สถานะการเงิน</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-black border border-emerald-200/50">มั่นคง</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Navigation/Actions helper */}
          <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden p-5 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">ลิงก์เมนูลัดช่วยเหลือ</h4>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="justify-between rounded-xl h-11 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 text-left font-bold px-4">
                <Link href="/budget">
                  <span className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-violet-750" />
                    ไปหน้าสรุปงบประมาณรวม
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between rounded-xl h-11 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 text-left font-bold px-4">
                <Link href="/projects">
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-violet-750" />
                    ดูโครงการโรงเรียนทั้งหมด
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </Button>
            </div>
          </Card>
        </aside>
      </section>
    </div>
  );
}

// Subcomponents helper to prevent messy structures
function StepTitle({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-sm font-black text-white shadow-sm shadow-violet-700/20">
        {number}
      </div>
      <div>
        <h2 className="font-extrabold text-slate-800 text-base">{title}</h2>
        <p className="text-xs sm:text-sm text-slate-400 font-medium font-body-md mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ChecklistItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-105 bg-slate-50/10 p-3.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50/40">
      <div className={cn(
        "rounded-full p-0.5 flex items-center justify-center shrink-0 border",
        checked ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-650"
      )}>
        {checked ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </div>
      <span className="leading-snug">{label}</span>
    </div>
  );
}

function CreatePlanCard({
  academicYears,
  fiscalYears,
  pending,
  error,
  onCreate,
}: {
  academicYears: YearOption[];
  fiscalYears: YearOption[];
  pending: boolean;
  error: string | null;
  onCreate: (payload: { academicYearId: string; fiscalYearId: string; name: string }) => void;
}) {
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id ?? "");
  const [fiscalYearId, setFiscalYearId] = useState(fiscalYears[0]?.id ?? "");
  const [name, setName] = useState("แผนจัดสรรงบประมาณประจำปี");

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight sm:text-3xl">
          เริ่มแผนจัดสรรกระเป๋าเงินงบประมาณ
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
          สร้างรอบแผนเพื่อแยกจัดสรรเงินลงกระเป๋าทางบัญชี แผนจะยังคงเป็นแบบร่างและไม่มีผลจนกว่าผู้บริหารจะกดยืนยันอนุมัติ
        </p>
      </div>

      {error && <StatusAlert variant="error">{error}</StatusAlert>}

      <Card className="shadow-lg shadow-slate-200/50 border-slate-200 bg-white rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/30">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-700">
            <Landmark className="h-5 w-5 text-violet-750" />
            ข้อมูลรายละเอียดรอบแผนประจำปี
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">ปีการศึกษา</span>
              <select
                className="h-10 w-full rounded-xl border bg-background px-3 text-xs sm:text-sm font-bold text-slate-700"
                value={academicYearId}
                onChange={(event) => setAcademicYearId(event.target.value)}
              >
                {academicYears.map((year) => <option key={year.id} value={year.id}>{year.yearName}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">ปีงบประมาณ</span>
              <select
                className="h-10 w-full rounded-xl border bg-background px-3 text-xs sm:text-sm font-bold text-slate-700"
                value={fiscalYearId}
                onChange={(event) => setFiscalYearId(event.target.value)}
              >
                {fiscalYears.map((year) => <option key={year.id} value={year.id}>{year.yearName}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">ชื่อโครงการแผนการจัดสรร</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl h-11 text-xs sm:text-sm font-semibold"
              placeholder="เช่น แผนการจัดสรรประจำปีการศึกษา 2569"
            />
          </div>

          <div className="pt-2">
            <Button
              className="w-full rounded-xl font-bold bg-violet-700 hover:bg-violet-850 h-11 text-xs sm:text-sm active:scale-[0.99] transition-all shadow-md shadow-violet-750/10"
              disabled={pending || !academicYearId || !fiscalYearId || !name.trim()}
              onClick={() => onCreate({ academicYearId, fiscalYearId, name })}
            >
              {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              สร้างรอบแผนจัดสรรฉบับร่าง
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStatCard({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "violet" | "blue" | "gold" | "purple" | "slate";
}) {
  const borderBg = {
    violet: "border-l-violet-600 bg-white border-l-4",
    blue: "border-l-indigo-500 bg-white border-l-4",
    gold: "border-l-amber-500 bg-white border-l-4",
    purple: "border-l-purple-600 bg-white border-l-4",
    slate: "border-l-slate-400 bg-white border-l-4",
  }[tone];

  const iconColor = {
    violet: "text-violet-700 bg-violet-50",
    blue: "text-indigo-605 bg-indigo-50",
    gold: "text-amber-700 bg-amber-50",
    purple: "text-purple-700 bg-purple-50",
    slate: "text-slate-600 bg-slate-55",
  }[tone];

  return (
    <Card className={cn("overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm min-h-[110px] flex flex-col justify-between hover:shadow-md transition-shadow", borderBg)}>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{label}</span>
          <div className={cn("rounded-lg p-1.5", iconColor)}>
            <Coins className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-base sm:text-lg font-mono font-black text-slate-800">{formatBaht(value)}</p>
          <p className="mt-0.5 text-[9px] sm:text-[10px] font-medium text-slate-400 truncate">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryQuotaCard({ complete }: { complete: boolean; allocatedPercent?: number }) {
  return (
    <Card className={cn(
      "overflow-hidden rounded-2xl border shadow-sm min-h-[110px] flex flex-col justify-between border-l-4 hover:shadow-md transition-shadow",
      complete ? "border-l-emerald-500 bg-white" : "border-l-red-500 bg-white"
    )}>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">จัดสรรครบถ้วน</span>
          <div className={cn(
            "rounded-lg p-1.5",
            complete ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
          )}>
            {complete ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
        </div>
        <div className="mt-2">
          <p className={cn("text-base sm:text-lg font-black", complete ? "text-emerald-700" : "text-red-600")}>
            {complete ? "100%" : "ยังไม่ครบ"}
          </p>
          <p className="mt-0.5 text-[9px] sm:text-[10px] font-medium text-slate-400 truncate">
            {complete ? "สูตรจัดสรรสะสมครบถ้วน" : "กรุณาปรับสูตรให้รวมครบ 100%"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowStepper({ status }: { status: string }) {
  const steps = [
    { label: "ตั้งค่าแผน", desc: "สร้างโครงร่างแผนจัดสรร" },
    { label: "ระบุแหล่งเงิน", desc: "นำเข้ายอดอุดหนุน/รายได้" },
    { label: "กำหนดสูตรจัดสรร", desc: "แบ่งสัดส่วนดำเนินงานและคุณภาพ" },
    { label: "ตรวจสอบกระเป๋างบ", desc: "ตรวจสอบยอดคาดการณ์รายกระเป๋า" },
    { label: "ส่งอนุมัติ / ล็อกแผน", desc: "ผู้บริหารพิจารณาล็อกแผน" },
  ];

  let currentStep = 0;
  if (status === "DRAFT" || status === "REJECTED") {
    currentStep = 2; // Formula/funds phase
  } else if (status === "SUBMITTED") {
    currentStep = 3; // Review phase
  } else if (status === "LOCKED") {
    currentStep = 4; // Locked phase
  }

  return (
    <div className="w-full bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep || status === "LOCKED";
          const isActive = idx === currentStep && status !== "LOCKED";
          return (
            <div key={idx} className="flex flex-col gap-2 relative">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center border transition-colors",
                  isCompleted ? "bg-emerald-500 border-emerald-500 text-white" :
                  isActive ? "bg-primary border-primary text-white shadow-sm shadow-primary/20 ring-4 ring-primary-container/10" :
                  "bg-slate-50 border-slate-200 text-slate-400"
                )}>
                  {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={cn(
                  "text-xs font-bold",
                  isCompleted ? "text-slate-800" :
                  isActive ? "text-primary" :
                  "text-slate-400"
                )}>
                  {step.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium pl-9 leading-snug">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BalanceStat({
  label,
  value,
  tone = "slate",
  emphasize = false,
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "gold" | "red" | "green";
  emphasize?: boolean;
}) {
  const isCount = label.includes("จำนวน") || label.includes("โครงการ") || label.includes("รายการ");
  const displayValue = typeof value === "number"
    ? (isCount ? value.toLocaleString() : formatBaht(value))
    : value;

  const bgClasses = {
    slate: emphasize ? "bg-slate-50 border-slate-200" : "bg-slate-50/40 border-slate-100",
    gold: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-emerald-50 border-emerald-200 text-emerald-800",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-2 text-left", bgClasses)}>
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</div>
      <div className={cn("mt-0.5 font-mono font-bold text-xs sm:text-sm", tone === "slate" && "text-slate-800")}>
        {displayValue}
      </div>
    </div>
  );
}

function RequestList({
  title,
  rows,
  role,
  pending,
  operating = false,
  onAction,
}: {
  title: string;
  rows: Array<{ id: string; title: string; description: string; amount: number; status: string }>;
  role: string;
  pending: boolean;
  operating?: boolean;
  onAction: (id: string, action: "approve" | "reject" | "pay") => void;
}) {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactNode> = {
      PENDING_APPROVAL: <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-amber-200/50">รออนุมัติ</span>,
      APPROVED: <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-emerald-200/50">อนุมัติแล้ว</span>,
      REJECTED: <span className="bg-rose-100 text-rose-850 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-rose-200/50">ปฏิเสธ</span>,
      PAID: <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-blue-200/50">จ่ายแล้ว</span>,
    };
    return badges[status] || <span className="bg-slate-100 text-slate-800 text-[10px] px-2.5 py-0.5 rounded-full font-black">{status}</span>;
  };

  return (
    <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-slate-500">list_alt</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-105 p-3.5 space-y-3 hover:bg-slate-50/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-slate-800 text-xs sm:text-sm truncate">{row.title}</div>
                <div className="text-[11px] text-slate-450 font-semibold leading-relaxed mt-0.5 font-body-md truncate">{row.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-xs sm:text-sm text-slate-800">{formatBaht(row.amount)}</div>
                <div className="mt-1">{getStatusBadge(row.status)}</div>
              </div>
            </div>

            {/* Actions for Executive / Super Admin */}
            {(role === "SUPER_ADMIN" || role === "EXECUTIVE") && row.status === "PENDING_APPROVAL" && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg font-bold border-red-200 text-red-700 hover:bg-red-50 text-[11px] h-8 px-3"
                  disabled={pending}
                  onClick={() => onAction(row.id, "reject")}
                >
                  ปฏิเสธ
                </Button>
                <Button
                  size="sm"
                  className="rounded-lg font-bold bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] h-8 px-3"
                  disabled={pending}
                  onClick={() => onAction(row.id, "approve")}
                >
                  อนุมัติ
                </Button>
              </div>
            )}

            {/* Payment action for Finance */}
            {operating && (role === "SUPER_ADMIN" || role === "FINANCE") && row.status === "APPROVED" && (
              <div className="flex justify-end pt-2 border-t border-slate-100/50">
                <Button
                  size="sm"
                  className="rounded-lg font-bold bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-8 px-3"
                  disabled={pending}
                  onClick={() => onAction(row.id, "pay")}
                >
                  บันทึกจ่าย
                </Button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-center py-8 text-slate-400 font-medium">
            <p className="text-[11px]">ยังไม่มีรายการบันทึกประวัติ</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
