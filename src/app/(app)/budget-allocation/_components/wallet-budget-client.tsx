"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDollarSign, Landmark, LockKeyhole, Send, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import { formatBaht } from "@/lib/utils";
import { DEFAULT_WALLET_FORMULA, WalletCode, WalletFormula, calculateWalletAllocationPreview, deriveEffectiveWalletPercentages, normalizeWalletFormula } from "@/lib/budget-wallets";

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

const OPERATING_FORMULA_CODES = ["RESERVE", "UTILITIES", "CENTRAL"] as const;
const QUALITY_FORMULA_CODES = ["ACADEMIC", "BUDGET", "PERSONNEL", "GENERAL"] as const;

function toDateInputValue(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
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
  const [formula, setFormula] = useState<WalletFormula>(() => normalizeWalletFormula(plan?.formula ?? DEFAULT_WALLET_FORMULA));
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
    action: "approve" | "reject" | "pay";
    successMessage: string;
    title: string;
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
    action: "approve" | "reject" | "pay",
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
    action: "approve" | "reject" | "pay",
    successMessage: string,
    title: string,
  ) => {
    if (action !== "reject") {
      runWorkflowAction(endpoint, action, successMessage);
      return;
    }

    setWorkflowReason("");
    setWorkflowReasonError(null);
    setWorkflowAction({ endpoint, action, successMessage, title });
  };

  const confirmWorkflowAction = () => {
    if (!workflowAction) return;
    const reason = workflowReason.trim();
    if (!reason) {
      setWorkflowReasonError("กรุณาระบุเหตุผลที่ปฏิเสธ");
      return;
    }

    const current = workflowAction;
    setWorkflowAction(null);
    setWorkflowReason("");
    setWorkflowReasonError(null);
    runWorkflowAction(current.endpoint, current.action, current.successMessage, reason);
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

  if (!plan) {
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

  const sourceNet = (code: string) => plan.sourceAccounts.find((source) => source.code === code)?.net ?? 0;
  const previewState = calculateWalletAllocationPreview({
    generalSubsidyNet: sourceNet("GENERAL_SUBSIDY"),
    learnerActivityNet: sourceNet("LEARNER_ACTIVITY"),
    schoolIncomeNet: sourceNet("SCHOOL_INCOME"),
    formula,
  });
  const preview = previewState.allocations;
  const topLevelTotal = formula.operatingPercent + formula.qualityPercent;
  const operatingTotal = Object.values(formula.operating).reduce((sum, value) => sum + value, 0);
  const qualityTotal = Object.values(formula.quality).reduce((sum, value) => sum + value, 0);
  const editable = role === "SUPER_ADMIN" || role === "FINANCE";
  const canApprove = role === "SUPER_ADMIN" || role === "EXECUTIVE";
  const hasValidPreview = preview !== null;
  const effectivePercentages = hasValidPreview ? deriveEffectiveWalletPercentages(formula) : null;

  return (
    <div className="space-y-6">
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
        description="กรุณาระบุเหตุผลเพื่อบันทึกประกอบการปฏิเสธ"
        confirmLabel="ยืนยันปฏิเสธ"
        variant="warning"
        loading={pending}
        error={workflowReasonError}
        reasonLabel="เหตุผลที่ปฏิเสธ"
        reasonValue={workflowReason}
        reasonPlaceholder="เช่น ยอดเงินไม่ถูกต้อง หรือเอกสารประกอบไม่ครบ"
        reasonRequired
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

      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-xl">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"><WalletCards className="h-4 w-4" /> School Budget Wallets</div>
            <h1 className="text-2xl font-bold">{plan.name}</h1>
            <p className="mt-2 text-sm text-slate-300">ปีการศึกษา {plan.academicYearName} · ปีงบประมาณ {plan.fiscalYearName}</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur">
            <div className="text-xs text-slate-300">สถานะแผน</div>
            <div className="mt-1 font-bold text-emerald-300">{plan.status}</div>
          </div>
        </div>
      </div>

      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {success && <StatusAlert variant="success">{success}</StatusAlert>}

      <section className="space-y-3">
        <StepTitle number="1" title="แหล่งเงินและยอดสุทธิ" description="บันทึกรายรับ ยอดยกมา รายการหัก และการแก้ไขที่ตรวจย้อนหลังได้" />
        <div className="grid gap-4 lg:grid-cols-3">
          {plan.sourceAccounts.map((source) => (
            <Card key={source.id} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">{SOURCE_LABELS[source.code] ?? source.name}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">{formatBaht(source.net)}</div>
                <div className="mt-1 text-xs text-muted-foreground">ยอดสุทธิ · {source.entries.length} รายการ</div>
                <div className="mt-4 space-y-3 border-t pt-3">
                  {source.entries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border bg-background p-3 text-xs">
                      {editingEntryId === entry.id ? (
                        <div className="grid gap-2">
                          <select className="h-9 rounded-md border bg-background px-2 text-xs" value={editEntryForm.entryType} onChange={(event) => setEditEntryForm({ ...editEntryForm, entryType: event.target.value })}>
                            {Object.entries(ENTRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input type="number" min="0.01" step="0.01" value={editEntryForm.amount} onChange={(event) => setEditEntryForm({ ...editEntryForm, amount: event.target.value })} />
                            <Input type="date" value={editEntryForm.entryDate} onChange={(event) => setEditEntryForm({ ...editEntryForm, entryDate: event.target.value })} />
                          </div>
                          <Input value={editEntryForm.description} onChange={(event) => setEditEntryForm({ ...editEntryForm, description: event.target.value })} />
                          <Input value={editEntryForm.documentNo} placeholder="เลขที่เอกสาร" onChange={(event) => setEditEntryForm({ ...editEntryForm, documentNo: event.target.value })} />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditingEntryId(null)}>ยกเลิก</Button>
                            <Button
                              size="sm"
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
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-muted-foreground">{ENTRY_LABELS[entry.entryType]} · {entry.description}</div>
                              {entry.documentNo && <div className="mt-1 text-[11px] text-muted-foreground">เลขที่เอกสาร: {entry.documentNo}</div>}
                            </div>
                            <span className="shrink-0 font-mono">{formatBaht(entry.amount)}</span>
                          </div>
                          {editable && plan.status === "DRAFT" && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" disabled={pending} onClick={() => beginEditEntry(entry)}>แก้ไข</Button>
                              <Button size="sm" variant="destructive" disabled={pending} onClick={() => deleteEntry(entry.id)}>ลบ</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {source.entries.length === 0 && <p className="text-xs text-muted-foreground">ยังไม่มีรายการ</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {editable && plan.status === "DRAFT" && (
          <Card><CardContent className="grid gap-3 p-4 md:grid-cols-5">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={entryForm.sourceCode} onChange={(event) => setEntryForm({ ...entryForm, sourceCode: event.target.value })}>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={entryForm.entryType} onChange={(event) => setEntryForm({ ...entryForm, entryType: event.target.value })}>
              {Object.entries(ENTRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Input type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน" value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} />
            <Input placeholder="รายละเอียด/ที่มา" value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} />
            <Button disabled={pending || !entryForm.amount || !entryForm.description} onClick={() => run(() => fetch(`/api/budget-plans/${plan.id}/source-entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entryForm, amount: Number(entryForm.amount) }) }), "บันทึกรายการแหล่งเงินแล้ว")}>เพิ่มรายการ</Button>
          </CardContent></Card>
        )}
      </section>

      <section className="space-y-3">
        <StepTitle number="2" title="สูตรจัดสรร 2 ชั้น" description="แบ่งงบดำเนินงานและงบพัฒนาคุณภาพก่อน แล้วจึงแบ่งย่อยภายในแต่ละส่วน" />
        <Card><CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">งบดำเนินงาน</span>
              <div className="relative"><Input type="number" step="0.01" min="0" disabled={!editable || plan.status !== "DRAFT"} value={formula.operatingPercent} onChange={(event) => setFormula({ ...formula, operatingPercent: Number(event.target.value) })} /><span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">งบพัฒนาคุณภาพการศึกษา 4 กลุ่มบริหาร</span>
              <div className="relative"><Input type="number" step="0.01" min="0" disabled={!editable || plan.status !== "DRAFT"} value={formula.qualityPercent} onChange={(event) => setFormula({ ...formula, qualityPercent: Number(event.target.value) })} /><span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div>
            </label>
          </div>
          <div className="mt-5 grid gap-5 border-t pt-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">แบ่งย่อยงบดำเนินงาน</h3>
                <span className={Math.abs(operatingTotal - 100) < 0.0001 ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-600"}>รวม {operatingTotal.toFixed(2)}%</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {OPERATING_FORMULA_CODES.map((code) => (
                  <label key={code} className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{WALLET_LABELS[code]}</span>
                    <div className="relative"><Input type="number" step="0.01" min="0" disabled={!editable || plan.status !== "DRAFT"} value={formula.operating[code]} onChange={(event) => setFormula({ ...formula, operating: { ...formula.operating, [code]: Number(event.target.value) } })} /><span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">แบ่งย่อยงบพัฒนาคุณภาพ</h3>
                <span className={Math.abs(qualityTotal - 100) < 0.0001 ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-600"}>รวม {qualityTotal.toFixed(2)}%</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {QUALITY_FORMULA_CODES.map((code) => (
                  <label key={code} className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{WALLET_LABELS[code]}</span>
                    <div className="relative"><Input type="number" step="0.01" min="0" disabled={!editable || plan.status !== "DRAFT"} value={formula.quality[code]} onChange={(event) => setFormula({ ...formula, quality: { ...formula.quality, [code]: Number(event.target.value) } })} /><span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className={Math.abs(topLevelTotal - 100) < 0.0001 ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-600"}>รวมส่วนหลัก {topLevelTotal.toFixed(2)}%</span>
            {editable && plan.status === "DRAFT" && <Button variant="outline" disabled={pending || !hasValidPreview} onClick={() => run(() => fetch(`/api/budget-plans/${plan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formula }) }), "บันทึกสูตรแล้ว")}>บันทึกสูตร</Button>}
          </div>
          {previewState.error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              สูตรจัดสรรยังไม่ถูกต้อง: ส่วนหลัก และแต่ละกลุ่มย่อยต้องรวม 100% ก่อนจึงจะคำนวณ preview หรือส่งอนุมัติได้
            </div>
          )}
        </CardContent></Card>
      </section>

      <section className="space-y-3">
        <StepTitle number="3" title="Preview กระเป๋าเงิน 9 กระเป๋า" description="ตรวจยอดก่อนส่งอนุมัติ ไม่มีการ post ledger ในขั้นนี้" />
        {preview ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(preview) as Array<[WalletCode, number]>).map(([code, amount]) => (
              <Card key={code} className="overflow-hidden"><CardContent className="flex items-center justify-between p-4"><div><div className="text-sm font-semibold">{WALLET_LABELS[code]}</div><div className="mt-1 text-xs text-muted-foreground">{code === "LEARNER_ACTIVITY" || code === "SCHOOL_INCOME" ? "รับยอดตรงจากแหล่งเงิน" : `${(effectivePercentages?.[code] ?? 0).toFixed(2)}% ของเงินอุดหนุนสุทธิ`}</div></div><div className="font-mono text-lg font-bold text-emerald-700">{formatBaht(amount)}</div></CardContent></Card>
            ))}
          </div>
        ) : (
          <Card className="border-red-200 bg-red-50/60"><CardContent className="p-4 text-sm text-red-700">ยังไม่สามารถแสดง preview ได้ กรุณาปรับสูตรจัดสรรให้รวมครบ 100%</CardContent></Card>
        )}
      </section>

      <section className="space-y-3">
        <StepTitle number="4" title="อนุมัติและล็อกแผน" description="หลังล็อกแล้วแก้สูตรตรงไม่ได้ ต้องใช้คำขอโอนหรือปรับงบ" />
        <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3"><LockKeyhole className="h-8 w-8 text-slate-500" /><div><div className="font-semibold">ยอดรวมทุกกระเป๋า {formatBaht(preview ? Object.values(preview).reduce((sum, amount) => sum + amount, 0) : 0)}</div><div className="text-xs text-muted-foreground">ตรวจยอดแหล่งเงินและสูตรให้เรียบร้อยก่อนส่ง</div></div></div>
          <div className="flex gap-2">
            {editable && (plan.status === "DRAFT" || plan.status === "REJECTED") && <Button disabled={pending || !hasValidPreview} onClick={() => run(() => fetch(`/api/budget-plans/${plan.id}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) }), "ส่งแผนให้ผู้บริหารแล้ว")}><Send className="mr-2 h-4 w-4" />ส่งอนุมัติ</Button>}
            {canApprove && plan.status === "SUBMITTED" && <Button disabled={pending || !hasValidPreview} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => run(() => fetch(`/api/budget-plans/${plan.id}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) }), "อนุมัติและล็อกแผนแล้ว")}><CheckCircle2 className="mr-2 h-4 w-4" />อนุมัติและล็อก</Button>}
          </div>
        </CardContent></Card>
      </section>

      {plan.status === "LOCKED" && (
        <section className="space-y-3">
          <StepTitle number="5" title="สถานะกระเป๋าที่ใช้งานจริง" description="แยกยอดทางบัญชี ยอดผูกพัน และยอดพร้อมใช้" />
          <div className="grid gap-4 lg:grid-cols-3">
            {plan.wallets.map((wallet) => (
              <Link key={wallet.id} href={`/budget-wallets/${wallet.id}`} className="group">
                <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-emerald-300 group-hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between"><div><div className="font-semibold">{wallet.name}</div><div className="mt-1 text-xs text-muted-foreground">{wallet.spendMode}</div></div><CircleDollarSign className="h-5 w-5 text-emerald-600" /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Balance label="จัดสรร" value={wallet.balance.allocated} /><Balance label="ผูก/กันไว้" value={wallet.balance.committed} /><Balance label="จ่ายสุทธิ" value={wallet.balance.netDisbursed} /><Balance label="พร้อมใช้" value={wallet.balance.availableBalance} emphasize /></div><div className="mt-4 flex items-center justify-end text-xs font-semibold text-emerald-700">ดู statement <ArrowRight className="ml-1 h-3.5 w-3.5" /></div></CardContent></Card>
              </Link>
            ))}
          </div>

          {(role === "SUPER_ADMIN" || role === "FINANCE") && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">เสนอโยกงบระหว่างกระเป๋า</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={transferForm.fromWalletId} onChange={(event) => setTransferForm({ ...transferForm, fromWalletId: event.target.value })}><option value="">กระเป๋าต้นทาง</option>{plan.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={transferForm.toWalletId} onChange={(event) => setTransferForm({ ...transferForm, toWalletId: event.target.value })}><option value="">กระเป๋าปลายทาง</option>{plan.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
                <Input type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน" value={transferForm.amount} onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })} />
                <Input placeholder="เหตุผลการโยก" value={transferForm.reason} onChange={(event) => setTransferForm({ ...transferForm, reason: event.target.value })} />
                <Button className="sm:col-span-2" disabled={pending || !transferForm.fromWalletId || !transferForm.toWalletId || !transferForm.amount || !transferForm.reason} onClick={() => run(() => fetch("/api/budget-transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...transferForm, budgetPlanId: plan.id, amount: Number(transferForm.amount) }) }), "ส่งคำขอโอนงบแล้ว")}>ส่งให้ผู้บริหารอนุมัติ</Button>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">ค่าใช้จ่ายดำเนินงาน</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
                <select className="h-10 rounded-md border bg-background px-3 text-sm sm:col-span-2" value={expenseForm.walletId} onChange={(event) => setExpenseForm({ ...expenseForm, walletId: event.target.value })}><option value="">เลือกกระเป๋า</option>{plan.wallets.filter((wallet) => wallet.spendMode === "OPERATING" || wallet.spendMode === "FLEXIBLE").map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
                <Input type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} />
                <Input placeholder="เลขที่เอกสาร" value={expenseForm.documentNo} onChange={(event) => setExpenseForm({ ...expenseForm, documentNo: event.target.value })} />
                <Input className="sm:col-span-2" placeholder="รายละเอียดค่าใช้จ่าย" value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} />
                <Button className="sm:col-span-2" disabled={pending || !expenseForm.walletId || !expenseForm.amount || !expenseForm.description} onClick={() => run(() => fetch("/api/operating-expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...expenseForm, budgetPlanId: plan.id, amount: Number(expenseForm.amount) }) }), "ส่งค่าใช้จ่ายให้ผู้บริหารอนุมัติแล้ว")}>ส่งอนุมัติค่าใช้จ่าย</Button>
              </CardContent></Card>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <RequestList
              title="คำขอโอนงบ"
              rows={plan.transfers.map((item) => ({ id: item.id, title: `${item.fromWalletName} → ${item.toWalletName}`, description: item.reason, amount: item.amount, status: item.status }))}
              role={role}
              pending={pending}
              onAction={(id, action) =>
                openWorkflowAction(
                  `/api/budget-transfers/${id}/workflow`,
                  action,
                  action === "approve" ? "อนุมัติการโอนงบแล้ว" : "ปฏิเสธการโอนงบแล้ว",
                  "ปฏิเสธการโอนงบ",
                )
              }
            />
            <RequestList
              title="ค่าใช้จ่ายดำเนินงาน"
              rows={plan.operatingExpenses.map((item) => ({ id: item.id, title: item.walletName, description: item.description, amount: item.amount, status: item.status }))}
              role={role}
              pending={pending}
              operating
              onAction={(id, action) =>
                openWorkflowAction(
                  `/api/operating-expenses/${id}/workflow`,
                  action,
                  action === "approve" ? "อนุมัติค่าใช้จ่ายแล้ว" : action === "pay" ? "บันทึกจ่ายแล้ว" : "ปฏิเสธค่าใช้จ่ายแล้ว",
                  "ปฏิเสธค่าใช้จ่ายดำเนินงาน",
                )
              }
            />
          </div>

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
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="text-base">Migration reconciliation ข้อมูลเดิม</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">สร้าง preview ก่อนย้าย 58 โครงการ ระบบจะบล็อกหากมีรายการจับคู่ไม่ได้หรือกระเป๋าติดลบ</p>
                  <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { setError(null); const response = await fetch("/api/budget-migrations/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budgetPlanId: plan.id }) }); const data = await response.json(); if (!response.ok) setError(data.error); else { setMigrationPreview(data); setResolvedMappings({}); setResolvedCovers({}); } })}>สร้าง migration preview</Button>
                  
                  {migrationPreview && (
                    <div className="rounded-xl border bg-background p-4 text-sm space-y-4">
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Balance label="โครงการเดิม" value={migrationPreview.projectCount} />
                        <Balance label="จัดสรรเดิม" value={migrationPreview.legacyAllocation} />
                        <Balance label="จ่ายเดิม" value={migrationPreview.legacyExpense} />
                        <Balance label="รายการแก้ไข" value={(migrationPreview.unresolved?.length ?? 0) + (migrationPreview.negativeWallets?.length ?? 0)} emphasize={!canConfirmMigration} />
                      </div>

                      {migrationPreview.unresolved?.length > 0 && (
                        <div className="rounded-xl border border-red-100 bg-red-50/30 p-4">
                          <h3 className="font-bold text-red-800 mb-2">จับคู่กระเป๋าเงินสำหรับ {migrationPreview.unresolved.length} โครงการที่จับคู่ไม่ได้:</h3>
                          <div className="space-y-3">
                            {migrationPreview.unresolved.map((proj: any) => (
                              <div key={proj.projectId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-background p-3 shadow-sm">
                                <div className="text-xs text-left">
                                  <span className="inline-flex rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-muted-foreground mr-1.5">{proj.projectCode}</span>
                                  <span className="font-semibold text-foreground">{proj.projectName || "ไม่ระบุชื่อโครงการ"}</span>
                                </div>
                                <select
                                  className="h-9 w-full sm:w-64 rounded-md border bg-background px-2.5 text-xs"
                                  value={resolvedMappings[proj.projectId] || ""}
                                  onChange={(e) => setResolvedMappings({ ...resolvedMappings, [proj.projectId]: e.target.value as WalletCode })}
                                >
                                  <option value="">เลือกกระเป๋าเงิน...</option>
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
                        <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4">
                          <h3 className="font-bold text-amber-800 mb-2">เลือกแหล่งเงินโอนชดเชยสำหรับกระเป๋าที่ยอดเงินติดลบ:</h3>
                          <div className="space-y-3">
                            {migrationPreview.negativeWallets.map((wallet: any) => (
                              <div key={wallet.code} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-background p-3 shadow-sm">
                                <div className="text-xs text-left">
                                  <span className="font-semibold text-foreground">{wallet.name}</span>
                                  <span className="text-red-600 font-bold ml-2">ขาดอีก {formatBaht(Math.abs(wallet.projectedAvailable))}</span>
                                </div>
                                <select
                                  className="h-9 w-full sm:w-64 rounded-md border bg-background px-2.5 text-xs"
                                  value={resolvedCovers[wallet.code] || ""}
                                  onChange={(e) => setResolvedCovers({ ...resolvedCovers, [wallet.code]: e.target.value as WalletCode })}
                                >
                                  <option value="">เลือกกระเป๋าต้นทางเพื่อชดเชย...</option>
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
                          className="mt-4"
                          onClick={() => {
                            setMigrationReason("");
                            setMigrationReasonError(null);
                            setIsMigrationConfirmOpen(true);
                          }}
                        >
                          ยืนยัน migration
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
  );
}

function CreatePlanCard({ academicYears, fiscalYears, pending, error, onCreate }: { academicYears: YearOption[]; fiscalYears: YearOption[]; pending: boolean; error: string | null; onCreate: (payload: { academicYearId: string; fiscalYearId: string; name: string }) => void }) {
  const [academicYearId, setAcademicYearId] = useState(academicYears.find((year) => year.id)?.id ?? "");
  const [fiscalYearId, setFiscalYearId] = useState(fiscalYears.find((year) => year.id)?.id ?? "");
  const [name, setName] = useState("แผนจัดสรรงบประมาณประจำปี");
  return <div className="mx-auto max-w-3xl space-y-5"><div><h1 className="text-2xl font-bold">เริ่มแผนจัดสรรแบบกระเป๋าเงิน</h1><p className="mt-1 text-muted-foreground">สร้างฉบับร่างก่อน ระบบยังไม่กระทบยอดเงินจริงจนกว่าผู้บริหารอนุมัติ</p></div>{error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-emerald-700" />ข้อมูลรอบแผน</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm"><span>ปีการศึกษา</span><select className="h-10 w-full rounded-md border bg-background px-3" value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)}>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.yearName}</option>)}</select></label><label className="space-y-2 text-sm"><span>ปีงบประมาณ</span><select className="h-10 w-full rounded-md border bg-background px-3" value={fiscalYearId} onChange={(event) => setFiscalYearId(event.target.value)}>{fiscalYears.map((year) => <option key={year.id} value={year.id}>{year.yearName}</option>)}</select></label><label className="space-y-2 text-sm md:col-span-2"><span>ชื่อแผน</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="md:col-span-2"><Button className="w-full" disabled={pending || !academicYearId || !fiscalYearId || !name.trim()} onClick={() => onCreate({ academicYearId, fiscalYearId, name })}>สร้างแผนฉบับร่าง</Button></div></CardContent></Card></div>;
}

function StepTitle({ number, title, description }: { number: string; title: string; description: string }) { return <div className="flex items-start gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">{number}</div><div><h2 className="font-bold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div></div>; }
function Balance({ label, value, emphasize = false }: { label: string; value: number; emphasize?: boolean }) { return <div className={emphasize ? "rounded-lg bg-emerald-50 p-2 text-emerald-800" : "rounded-lg bg-muted/50 p-2"}><div className="text-muted-foreground">{label}</div><div className="mt-0.5 font-mono font-bold">{formatBaht(value)}</div></div>; }
function RequestList({ title, rows, role, pending, operating = false, onAction }: { title: string; rows: Array<{ id: string; title: string; description: string; amount: number; status: string }>; role: string; pending: boolean; operating?: boolean; onAction: (id: string, action: "approve" | "reject" | "pay") => void }) { return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.map((row) => <div key={row.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{row.title}</div><div className="text-xs text-muted-foreground">{row.description}</div></div><div className="text-right"><div className="font-mono font-bold">{formatBaht(row.amount)}</div><div className="text-[10px] text-muted-foreground">{row.status}</div></div></div>{(role === "SUPER_ADMIN" || role === "EXECUTIVE") && row.status === "PENDING_APPROVAL" && <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="outline" disabled={pending} onClick={() => onAction(row.id, "reject")}>ปฏิเสธ</Button><Button size="sm" disabled={pending} onClick={() => onAction(row.id, "approve")}>อนุมัติ</Button></div>}{operating && (role === "SUPER_ADMIN" || role === "FINANCE") && row.status === "APPROVED" && <div className="mt-3 flex justify-end"><Button size="sm" disabled={pending} onClick={() => onAction(row.id, "pay")}>บันทึกจ่าย</Button></div>}</div>)}{rows.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>}</CardContent></Card>; }
