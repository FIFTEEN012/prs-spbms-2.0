"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, FileText, CheckCircle2, ArrowUpDown,
  XCircle, Clock, FileSignature, HandCoins, X, Check, Eye, PackageSearch
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchFilterBar, type ActiveFilterSummary } from "@/components/ui/search-filter-bar";
import { StatusAlert } from "@/components/ui/status-alert";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import {
  defaultPurchaseRequestListQueryValues,
  type PurchaseRequestListQueryValues,
  type PurchaseRequestListRow,
} from "@/lib/purchase-request-list-service";
import { useListControls } from "@/lib/use-list-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอแผนงานตรวจ",
  PLAN_REVIEWED: "รอการเงินตรวจ",
  FINANCE_REVIEWED: "รอเจ้าหน้าที่พัสดุตรวจ",
  PROCUREMENT_REVIEWED: "รอหัวหน้างบเห็นชอบ",
  BUDGET_REVIEWED: "รอ ผอ. อนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธคำขอ",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PLAN_REVIEWED: "bg-purple-100 text-purple-800 border-purple-200",
  FINANCE_REVIEWED: "bg-blue-100 text-blue-800 border-blue-200",
  PROCUREMENT_REVIEWED: "bg-orange-100 text-orange-800 border-orange-200",
  BUDGET_REVIEWED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

const WORKFLOW_STEPS = [
  { id: "PENDING", label: "แผนงานตรวจ", icon: FileText },
  { id: "PLAN_REVIEWED", label: "การเงินตรวจ", icon: HandCoins },
  { id: "FINANCE_REVIEWED", label: "พัสดุตรวจ", icon: FileSignature },
  { id: "PROCUREMENT_REVIEWED", label: "หัวหน้างบเห็นชอบ", icon: CheckCircle2 },
  { id: "BUDGET_REVIEWED", label: "ผอ. อนุมัติ", icon: CheckCircle2 },
  { id: "APPROVED", label: "อนุมัติแล้ว", icon: Check },
];

interface ProcurementClientProps {
  requests: PurchaseRequestListRow[];
  summaryStats?: {
    total: number;
    pending: number;
    finance: number;
    procurement: number;
    executive: number;
    approved: number;
  };
  showProcureCol: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  initialQuery: PurchaseRequestListQueryValues;
  sessionRole: string;
}

