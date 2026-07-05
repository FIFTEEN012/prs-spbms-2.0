"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusAlert } from "@/components/ui/status-alert";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import Link from "next/link";
import {
  CheckCircle2, Clock, XCircle, ChevronRight, AlertTriangle,
  Printer, ArrowLeft, FileText, Loader2, Package,
  Building2, CheckCheck, AlertCircle, Pencil, Trash2,
  Route, WalletCards, UserRound, CalendarDays, FolderOpen,
  ClipboardCheck, BarChart3, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcurementItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: any;
  totalPrice: any;
  remarks: string | null;
  status: string;
}

interface PurchaseRequest {
  id: string;
  projectId: string;
  project: {
    id: string;
    projectName: string;
    projectCode: string;
    budgetApproved: any;
    department?: { name: string } | null;
  };
  activity?: { name: string } | null;
  fundSource?: { name: string } | null;
  budgetWallet?: { id: string; name: string; code: string } | null;
  documentNo: string | null;
  documentDate: any;
  subject: string;
  category: string;
  categoryDetails: string | null;
  actionPlanPage: string | null;
  isNotInPlan: boolean;
  necessityDetails: string | null;
  committee: any;
  status: string;
  allocatedBudget: any;
  previousBalance: any;
  requestedAmount: any;
  remainingBalance: any;
  items: ProcurementItem[];

  planOpinion: string | null;
  planApprovedById: string | null;
  planApprovedAt: any | null;

  financeOpinion: string | null;
  financeApprovedById: string | null;
  financeApprovedAt: any | null;

  procurementOpinion: string | null;
  procurementApprovedById: string | null;
  procurementApprovedAt: any | null;

  budgetOpinion: string | null;
  budgetApprovedById: string | null;
  budgetApprovedAt: any | null;

  directorOpinion: string | null;
  directorApprovedById: string | null;
  directorApprovedAt: any | null;

  createdBy?: { fullName: string; role: string } | null;
  borrowedFrom?: any;
  createdAt?: any;
  updatedAt?: any;
}

const CATEGORY_LABELS: Record<string, string> = {
  SUPPLIES: "วัสดุ",
  EQUIPMENT: "ครุภัณฑ์",
  FUEL: "น้ำมันเชื้อเพลิง",
  RENOVATION: "ปรับปรุง/ซ่อมแซม",
  REMUNERATION: "เบิกค่าตอบแทน",
  EXPENSES: "เบิกเงินค่าใช้สอย",
  TEMP_WAGE: "ค่าจ้างชั่วคราว",
  CONTRACT: "จ้างเหมา",
  HIRE: "จัดจ้าง",
  MAINTENANCE: "ซ่อมแซม",
  OTHERS: "อื่นๆ",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอแผนงานตรวจ",
  PLAN_REVIEWED: "รอการเงินตรวจ",
  FINANCE_REVIEWED: "รอเจ้าหน้าที่พัสดุตรวจ",
  PROCUREMENT_REVIEWED: "รอหัวหน้างบเห็นชอบ",
  BUDGET_REVIEWED: "รอ ผอ. อนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธคำขอ",
};

const STATUS_COLORS: Record<string, { badge: string; dot: string }> = {
  PENDING: { badge: "bg-amber-100 text-amber-800 border border-amber-200", dot: "bg-amber-400" },
  PLAN_REVIEWED: { badge: "bg-blue-100 text-blue-800 border border-blue-200", dot: "bg-blue-400" },
  FINANCE_REVIEWED: { badge: "bg-purple-100 text-purple-800 border border-purple-200", dot: "bg-purple-500" },
  PROCUREMENT_REVIEWED: { badge: "bg-indigo-100 text-indigo-800 border border-indigo-200", dot: "bg-indigo-500" },
  BUDGET_REVIEWED: { badge: "bg-orange-100 text-orange-800 border border-orange-200", dot: "bg-orange-400" },
  APPROVED: { badge: "bg-green-100 text-green-800 border border-green-200", dot: "bg-green-500" },
  REJECTED: { badge: "bg-red-100 text-red-800 border border-red-200", dot: "bg-red-500" },
};

const WORKFLOW_STEPS = [
  { status: "PENDING", label: "รอแผนงานตรวจ", step: "plan" },
  { status: "PLAN_REVIEWED", label: "รอการเงินตรวจ", step: "finance" },
  { status: "FINANCE_REVIEWED", label: "รอพัสดุตรวจ", step: "procurement" },
  { status: "PROCUREMENT_REVIEWED", label: "รอหัวหน้างบ", step: "budget" },
  { status: "BUDGET_REVIEWED", label: "รอ ผอ. อนุมัติ", step: "director" },
  { status: "APPROVED", label: "อนุมัติแล้ว", step: "done" },
];

