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
  Building2, CheckCheck, AlertCircle
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

  const nextActionIconColorMap: Record<string, string> = {
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
    indigo: "text-indigo-600",
    orange: "text-orange-600",
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: "detail", label: "รายละเอียดคำขอ" },
    { key: "items", label: "รายการพัสดุ" },
    { key: "project", label: "โครงการและงบประมาณ" },
    { key: "history", label: "ประวัติการตรวจสอบ" },
  ];

  return (
    <div className="space-y-5">
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <Link href="/" className="hover:text-purple-600">หน้าแรก</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/procurement" className="hover:text-purple-600">พัสดุ/จัดซื้อ</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700">รายละเอียดคำขอจัดซื้อ</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {request.documentNo ? `เลขที่ ${request.documentNo}` : "คำขอจัดซื้อ"}
            </h1>
            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", statusColor.badge)}>
              {STATUS_LABELS[request.status] || request.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{request.subject}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/procurement"><ArrowLeft className="w-4 h-4 mr-1" /> กลับ</Link>
          </Button>
          {isSuperAdmin && (
            <>
              <Button variant="outline" size="sm" asChild className="border-amber-400 text-amber-700 hover:bg-amber-50">
                <Link href={`/procurement/${request.id}/edit`}>✏️ แก้ไข</Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
                🗑️ ลบ
              </Button>
            </>
          )}
          <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href={`/procurement/${request.id}/print`} target="_blank">
              <Printer className="w-4 h-4 mr-1" /> พิมพ์เอกสาร
            </Link>
          </Button>
        </div>
      </div>

      {/* ===== NEXT ACTION CARD ===== */}
      {nextAction && (
        <div className={cn("rounded-xl border p-4", nextActionColorMap[nextAction.color || "amber"])}>
          <div className="flex items-start gap-3">
            <nextAction.icon className={cn("w-6 h-6 mt-0.5 shrink-0", nextActionIconColorMap[nextAction.color || "amber"])} />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{nextAction.title}</p>
              <p className="text-sm text-gray-600 mt-0.5">{nextAction.desc}</p>
            </div>
            {canActuallySign && nextAction.btnApprove && !isReadOnly && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => { setShowRejectModal(true); setError(null); }}>
                  ตีกลับ
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => { setShowApproveModal(true); setError(null); }}>
                  {nextAction.btnApprove}
                </Button>
              </div>
            )}
            {!canActuallySign && !isTerminalStatus && !isReadOnly && (
              <span className="text-xs text-gray-500 shrink-0 text-right max-w-[120px]">บัญชีนี้ดูข้อมูลได้เท่านั้น</span>
            )}
          </div>
        </div>
      )}

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "ยอดขอรวม", value: formatBaht(requestedAmount), color: "bg-purple-50 border-purple-200 text-purple-700" },
          { label: "งบอนุมัติโครงการ", value: formatBaht(allocatedBudget), color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "ใช้จ่ายก่อนหน้า", value: formatBaht(spentBefore), color: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "งบคงเหลือก่อนขอ", value: formatBaht(previousBalance), color: "bg-teal-50 border-teal-200 text-teal-700" },
          { label: "งบคงเหลือหลังขอ", value: formatBaht(remainingBalance), color: isOverBudget ? "bg-red-50 border-red-200 text-red-700" : isLowBudget ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700" },
        ].map((card) => (
          <div key={card.label} className={cn("rounded-xl border p-3 text-center", card.color)}>
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className="text-sm font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ===== WORKFLOW STEPPER ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-700">เส้นทางการตรวจสอบคำขอจัดซื้อ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((ws, idx) => {
              const currentIdx = STATUS_ORDER.indexOf(request.status);
              const wsIdx = STATUS_ORDER.indexOf(ws.status);
              const isRejected = request.status === "REJECTED";
              
              let state: "done" | "current" | "pending" | "rejected" = "pending";
              if (isRejected && wsIdx <= currentIdx) state = "rejected";
              else if (wsIdx < currentIdx) state = "done";
              else if (ws.status === request.status || (request.status === "APPROVED" && ws.status === "APPROVED")) state = "current";
              
              return (
                <div key={ws.status} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      state === "done" && "bg-green-500 border-green-500 text-white",
                      state === "current" && request.status === "APPROVED" && "bg-green-600 border-green-600 text-white",
                      state === "current" && request.status !== "APPROVED" && "bg-purple-600 border-purple-600 text-white",
                      state === "pending" && "bg-white border-gray-300 text-gray-400",
                      state === "rejected" && "bg-red-400 border-red-400 text-white",
                    )}>
                      {state === "done" || (state === "current" && request.status === "APPROVED") ? <CheckCircle2 className="w-4 h-4" /> :
                       state === "rejected" ? <XCircle className="w-4 h-4" /> :
                       idx + 1}
                    </div>
                    <span className={cn(
                      "text-xs mt-1.5 text-center leading-tight",
                      state === "done" && "text-green-600 font-medium",
                      state === "current" && request.status !== "APPROVED" && "text-purple-600 font-bold",
                      state === "current" && request.status === "APPROVED" && "text-green-600 font-bold",
                      state === "pending" && "text-gray-400",
                      state === "rejected" && "text-red-500 font-medium",
                    )}>
                      {ws.label}
                    </span>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className={cn(
                      "w-6 h-0.5 mb-4",
                      wsIdx < currentIdx && request.status !== "REJECTED" ? "bg-green-400" :
                      "bg-gray-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ===== MAIN LAYOUT: Tabs + Right Panel ===== */}
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 min-w-0 space-y-4">
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
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-700">ข้อมูลสำคัญ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">สถานะปัจจุบัน</p>
                  <span className={cn("inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold", statusColor.badge)}>
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">ผู้สร้างคำขอ</p>
                  <p className="font-medium text-gray-900">{request.createdBy?.fullName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">โครงการ</p>
                  <p className="font-medium text-gray-900 text-xs leading-snug">{request.project.projectName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">ยอดขอรวม</p>
                  <p className="font-bold text-purple-700">{formatBaht(requestedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">งบคงเหลือหลังขอ</p>
                  <p className={cn("font-bold", isOverBudget ? "text-red-600" : "text-green-600")}>
                    {formatBaht(remainingBalance)}
                  </p>
                </div>
                {request.createdAt && (
                  <div>
                    <p className="text-xs text-gray-400">วันที่สร้าง</p>
                    <p className="text-gray-700 text-xs">{formatThaiDate(request.createdAt)}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 border-t pt-3">
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link href={`/projects/${request.project.id}`}><Building2 className="w-3 h-3 mr-1" /> ดูโครงการ</Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link href={`/procurement/${request.id}/print`} target="_blank">
                    <Printer className="w-3 h-3 mr-1" /> พิมพ์เอกสาร
                  </Link>
                </Button>
                {canActuallySign && !isReadOnly && (
                  <>
                    <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                      onClick={() => { setShowApproveModal(true); setError(null); }}>
                      <CheckCheck className="w-3 h-3 mr-1" /> {nextAction?.btnApprove || "ตรวจสอบผ่าน"}
                    </Button>
                    <Button size="sm" variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50 text-xs"
                      onClick={() => { setShowRejectModal(true); setError(null); }}>
                      <XCircle className="w-3 h-3 mr-1" /> ตีกลับ
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