export function ProcurementClient({
  requests,
  summaryStats = { total: 0, pending: 0, finance: 0, procurement: 0, executive: 0, approved: 0 },
  showProcureCol,
  total,
  page,
  limit,
  totalPages,
  initialQuery,
  sessionRole,
}: ProcurementClientProps) {
  const router = useRouter();
  const {
    appliedValues,
    draftValues,
    isPending,
    setValue,
    reset,
    goToPage,
  } = useListControls({
    initialValues: initialQuery,
    defaults: defaultPurchaseRequestListQueryValues,
  });

  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequestListRow | null>(null);
  
  // Modal states
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveRemarks, setApproveRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive alert state
  const pendingRequestsCount = requests.filter(r => r.status !== "APPROVED" && r.status !== "REJECTED").length;
  const canCreateRequest =
    showProcureCol &&
    (sessionRole === "TEACHER" ||
      sessionRole === "DEPT_HEAD" ||
      sessionRole === "SUPER_ADMIN" ||
      sessionRole === "PROCUREMENT");

  const activeFilters = useMemo<ActiveFilterSummary[]>(() => {
    const items: ActiveFilterSummary[] = [];
    if (appliedValues.q) items.push({ key: "q", label: "ค้นหา", value: appliedValues.q });
    if (appliedValues.status) items.push({ key: "status", label: "สถานะ", value: STATUS_LABELS[appliedValues.status] ?? appliedValues.status });
    if (appliedValues.month) items.push({ key: "month", label: "เดือน", value: appliedValues.month });
    return items;
  }, [appliedValues]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    void action; // Simulated use
    try {
      // In a real app, we would call the API here.
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setIsApproveModalOpen(false);
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectReason("");
      setApproveRemarks("");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canApprove = (req: PurchaseRequestListRow) => {
    if (sessionRole === "SUPER_ADMIN") return true;
    if (req.status === "PENDING" && sessionRole === "DEPT_HEAD") return true;
    if (req.status === "PLAN_REVIEWED" && sessionRole === "FINANCE") return true;
    if (req.status === "FINANCE_REVIEWED" && sessionRole === "PROCUREMENT") return true;
    if (req.status === "PROCUREMENT_REVIEWED" && sessionRole === "DEPT_HEAD") return true;
    if (req.status === "BUDGET_REVIEWED" && sessionRole === "EXECUTIVE") return true;
    return false;
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            พัสดุ/จัดซื้อ
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            สร้างคำขอจัดซื้อ ติดตามสถานะ และตรวจสอบการใช้งบประมาณจากโครงการที่ได้รับอนุมัติ
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="hidden sm:flex"
            onClick={() => router.push("/procurement/inventory")}
          >
            <PackageSearch className="mr-2 h-4 w-4" />
            ทะเบียนคุมสินค้า
          </Button>
          <Button
            variant="outline"
            className="hidden sm:flex"
            onClick={() => router.push("/procurement/stock-movements")}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            เคลื่อนไหววัสดุ
          </Button>
          <Button
            variant="outline"
            className="hidden sm:flex"
            onClick={() => router.push("/procurement/reports/annual")}
          >
            ส่งออกรายงาน
          </Button>
          {canCreateRequest && (
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-sm"
              onClick={() => router.push("/procurement/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              สร้างคำขอจัดซื้อ
            </Button>
          )}
        </div>
      </div>

      {/* 2. Important Alert / Next Action */}
      {pendingRequestsCount > 0 ? (
        <StatusAlert variant="warning">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-amber-900">มี {pendingRequestsCount} คำขอจัดซื้อรอดำเนินการ</h3>
            <p className="text-amber-800">กรุณาตรวจสอบคำขอที่รอแผนงาน การเงิน พัสดุ หัวหน้างบ หรือผู้บริหารอนุมัติ</p>
            <div>
              <Button variant="outline" size="sm" onClick={() => setValue("status", "PENDING")} className="bg-white/50 hover:bg-white text-amber-800 border-amber-300">
                ดูรายการรอดำเนินการ
              </Button>
            </div>
          </div>
        </StatusAlert>
      ) : canCreateRequest ? (
        <StatusAlert variant="info">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-blue-900">สามารถสร้างคำขอจัดซื้อจากโครงการที่อนุมัติแล้ว</h3>
            <p className="text-blue-800">เลือกโครงการที่ได้รับอนุมัติ ระบบจะแสดงงบคงเหลือและช่วยคำนวณยอดรวมให้อัตโนมัติ</p>
          </div>
        </StatusAlert>
      ) : (
        <StatusAlert variant="info">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-blue-900">ยังไม่มีคำขอจัดซื้อรอดำเนินการ</h3>
            <p className="text-blue-800">เมื่อมีการสร้างคำขอจัดซื้อ รายการที่เกี่ยวข้องจะแสดงที่นี่</p>
          </div>
        </StatusAlert>
      )}

      {/* 3. Summary Cards (Bento Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "คำขอทั้งหมด", value: summaryStats.total, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "รอดำเนินการ", value: summaryStats.pending, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100" },
          { label: "รอการเงินตรวจ", value: summaryStats.finance, icon: HandCoins, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
          { label: "รอพัสดุตรวจ", value: summaryStats.procurement, icon: FileSignature, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
          { label: "รอ ผอ. อนุมัติ", value: summaryStats.executive, icon: CheckCircle2, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
          { label: "อนุมัติแล้ว", value: summaryStats.approved, icon: Check, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
        ].map((card, idx) => (
          <Card key={idx} className={`shadow-sm ${card.bg} ${card.border}`}>
            <CardContent className="p-4 flex flex-col gap-2 relative overflow-hidden">
              <div className={`${card.color} mb-1`}>
                <card.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{card.value}</p>
              <p className="text-xs font-medium text-slate-600">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 4. Workflow Strip */}
      <Card className="shadow-sm overflow-hidden border-slate-200">
        <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            ขั้นตอนคำขอจัดซื้อ
          </h3>
        </div>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] bg-slate-100 -z-10 -translate-y-1/2" />
            
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400">
                  <span className="text-xs font-bold">{idx + 1}</span>
                </div>
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{step.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-slate-400 mt-4">
            สถานะของคำขอจัดซื้อจะแสดงตามขั้นตอนการตรวจสอบและอนุมัติ
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Main Content Area */}
        <div className="flex-1 w-full flex flex-col gap-4">
          
          {/* Quick Filter Chips placed before SearchFilterBar */}
          <div className="flex flex-wrap gap-2 py-2">
            <Button size="sm" variant={appliedValues.status === "" ? "default" : "outline"} onClick={() => setValue("status", "")}>ทั้งหมด</Button>
            <Button size="sm" variant={appliedValues.status === "PENDING" ? "default" : "outline"} onClick={() => setValue("status", "PENDING")}>รอแผนงานตรวจ</Button>
            <Button size="sm" variant={appliedValues.status === "PLAN_REVIEWED" ? "default" : "outline"} onClick={() => setValue("status", "PLAN_REVIEWED")}>รอการเงินตรวจ</Button>
            <Button size="sm" variant={appliedValues.status === "FINANCE_REVIEWED" ? "default" : "outline"} onClick={() => setValue("status", "FINANCE_REVIEWED")}>รอพัสดุตรวจ</Button>
            <Button size="sm" variant={appliedValues.status === "BUDGET_REVIEWED" ? "default" : "outline"} onClick={() => setValue("status", "BUDGET_REVIEWED")}>รอ ผอ. อนุมัติ</Button>
          </div>

          {/* 5. Search & Filter Bar */}
          <SearchFilterBar
            searchValue={draftValues.q}
            onSearchChange={(q) => setValue("q", q)}
            searchPlaceholder="ค้นหาเลขที่เอกสาร / เรื่อง / โครงการ..."
            activeFilters={activeFilters}
            onReset={reset}
            isLoading={isPending}
            totalCount={total}
            filteredCount={requests.length}
          />

          {/* 6. Purchase Request List */}
          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">เลขที่เอกสาร / เรื่อง</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">โครงการ / ผู้สร้าง</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">ยอดขอ (บาท)</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">งบคงเหลือ (บาท)</th>
                    <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">สถานะ</th>
                    <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">วันที่</th>
                    <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        ยังไม่มีคำขอจัดซื้อ
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr 
                        key={req.id} 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedRequest?.id === req.id ? 'bg-blue-50/50' : ''}`}
                        onClick={() => setSelectedRequest(req)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-primary line-clamp-1">{req.subject}</div>
                          <div className="text-xs text-slate-500 mt-1">{req.documentNo || "-"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-700 line-clamp-1">{req.project.projectName}</div>
                          <div className="text-xs text-slate-500 mt-1">{req.createdBy?.fullName || "ไม่ระบุ"}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800">
                          {formatBaht(req.requestedAmount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-medium ${(req.remainingBalance || 0) < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {req.remainingBalance !== null ? formatBaht(req.remainingBalance) : "-"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border ${STATUS_COLORS[req.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {STATUS_LABELS[req.status] || req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 text-xs">
                          {formatThaiDate(req.documentDate)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/procurement/${req.id}`);
                            }}
                          >
                            ดูรายละเอียด
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* 15. Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end">
                <PaginationControls
                  page={page}
                  limit={limit}
                  total={total}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                />
              </div>
            )}
          </Card>
        </div>

        {/* 11. Right Preview Panel (Desktop only) */}
        {selectedRequest && (
          <div className="w-full xl:w-[400px] shrink-0 xl:sticky xl:top-24">
            <Card className="shadow-lg border-primary/20 overflow-hidden">
              <div className="bg-primary/5 px-4 py-3 border-b border-primary/10 flex justify-between items-center">
                <h3 className="font-semibold text-primary">ตัวอย่างคำขอจัดซื้อ</h3>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => setSelectedRequest(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <CardContent className="p-0">
                <div className="p-4 flex flex-col gap-4 border-b">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">เลขที่เอกสาร</div>
                    <div className="text-sm font-medium">{selectedRequest.documentNo || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">เรื่อง</div>
                    <div className="text-sm font-medium">{selectedRequest.subject}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">โครงการ</div>
                    <div className="text-sm font-medium line-clamp-2">{selectedRequest.project.projectName}</div>
                  </div>
                  
                  {/* Budget Snapshot */}
                  <div className="bg-slate-50 rounded-lg p-3 border space-y-2 mt-2">
                    <div className="text-xs font-semibold text-slate-500 mb-2">ข้อมูลงบประมาณ</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">ยอดขอครั้งนี้:</span>
                      <span className="font-medium text-slate-800">{formatBaht(selectedRequest.requestedAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">คงเหลือหลังขอ:</span>
                      <span className={`font-medium ${(selectedRequest.remainingBalance || 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {selectedRequest.remainingBalance !== null ? formatBaht(selectedRequest.remainingBalance) : "-"}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">สถานะปัจจุบัน</div>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedRequest.status] || ''}`}>
                      {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full bg-white"
                    onClick={() => router.push(`/procurement/${selectedRequest.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียดเต็ม
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-white"
                    onClick={() => window.open(`/procurement/${selectedRequest.id}/print`, "_blank")}
                  >
                    <FileText className="mr-2 h-4 w-4" /> พิมพ์เอกสาร
                  </Button>
                  
                  {canApprove(selectedRequest) && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <Button variant="destructive" onClick={() => setIsRejectModalOpen(true)}>
                        <XCircle className="mr-2 h-4 w-4" /> ตีกลับ
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsApproveModalOpen(true)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> ตรวจสอบผ่าน
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 12. Action Modals */}
      <ConfirmDialog
        open={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="อนุมัติคำขอจัดซื้อ"
        description="เมื่ออนุมัติแล้ว ระบบจะบันทึกรายการใช้งบประมาณและปรับยอดคงเหลือของโครงการ"
        confirmLabel="อนุมัติคำขอ"
        cancelLabel="ยกเลิก"
        variant="default"
        loading={isSubmitting}
        onConfirm={() => handleAction("approve")}
      >
        <div className="py-4 space-y-4">
          <div className="bg-slate-50 p-3 rounded border text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">ยอดขอครั้งนี้:</span>
              <span className="font-semibold">{selectedRequest ? formatBaht(selectedRequest.requestedAmount) : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">คงเหลือหลังอนุมัติ:</span>
              <span className={`font-semibold ${selectedRequest && (selectedRequest.remainingBalance || 0) < 0 ? 'text-red-600' : ''}`}>
                {selectedRequest && selectedRequest.remainingBalance !== null ? formatBaht(selectedRequest.remainingBalance) : "-"}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">ความเห็นเพิ่มเติม (ตัวเลือก)</label>
            <textarea
              className="w-full border rounded-md p-2 text-sm h-20"
              placeholder="ระบุความเห็นเพิ่มเติม (ถ้ามี)"
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="ตีกลับคำขอจัดซื้อ"
        description="ผู้สร้างคำขอจะเห็นข้อความนี้และสามารถนำไปปรับแก้ได้"
        confirmLabel="ตีกลับคำขอ"
        cancelLabel="ยกเลิก"
        variant="destructive"
        loading={isSubmitting}
        onConfirm={() => handleAction("reject")}
        reasonRequired={true}
        reasonValue={rejectReason}
        onReasonChange={setRejectReason}
        reasonLabel="เหตุผลที่ตีกลับ"
        reasonPlaceholder="ระบุเหตุผลเพื่อให้ผู้สร้างคำขอนำไปแก้ไข..."
      />

    </div>
  );
}