const STATUS_ORDER = ["PENDING", "PLAN_REVIEWED", "FINANCE_REVIEWED", "PROCUREMENT_REVIEWED", "BUDGET_REVIEWED", "APPROVED"];

type TabKey = "detail" | "items" | "project" | "history";

export function PurchaseRequestDetailClient({
  request,
  currentUser,
  approverMap,
}: {
  request: PurchaseRequest;
  currentUser: { id: string; role: string; departmentId: string | null };
  approverMap: Record<string, string>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [opinion, setOpinion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("detail");

  const isApprovedRequest = request.status === "APPROVED" || !!request.directorApprovedAt;
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const [rejectReason, setRejectReason] = useState("");

  // Workflow step mapping
  let currentStep = "";
  if (request.status === "PENDING") currentStep = "plan";
  else if (request.status === "PLAN_REVIEWED") currentStep = "finance";
  else if (request.status === "FINANCE_REVIEWED") currentStep = "procurement";
  else if (request.status === "PROCUREMENT_REVIEWED") currentStep = "budget";
  else if (request.status === "BUDGET_REVIEWED") currentStep = "director";

  // RBAC check
  const role = currentUser.role;
  let canSign = false;
  if (role === "SUPER_ADMIN") {
    canSign = true;
  } else {
    if (currentStep === "plan") {
      canSign = role === "FINANCE" || role === "DEPT_HEAD";
    } else if (currentStep === "finance") {
      canSign = role === "FINANCE";
    } else if (currentStep === "procurement") {
      canSign = role === "PROCUREMENT";
    } else if (currentStep === "budget") {
      canSign = role === "DEPT_HEAD";
    } else if (currentStep === "director") {
      canSign = role === "EXECUTIVE";
    }
  }

  const isReadOnly = role === "COMMITTEE";
  const isTerminalStatus = request.status === "APPROVED" || request.status === "REJECTED";
  const canActuallySign = canSign && !isTerminalStatus;

  // Budget calculations
  const allocatedBudget = Number(request.allocatedBudget) || 0;
  const previousBalance = Number(request.previousBalance) || 0;
  const requestedAmount = Number(request.requestedAmount) || 0;
  const remainingBalance = Number(request.remainingBalance) || 0;
  const spentBefore = allocatedBudget - previousBalance;
  const usagePercent = previousBalance > 0 ? (requestedAmount / previousBalance) * 100 : 0;
  const isOverBudget = remainingBalance < 0;
  const isLowBudget = !isOverBudget && usagePercent > 80;
  const spentPercent = allocatedBudget > 0 ? Math.min(100, Math.max(0, (spentBefore / allocatedBudget) * 100)) : 0;
  const requestPercent = allocatedBudget > 0 ? Math.min(100 - spentPercent, Math.max(0, (requestedAmount / allocatedBudget) * 100)) : 0;
  const projectedPercent = Math.min(100, spentPercent + requestPercent);

  // Handlers
  const handleApprove = async (isApproved: boolean, reasonOverride?: string) => {
    setError(null);
    setMessage(null);
    const finalOpinion = reasonOverride || opinion;

    if (!isApproved && !finalOpinion.trim()) {
      setError("กรุณาระบุเหตุผลที่ตีกลับ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/procurements/requests/${request.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: currentStep, opinion: finalOpinion.trim(), isApproved }),
      });

      setLoading(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "เกิดข้อผิดพลาดในการดำเนินการ");
        return;
      }

      setMessage(isApproved ? "ดำเนินการสำเร็จ" : "ตีกลับคำขอสำเร็จ");
      setOpinion("");
      setRejectReason("");
      setShowApproveModal(false);
      setShowRejectModal(false);
      router.refresh();
    } catch (_e) {
      setLoading(false);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const handleDelete = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/procurements/requests/${request.id}`, { method: "DELETE" });
      setLoading(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
        return;
      }
      setIsDeleteOpen(false);
      router.push("/procurement");
      router.refresh();
    } catch (_e) {
      setLoading(false);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const committeeList = Array.isArray(request.committee)
    ? request.committee
    : JSON.parse((request.committee as string) || "[]");

  const statusColor = STATUS_COLORS[request.status] || STATUS_COLORS["PENDING"];
  const currentStatusIndex = STATUS_ORDER.indexOf(request.status);
  const latestApprovalStepIndex = [
    request.planApprovedAt ? 0 : -1,
    request.financeApprovedAt ? 1 : -1,
    request.procurementApprovedAt ? 2 : -1,
    request.budgetApprovedAt ? 3 : -1,
    request.directorApprovedAt ? 4 : -1,
  ].reduce((max, index) => Math.max(max, index), -1);
  const approverName = currentStep === "plan"
    ? "งานแผนงาน"
    : currentStep === "finance"
      ? "งานการเงิน"
      : currentStep === "procurement"
        ? "งานพัสดุ"
        : currentStep === "budget"
          ? "หัวหน้างบประมาณ"
          : currentStep === "director"
            ? "ผู้บริหาร"
            : "เสร็จสิ้น";
  const budgetHealthLabel = isOverBudget ? "งบไม่เพียงพอ" : isLowBudget ? "ควรตรวจสอบงบ" : "งบเพียงพอ";
  const budgetHealthClass = isOverBudget
    ? "border-red-200 bg-red-50 text-red-700"
    : isLowBudget
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  // Next action mapping
  const getNextActionInfo = () => {
    if (request.status === "APPROVED") {
      return { title: "คำขอนี้ได้รับอนุมัติแล้ว", desc: "สามารถพิมพ์เอกสารเพื่อดำเนินการต่อไปได้", icon: CheckCheck, color: "green" };
    }
    if (request.status === "REJECTED") {
      return { title: "คำขอนี้ถูกตีกลับ", desc: "กรุณาตรวจสอบเหตุผลที่ตีกลับจากขั้นตอนล่าสุดและแก้ไขข้อมูล", icon: XCircle, color: "red" };
    }
    if (request.status === "PENDING") return { title: "คำขอรอแผนงานตรวจสอบ", desc: "กรุณาตรวจสอบความถูกต้องของโครงการ รายการพัสดุ และความสอดคล้องกับแผนงาน", icon: Clock, color: "amber", btnApprove: "ตรวจสอบผ่าน", btnReject: "ตีกลับ" };
    if (request.status === "PLAN_REVIEWED") return { title: "คำขอรอการเงินตรวจสอบ", desc: "กรุณาตรวจสอบยอดขอ งบคงเหลือ และความถูกต้องของการใช้งบประมาณ", icon: Clock, color: "blue", btnApprove: "ตรวจสอบงบผ่าน", btnReject: "ตีกลับ" };
    if (request.status === "FINANCE_REVIEWED") return { title: "คำขอรอเจ้าหน้าที่พัสดุตรวจสอบ", desc: "กรุณาตรวจสอบรายการพัสดุ จำนวน หน่วย ราคา และความครบถ้วนของคำขอ", icon: Clock, color: "purple", btnApprove: "ตรวจสอบพัสดุผ่าน", btnReject: "ตีกลับ" };
    if (request.status === "PROCUREMENT_REVIEWED") return { title: "คำขอรอหัวหน้างบเห็นชอบ", desc: "กรุณาตรวจสอบข้อมูลก่อนส่งต่อให้ผู้บริหารอนุมัติ", icon: Clock, color: "indigo", btnApprove: "เห็นชอบ", btnReject: "ตีกลับ" };
    if (request.status === "BUDGET_REVIEWED") return { title: "คำขอรอผู้บริหารอนุมัติ", desc: "เมื่ออนุมัติแล้ว ระบบจะบันทึกรายการใช้งบประมาณและปรับยอดคงเหลือ", icon: Clock, color: "orange", btnApprove: "อนุมัติคำขอ", btnReject: "ตีกลับ" };
    return null;
  };

  const nextAction = getNextActionInfo();

  const nextActionColorMap: Record<string, string> = {
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    indigo: "border-indigo-200 bg-indigo-50",
    orange: "border-orange-200 bg-orange-50",
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: "detail", label: "รายละเอียดคำขอ" },
    { key: "items", label: "รายการพัสดุ" },
    { key: "project", label: "โครงการและงบประมาณ" },
    { key: "history", label: "ประวัติการตรวจสอบ" },
  ];

  return (
    <div className="space-y-6">
      {/* Approve/Reject Modals */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {nextAction?.btnApprove || "ตรวจสอบผ่าน"}
            </h2>
            {request.status === "BUDGET_REVIEWED" && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <AlertTriangle className="inline-block w-4 h-4 mr-1" />
                เมื่ออนุมัติแล้ว ระบบจะบันทึกรายการใช้งบประมาณและปรับยอดคงเหลือทันที
              </div>
            )}
            <div className="space-y-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-gray-500">งบคงเหลือก่อนขอ</span>
                <span className="font-medium">{formatBaht(previousBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ยอดขอครั้งนี้</span>
                <span className="font-semibold text-purple-600">{formatBaht(requestedAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">คงเหลือหลังอนุมัติ</span>
                <span className={cn("font-bold", isOverBudget ? "text-red-600" : "text-green-600")}>
                  {formatBaht(remainingBalance)}
                </span>
              </div>
            </div>
            {isOverBudget && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                งบคงเหลือหลังอนุมัติติดลบ กรุณาตรวจสอบก่อนดำเนินการ
              </div>
            )}
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
              rows={3}
              placeholder="ความเห็นเพิ่มเติม (ถ้ามี)"
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowApproveModal(false); setOpinion(""); setError(null); }} disabled={loading}>
                ยกเลิก
              </Button>
              <Button onClick={() => handleApprove(true)} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {nextAction?.btnApprove || "ตรวจสอบผ่าน"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-900">ตีกลับคำขอจัดซื้อ</h2>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              ผู้สร้างคำขอจะเห็นข้อความนี้และสามารถนำไปปรับแก้ได้
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                เหตุผลที่ตีกลับ <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                rows={3}
                placeholder="ระบุเหตุผลเพื่อให้ผู้สร้างคำขอนำไปแก้ไข"
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setError(null); }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowRejectModal(false); setRejectReason(""); setError(null); }} disabled={loading}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={() => handleApprove(false, rejectReason)} disabled={loading || !rejectReason.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                ตีกลับคำขอ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={isDeleteOpen}
        title="ยืนยันการลบคำขอจัดซื้อ"
        description={
          isApprovedRequest
            ? "ใบขอนี้อนุมัติแล้ว ระบบจะคืนผลทางงบประมาณและบันทึกประวัติการลบไว้"
            : "การลบใบขออนุมัติจัดซื้อจัดจ้างนี้ไม่สามารถย้อนกลับได้"
        }
        confirmLabel="ยืนยันลบ"
        variant="destructive"
        loading={loading}
        error={error}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      {error && !showApproveModal && !showRejectModal && !isDeleteOpen && (
        <StatusAlert variant="error">{error}</StatusAlert>
      )}
      {message && <StatusAlert variant="success">{message}</StatusAlert>}

      {/* ===== HEADER ===== */}
      <section className="overflow-hidden rounded-xl border border-primary/10 bg-white/90 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-primary">หน้าแรก</Link>
          <ChevronRight className="size-3" />
          <Link href="/procurement" className="hover:text-primary">พัสดุ/จัดซื้อ</Link>
          <ChevronRight className="size-3" />
          <span className="text-primary">รายละเอียดคำขอจัดซื้อ</span>
        </div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-600">
                {request.documentNo || "ยังไม่มีเลขที่เอกสาร"}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", statusColor.badge)}>
                <span className={cn("size-1.5 rounded-full", statusColor.dot)} />
                {STATUS_LABELS[request.status] || request.status}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">
                {request.subject}
              </h1>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <FolderOpen className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{request.project.projectName}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <UserRound className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{request.createdBy?.fullName || "ยังไม่ได้ระบุผู้สร้าง"}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{formatThaiDate(request.documentDate)}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{request.project.department?.name || "ยังไม่ได้ระบุกลุ่มบริหาร"}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" size="sm" asChild className="rounded-lg">
              <Link href="/procurement"><ArrowLeft className="mr-1.5 size-4" /> กลับ</Link>
            </Button>
            {isSuperAdmin && (
              <>
                <Button variant="outline" size="sm" asChild className="rounded-lg border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Link href={`/procurement/${request.id}/edit`}><Pencil className="mr-1.5 size-4" /> แก้ไข</Link>
                </Button>
                <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="mr-1.5 size-4" /> ลบ
                </Button>
              </>
            )}
            <Button size="sm" asChild className="rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90">
              <Link href={`/procurement/${request.id}/print`} target="_blank">
                <Printer className="mr-1.5 size-4" /> พิมพ์เอกสาร
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== MAIN LAYOUT: Content + Right Approval Center ===== */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex-1 min-w-0 space-y-4">
          {/* ===== NEXT ACTION CARD ===== */}
          {nextAction && (
            <section className={cn("rounded-xl border p-5 shadow-sm", nextActionColorMap[nextAction.color || "amber"])}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                    <ClipboardCheck className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">งานถัดไป: {approverName}</p>
                    <h2 className="mt-1 text-lg font-extrabold text-slate-950">{nextAction.title}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{nextAction.desc}</p>
                  </div>
                </div>
                {canActuallySign && nextAction.btnApprove && !isReadOnly ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" className="rounded-lg border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => { setShowRejectModal(true); setError(null); }}>
                      <XCircle className="mr-1.5 size-4" /> ตีกลับ
                    </Button>
                    <Button size="sm" className="rounded-lg bg-primary text-white hover:bg-primary/90"
                      onClick={() => { setShowApproveModal(true); setError(null); }}>
                      <CheckCheck className="mr-1.5 size-4" /> {nextAction.btnApprove}
                    </Button>
                  </div>
                ) : !isTerminalStatus && !isReadOnly ? (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-500">
                    บัญชีนี้ดูข้อมูลได้เท่านั้น
                  </span>
                ) : null}
              </div>
            </section>
          )}

          {/* ===== SUMMARY CARDS ===== */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              { label: "ยอดขอรวม", value: formatBaht(requestedAmount), color: "bg-[#e2dfff] border-[#3525cd]/10 text-[#1e00a9]" },
              { label: "งบอนุมัติโครงการ", value: formatBaht(allocatedBudget), color: "bg-[#dae2ff] border-primary/10 text-primary" },
              { label: "ใช้จ่ายก่อนหน้า", value: formatBaht(spentBefore), color: "bg-[#ffdf9a] border-[#785a00]/10 text-[#785a00]" },
              { label: "งบคงเหลือก่อนขอ", value: formatBaht(previousBalance), color: "bg-white border-slate-200 text-slate-800" },
              { label: "งบคงเหลือหลังขอ", value: formatBaht(remainingBalance), color: isOverBudget ? "bg-red-50 border-red-200 text-red-700" : isLowBudget ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700" },
            ].map((card) => (
              <div key={card.label} className={cn("rounded-xl border p-4 shadow-sm", card.color, card.label === "งบคงเหลือหลังขอ" && "md:col-span-2")}>
                <p className="text-xs font-semibold text-current/70">{card.label}</p>
                <p className="mt-1 text-lg font-extrabold tracking-tight">{card.value}</p>
              </div>
            ))}
          </div>

          {/* ===== BUDGET SNAPSHOT ===== */}
          <Card className="rounded-xl border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <BarChart3 className="size-4 text-primary" />
                ภาพรวมงบประมาณโครงการ
              </CardTitle>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", budgetHealthClass)}>
                {budgetHealthLabel}
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-6 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-slate-300" style={{ width: `${spentPercent}%` }} />
                <div className={cn("flex items-center justify-center text-[10px] font-bold text-white", isOverBudget ? "bg-red-500" : isLowBudget ? "bg-amber-500" : "bg-primary")} style={{ width: `${requestPercent}%` }}>
                  {requestPercent > 12 ? "ยอดขอครั้งนี้" : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>ใช้ไปแล้ว {spentPercent.toFixed(1)}%</span>
                <span className="font-bold text-primary">หลังคำขอนี้ {projectedPercent.toFixed(1)}%</span>
                <span>เต็มวงเงิน 100%</span>
              </div>
            </CardContent>
          </Card>
          {/* Tabs Header */}
          <div className="flex gap-1 border-b overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                  activeTab === tab.key
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: รายละเอียดคำขอ */}
          {activeTab === "detail" && (
            <Card>
              <CardHeader><CardTitle className="text-base">รายละเอียดคำขอ</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {[
                    { label: "เลขที่เอกสาร", value: request.documentNo || "ยังไม่ได้ระบุ" },
                    { label: "วันที่เอกสาร", value: formatThaiDate(request.documentDate) },
                    { label: "ประเภทคำขอ", value: CATEGORY_LABELS[request.category] || request.category || "ยังไม่ได้ระบุ" },
                    { label: "ผู้สร้างคำขอ", value: request.createdBy?.fullName || "ยังไม่ได้ระบุ" },
                    { label: "กลุ่มบริหาร", value: request.project?.department?.name || "ยังไม่ได้ระบุ" },
                    { label: "กิจกรรมในโครงการ", value: request.activity?.name || "โครงการหลัก" },
                    { label: "แหล่งงบประมาณ", value: request.fundSource?.name || "ยังไม่ได้ระบุ" },
                    { label: "มีในแผนปฏิบัติการ", value: request.isNotInPlan ? "ไม่มีในแผนฯ (กรณีจำเป็นเร่งด่วน)" : `มีในแผนฯ หน้าที่ ${request.actionPlanPage || "-"}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-gray-500 text-xs mb-0.5">{label}</dt>
                      <dd className="font-medium text-gray-900">{value}</dd>
                    </div>
                  ))}
                  {request.necessityDetails && (
                    <div className="md:col-span-2">
                      <dt className="text-gray-500 text-xs mb-0.5">เหตุผลความจำเป็น</dt>
                      <dd className="font-medium text-gray-900 p-2 bg-amber-50 border border-amber-200 rounded text-xs">{request.necessityDetails}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Tab: รายการพัสดุ */}
          {activeTab === "items" && (
            <Card>
              <CardHeader><CardTitle className="text-base">รายการพัสดุ/รายการจัดซื้อ</CardTitle></CardHeader>
              <CardContent>
                {request.items.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">ยังไม่มีรายการพัสดุ</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 font-medium text-gray-600 w-12 text-center">ที่</th>
                          <th className="px-3 py-2 font-medium text-gray-600">รายการ</th>
                          <th className="px-3 py-2 font-medium text-gray-600 text-right w-20">จำนวน</th>
                          <th className="px-3 py-2 font-medium text-gray-600 text-right w-32">ราคา/หน่วย</th>
                          <th className="px-3 py-2 font-medium text-gray-600 text-right w-32">รวม (บาท)</th>
                          <th className="px-3 py-2 font-medium text-gray-600 min-w-[100px]">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {request.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{item.itemName}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatBaht(Number(item.unitPrice))}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatBaht(Number(item.totalPrice))}</td>
                            <td className="px-3 py-2 text-gray-500">{item.remarks || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50 border-t-2 border-purple-200">
                          <td colSpan={4} className="px-3 py-2.5 text-right font-bold text-gray-800">รวมทั้งสิ้น</td>
                          <td className="px-3 py-2.5 text-right font-bold text-purple-700 text-base">{formatBaht(requestedAmount)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab: โครงการและงบประมาณ */}
          {activeTab === "project" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">ข้อมูลโครงการและงบประมาณ</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projects/${request.project.id}`}>ดูรายละเอียดโครงการ</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {[
                    { label: "รหัสโครงการ", value: request.project.projectCode },
                    { label: "ชื่อโครงการ", value: request.project.projectName },
                    { label: "กลุ่มบริหาร", value: request.project.department?.name || "-" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-gray-500 text-xs mb-0.5">{label}</dt>
                      <dd className="font-medium text-gray-900">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 font-medium mb-3">สรุปงบประมาณของคำขอนี้</p>
                  <div className="space-y-2">
                    {[
                      { label: "งบที่อนุมัติของโครงการ", value: formatBaht(allocatedBudget), color: "" },
                      { label: "ใช้จ่ายแล้วก่อนหน้านี้", value: formatBaht(spentBefore), color: "text-amber-600" },
                      { label: "ยอดขอครั้งนี้", value: formatBaht(requestedAmount), color: "text-purple-600" },
                      { label: "งบคงเหลือหลังขอ", value: formatBaht(remainingBalance), color: isOverBudget ? "text-red-600" : "text-green-600" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-gray-600">{label}</span>
                        <span className={cn("font-semibold", color)}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>สัดส่วนยอดขอ</span>
                      <span>{Math.min(100, usagePercent).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-gray-300 h-2" style={{ width: `${Math.min(100, (spentBefore / (allocatedBudget || 1)) * 100)}%` }} />
                      <div className={cn("h-2 transition-all", isOverBudget ? "bg-red-500" : isLowBudget ? "bg-amber-500" : "bg-purple-500")}
                        style={{ width: `${Math.min(100 - (spentBefore / (allocatedBudget || 1)) * 100, usagePercent)}%` }} />
                    </div>
                  </div>
                  {isOverBudget && (
                    <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>ยอดขอครั้งนี้มากกว่างบคงเหลือของโครงการ กรุณาตรวจสอบก่อนดำเนินการ</span>
                    </div>
                  )}
                  {!isOverBudget && (
                    <div className="mt-2 text-right">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                        isLowBudget ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      )}>
                        {isLowBudget ? "ควรตรวจสอบงบ" : "งบเพียงพอ"}
                      </span>
                    </div>
                  )}
                </div>

                {committeeList.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500 font-medium mb-3">คณะกรรมการตรวจรับพัสดุ</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {committeeList.map((comm: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg text-sm">
                          <p className="text-xs text-gray-400">{comm.role === "CHAIRMAN" ? "ประธานกรรมการ" : "กรรมการตรวจรับ"}</p>
                          <p className="font-medium mt-0.5">{comm.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab: ประวัติการตรวจสอบ */}
          {activeTab === "history" && (
            <Card>
              <CardHeader><CardTitle className="text-base">ประวัติการตรวจสอบคำขอ</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const historyItems = [
                    {
                      label: "งานแผนงาน",
                      approvedBy: request.planApprovedById ? approverMap[request.planApprovedById] : null,
                      approvedAt: request.planApprovedAt,
                      opinion: request.planOpinion,
                      done: !!request.planApprovedAt,
                    },
                    {
                      label: "งานการเงิน",
                      approvedBy: request.financeApprovedById ? approverMap[request.financeApprovedById] : null,
                      approvedAt: request.financeApprovedAt,
                      opinion: request.financeOpinion,
                      done: !!request.financeApprovedAt,
                    },
                    {
                      label: "งานพัสดุ",
                      approvedBy: request.procurementApprovedById ? approverMap[request.procurementApprovedById] : null,
                      approvedAt: request.procurementApprovedAt,
                      opinion: request.procurementOpinion,
                      done: !!request.procurementApprovedAt,
                    },
                    {
                      label: "หัวหน้างบประมาณ",
                      approvedBy: request.budgetApprovedById ? approverMap[request.budgetApprovedById] : null,
                      approvedAt: request.budgetApprovedAt,
                      opinion: request.budgetOpinion,
                      done: !!request.budgetApprovedAt,
                    },
                    {
                      label: "ผู้อำนวยการโรงเรียน",
                      approvedBy: request.directorApprovedById ? approverMap[request.directorApprovedById] : null,
                      approvedAt: request.directorApprovedAt,
                      opinion: request.directorOpinion,
                      done: !!request.directorApprovedAt,
                    },
                  ].filter((h) => h.done);

                  if (historyItems.length === 0) {
                    return (
                      <div className="text-center py-10 text-gray-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">ยังไม่มีประวัติการตรวจสอบ</p>
                        <p className="text-xs mt-1">เมื่อมีการตรวจสอบหรืออนุมัติคำขอ รายการจะแสดงที่นี่</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {historyItems.map((h, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            </div>
                            {idx < historyItems.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" />}
                          </div>
                          <div className="flex-1 pb-3">
                            <p className="text-sm font-semibold text-gray-800">{h.label}</p>
                            {h.approvedBy && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                โดย {h.approvedBy} · {formatThaiDate(h.approvedAt)}
                              </p>
                            )}
                            {h.opinion && (
                              <p className="text-xs text-gray-600 mt-1.5 italic bg-gray-50 p-2 rounded border">
                                &ldquo;{h.opinion}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ===== RIGHT SIDE PANEL ===== */}
        <aside className="w-full space-y-4">
          <div className="sticky top-6 space-y-4">
            <Card className="rounded-xl border-primary/10 bg-white/90 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-extrabold text-primary">
                  <Route className="size-5" />
                  เส้นทางการตรวจสอบ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-6 before:absolute before:left-[11px] before:top-7 before:h-[calc(100%-3rem)] before:w-0.5 before:bg-slate-200">
                  <div className="relative z-10 flex gap-4">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-700">สร้างคำขอ</p>
                      <p className="text-xs text-slate-500">{request.createdAt ? formatThaiDate(request.createdAt) : formatThaiDate(request.documentDate)}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-600">โดย {request.createdBy?.fullName || "ไม่ระบุ"}</p>
                    </div>
                  </div>
                  {WORKFLOW_STEPS.slice(0, -1).map((step) => {
                    const stepIndex = STATUS_ORDER.indexOf(step.status);
                    const approvedAt = step.step === "plan"
                      ? request.planApprovedAt
                      : step.step === "finance"
                        ? request.financeApprovedAt
                        : step.step === "procurement"
                          ? request.procurementApprovedAt
                          : step.step === "budget"
                            ? request.budgetApprovedAt
                            : step.step === "director"
                              ? request.directorApprovedAt
                              : null;
                    const approvedById = step.step === "plan"
                      ? request.planApprovedById
                      : step.step === "finance"
                        ? request.financeApprovedById
                        : step.step === "procurement"
                          ? request.procurementApprovedById
                          : step.step === "budget"
                            ? request.budgetApprovedById
                            : step.step === "director"
                              ? request.directorApprovedById
                              : null;
                    const isCurrent = request.status === step.status;
                    const isRejectedHere = request.status === "REJECTED" && latestApprovalStepIndex === stepIndex;
                    const isDone = !isRejectedHere && (Boolean(approvedAt) || (currentStatusIndex > stepIndex && request.status !== "REJECTED"));

                    return (
                      <div key={step.status} className="relative z-10 flex gap-4">
                        <div className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                          isDone && "border-emerald-500 bg-emerald-500 text-white",
                          isCurrent && !isDone && "border-primary bg-primary text-white ring-4 ring-blue-100",
                          !isCurrent && !isDone && !isRejectedHere && "border-slate-300 bg-white",
                          isRejectedHere && "border-red-400 bg-red-400 text-white",
                        )}>
                          {isDone ? <CheckCircle2 className="size-4" /> : isRejectedHere ? <XCircle className="size-4" /> : isCurrent ? <span className="size-2 rounded-full bg-white" /> : null}
                        </div>
                        <div className="min-w-0">
                          <p className={cn(
                            "text-sm font-bold",
                            isDone && "text-emerald-700",
                            isCurrent && !isDone && "text-primary",
                            !isDone && !isCurrent && "text-slate-500",
                            isRejectedHere && "text-red-700",
                          )}>
                            {step.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {approvedAt
                              ? formatThaiDate(approvedAt)
                              : isCurrent
                                ? "กำลังดำเนินการ"
                                : request.status === "REJECTED"
                                  ? "หยุดการดำเนินการ"
                                  : "รอดำเนินการ"}
                          </p>
                          {approvedById && (
                            <p className="mt-0.5 text-xs font-semibold text-slate-600">
                              โดย {approverMap[approvedById] || "ไม่ระบุ"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <ShieldCheck className="size-4 text-primary" />
                  ข้อมูลสำคัญ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">สถานะปัจจุบัน</p>
                  <span className={cn("mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", statusColor.badge)}>
                    <span className={cn("size-1.5 rounded-full", statusColor.dot)} />
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400">ยอดขอรวม</p>
                  <p className="font-extrabold text-primary">{formatBaht(requestedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">งบคงเหลือหลังขอ</p>
                  <p className={cn("font-extrabold", isOverBudget ? "text-red-600" : "text-emerald-600")}>
                    {formatBaht(remainingBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">กระเป๋างบประมาณ</p>
                  <p className="font-semibold text-slate-800">{request.budgetWallet?.name || "ไม่ได้ระบุกระเป๋างบ"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">โครงการ</p>
                  <p className="text-xs font-semibold leading-snug text-slate-800">{request.project.projectName}</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 border-t bg-slate-50/70 pt-3">
                <Button variant="outline" size="sm" className="w-full rounded-lg bg-white text-xs" asChild>
                  <Link href={`/projects/${request.project.id}`}><Building2 className="mr-1.5 size-3.5" /> ดูโครงการ</Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full rounded-lg bg-white text-xs" asChild>
                  <Link href={`/procurement/${request.id}/print`} target="_blank">
                    <Printer className="mr-1.5 size-3.5" /> พิมพ์เอกสาร
                  </Link>
                </Button>
                {canActuallySign && !isReadOnly && (
                  <>
                    <Button size="sm" className="w-full rounded-lg bg-primary text-xs text-white hover:bg-primary/90"
                      onClick={() => { setShowApproveModal(true); setError(null); }}>
                      <CheckCheck className="mr-1.5 size-3.5" /> {nextAction?.btnApprove || "ตรวจสอบผ่าน"}
                    </Button>
                    <Button size="sm" variant="outline" className="w-full rounded-lg border-red-300 bg-white text-xs text-red-700 hover:bg-red-50"
                      onClick={() => { setShowRejectModal(true); setError(null); }}>
                      <XCircle className="mr-1.5 size-3.5" /> ตีกลับ
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>

            <div className="rounded-xl border border-l-4 border-slate-200 border-l-[#fdc425] bg-white/80 p-4 shadow-sm">
              <div className="flex gap-3">
                <WalletCards className="mt-0.5 size-5 shrink-0 text-[#785a00]" />
                <div>
                  <p className="text-sm font-bold text-slate-800">ข้อสังเกตงบประมาณ</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    หลังคำขอนี้ งบประมาณจะถูกใช้ไปประมาณ {projectedPercent.toFixed(1)}% ของวงเงินอนุมัติ
                    {isOverBudget ? " และยอดคงเหลือติดลบ กรุณาตรวจสอบก่อนอนุมัติ" : " ระบบจะบันทึกผลกระทบงบประมาณตามขั้นตอนอนุมัติเดิม"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
