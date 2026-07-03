"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusAlert } from "@/components/ui/status-alert";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import Link from "next/link";

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
    projectName: string;
    projectCode: string;
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
  committee: any; // JSON
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
  OTHERS: "อื่นๆ",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอแผนงานตรวจสอบ",
  PLAN_REVIEWED: "รอฝ่ายการเงินตรวจสอบงบ",
  FINANCE_REVIEWED: "รอฝ่ายพัสดุจัดทำใบสั่งซื้อ",
  PROCUREMENT_REVIEWED: "รอหัวหน้าฝ่ายงบเห็นชอบ",
  BUDGET_REVIEWED: "รอ ผอ. ลงนามอนุมัติซื้อ/จ้าง",
  APPROVED: "อนุมัติเรียบร้อย",
  REJECTED: "ปฏิเสธ / ส่งกลับแก้ไข",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PLAN_REVIEWED: "bg-blue-100 text-blue-800",
  FINANCE_REVIEWED: "bg-purple-100 text-purple-800",
  PROCUREMENT_REVIEWED: "bg-indigo-100 text-indigo-800",
  BUDGET_REVIEWED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

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
  const isApprovedRequest = request.status === "APPROVED" || !!request.directorApprovedAt;
  const canDeleteRequest = currentUser.role === "SUPER_ADMIN";

  // Determine current signing step based on request status
  let currentStep = "";
  if (request.status === "PENDING") currentStep = "plan";
  else if (request.status === "PLAN_REVIEWED") currentStep = "finance";
  else if (request.status === "FINANCE_REVIEWED") currentStep = "procurement";
  else if (request.status === "PROCUREMENT_REVIEWED") currentStep = "budget";
  else if (request.status === "BUDGET_REVIEWED") currentStep = "director";

  // Check if current user is authorized to sign the current step
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

  const handleApprove = async (isApproved: boolean) => {
    setError(null);
    setMessage(null);

    if (!opinion.trim() && !isApproved) {
      setError("กรุณากรอกความคิดเห็นกรณีปฏิเสธการจัดซื้อ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/procurements/requests/${request.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: currentStep,
          opinion: opinion.trim(),
          isApproved,
        }),
      });

      setLoading(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "เกิดข้อผิดพลาดในการลงนาม");
        return;
      }

      setMessage("ลงนามความเห็นเรียบร้อยแล้ว");
      setOpinion("");
      router.refresh();
    } catch (_e) {
      setLoading(false);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const handleDelete = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/procurements/requests/${request.id}`, {
        method: "DELETE",
      });

      setLoading(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
        return;
      }

      setMessage("ลบข้อมูลใบขออนุมัติจัดซื้อจัดจ้างสำเร็จ");
      setIsDeleteOpen(false);
      router.push("/procurement");
      router.refresh();
    } catch (_e) {
      setLoading(false);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  // Convert JSON committee to list
  const committeeList = Array.isArray(request.committee)
    ? request.committee
    : JSON.parse((request.committee as string) || "[]");

  return (
    <div className="space-y-6">
      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {message && <StatusAlert variant="success">{message}</StatusAlert>}

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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">ใบขออนุมัติจัดซื้อจัดจ้าง</h1>
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[request.status]}`}>
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">เลขที่: {request.documentNo ?? "รอดำเนินการ"} | วันที่เอกสาร: {formatThaiDate(request.documentDate)}</p>
          {canDeleteRequest && isApprovedRequest && (
            <p className="mt-2 max-w-xl text-xs text-muted-foreground">
              ใบขอนี้อนุมัติแล้ว การลบจะคืนผลทางงบประมาณและบันทึกประวัติการลบไว้
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {currentUser.role === "SUPER_ADMIN" && (
            <>
              <Button asChild variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950/20">
                <Link href={`/procurement/${request.id}/edit`}>
                  ✏️ แก้ไขคำขอ
                </Link>
              </Button>
              {canDeleteRequest && (
                <Button variant="destructive" onClick={() => setIsDeleteOpen(true)} disabled={loading}>
                🗑️ ลบคำขอ
              </Button>
              )}
            </>
          )}
          <Button variant="outline" asChild>
            <Link href="/procurement">ย้อนกลับ</Link>
          </Button>
          <Button asChild className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
            <Link href={`/procurement/${request.id}/print`} target="_blank">
              🖨️ พิมพ์บันทึกข้อความ (PDF)
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle>ข้อมูลใบขออนุมัติจัดซื้อจัดจ้าง</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground block">เรื่อง:</span>
                  <span className="font-medium text-base">{request.subject}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">ประเภทการจัดหา:</span>
                  <span className="font-medium">
                    {CATEGORY_LABELS[request.category] || request.category}
                    {request.categoryDetails ? ` (${request.categoryDetails})` : ""}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">โครงการหลัก:</span>
                  <span>{request.project.projectName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">กิจกรรมย่อยในโครงการ:</span>
                  <span className="font-semibold text-primary">{request.activity?.name ?? "โครงการหลัก"}</span>
                  {request.borrowedFrom && (() => {
                    const borrowedList = Array.isArray(request.borrowedFrom)
                      ? (request.borrowedFrom as any[])
                      : JSON.parse((request.borrowedFrom as string) || "[]");
                    if (borrowedList.length === 0) return null;
                    return (
                      <div className="mt-1.5 text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-300 p-2 border border-amber-200 dark:border-amber-900 rounded">
                        <span className="font-bold">ยืมงบประมาณเพิ่มเติมจากกิจกรรมย่อย:</span>
                        <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                          {borrowedList.map((b: any, idx: number) => (
                            <li key={idx}>
                              {b.activityName} ({formatBaht(Number(b.amount))} บาท)
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">แหล่งงบประมาณหลัก:</span>
                  <span>{request.fundSource?.name ?? "-"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">กำหนดไว้ในแผนปฏิบัติการ:</span>
                  <span>
                    {request.isNotInPlan ? (
                      <span className="text-red-500 font-bold">ไม่มีในแผนฯ (ขอกรณีจำเป็นเร่งด่วน)</span>
                    ) : (
                      `มีในแผนฯ หน้าที่ ${request.actionPlanPage ?? "-"}`
                    )}
                  </span>
                </div>
                {request.isNotInPlan && (
                  <div className="md:col-span-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                    <span className="font-bold block mb-1">เหตุผลความจำเป็น:</span>
                    {request.necessityDetails}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-muted-foreground block">ผู้เขียนคำขอ:</span>
                  <span>{request.createdBy?.fullName ?? "-"} ({request.createdBy?.role ?? "-"})</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">ฝ่าย/กลุ่มงาน:</span>
                  <span>{request.project.department?.name ?? "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle>รายการพัสดุและวงเงินจัดหา</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b text-left">
                    <th className="p-2 w-12 text-center">ที่</th>
                    <th className="p-2">รายการวัสดุ/ครุภัณฑ์</th>
                    <th className="p-2 w-20 text-right">จำนวน</th>
                    <th className="p-2 w-28 text-right">ราคาต่อหน่วย</th>
                    <th className="p-2 w-28 text-right">รวมเงิน (บาท)</th>
                    <th className="p-2">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item, idx) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 font-medium">{item.itemName}</td>
                      <td className="p-2 text-right">{item.quantity}</td>
                      <td className="p-2 text-right">{formatBaht(Number(item.unitPrice))}</td>
                      <td className="p-2 text-right font-medium">{formatBaht(Number(item.totalPrice))}</td>
                      <td className="p-2 text-muted-foreground">{item.remarks ?? "-"}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30">
                    <td colSpan={4} className="p-3 font-bold text-right">
                      ยอดเงินขออนุมัติจัดหาทั้งสิ้น
                    </td>
                    <td className="p-3 text-right font-bold text-primary text-base">
                      {formatBaht(Number(request.requestedAmount))}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Committee details */}
          <Card>
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle>รายชื่อคณะกรรมการตรวจรับพัสดุ</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {committeeList.map((comm: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded bg-background flex flex-col justify-center">
                    <div className="text-muted-foreground text-xs font-semibold">
                      {comm.role === "CHAIRMAN" ? "👑 ประธานกรรมการ" : "👥 กรรมการตรวจรับ"}
                    </div>
                    <div className="font-bold text-base mt-1">{comm.name}</div>
                  </div>
                ))}
                {committeeList.length === 0 && (
                  <div className="col-span-3 text-center p-4 text-muted-foreground">
                    ไม่มีการกำหนดคณะกรรมการตรวจรับพัสดุ
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Approvals side card */}
        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle>สถานะความเห็นและการเซ็นชื่อตรวจรับ</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 text-sm">
              {/* Step 1: Plan opinion */}
              <div className="border-l-2 pl-4 pb-2 border-primary/40 relative">
                <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                <div className="font-bold flex justify-between">
                  <span>1. งานแผนงาน (ตรวจสอบงบ)</span>
                  {request.planApprovedAt ? (
                    <span className="text-xs text-green-600 font-semibold">✓ ตรวจสอบแล้ว</span>
                  ) : (
                    <span className="text-xs text-yellow-600 font-semibold">รอตรวจสอบ</span>
                  )}
                </div>
                {request.planOpinion && (
                  <div className="mt-1 p-2 rounded bg-muted/50 text-xs italic">
                    &ldquo;{request.planOpinion}&rdquo;
                  </div>
                )}
                {request.planApprovedById && (
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    ลงชื่อ: {approverMap[request.planApprovedById] || "ผู้ใช้ระบบ"} ({formatThaiDate(request.planApprovedAt)})
                  </div>
                )}
              </div>

              {/* Step 2: Finance opinion */}
              <div className="border-l-2 pl-4 pb-2 border-primary/40 relative">
                <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                <div className="font-bold flex justify-between">
                  <span>2. งานการเงิน (เงินคงเหลือ)</span>
                  {request.financeApprovedAt ? (
                    <span className="text-xs text-green-600 font-semibold">✓ ลงชื่อแล้ว</span>
                  ) : (
                    <span className="text-xs text-yellow-600 font-semibold">รอการเงินลงนาม</span>
                  )}
                </div>
                {request.financeOpinion && (
                  <div className="mt-1 p-2 rounded bg-muted/50 text-xs italic">
                    &ldquo;{request.financeOpinion}&rdquo;
                  </div>
                )}
                {request.financeApprovedById && (
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    ลงชื่อ: {approverMap[request.financeApprovedById] || "ผู้ใช้ระบบ"} ({formatThaiDate(request.financeApprovedAt)})
                  </div>
                )}
              </div>

              {/* Step 3: Procurement opinion */}
              <div className="border-l-2 pl-4 pb-2 border-primary/40 relative">
                <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                <div className="font-bold flex justify-between">
                  <span>3. งานพัสดุ (จัดหา/สเปก)</span>
                  {request.procurementApprovedAt ? (
                    <span className="text-xs text-green-600 font-semibold">✓ ลงนามเห็นควร</span>
                  ) : (
                    <span className="text-xs text-yellow-600 font-semibold">รอพัสดุลงนาม</span>
                  )}
                </div>
                {request.procurementOpinion && (
                  <div className="mt-1 p-2 rounded bg-muted/50 text-xs italic">
                    &ldquo;{request.procurementOpinion}&rdquo;
                  </div>
                )}
                {request.procurementApprovedById && (
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    ลงชื่อ: {approverMap[request.procurementApprovedById] || "ผู้ใช้ระบบ"} ({formatThaiDate(request.procurementApprovedAt)})
                  </div>
                )}
              </div>

              {/* Step 4: Budget Management opinion */}
              <div className="border-l-2 pl-4 pb-2 border-primary/40 relative">
                <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                <div className="font-bold flex justify-between">
                  <span>4. หัวหน้ากลุ่มบริหารงบประมาณ</span>
                  {request.budgetApprovedAt ? (
                    <span className="text-xs text-green-600 font-semibold">✓ เห็นควรอนุมัติ</span>
                  ) : (
                    <span className="text-xs text-yellow-600 font-semibold">รอหัวหน้าลงนาม</span>
                  )}
                </div>
                {request.budgetOpinion && (
                  <div className="mt-1 p-2 rounded bg-muted/50 text-xs italic">
                    &ldquo;{request.budgetOpinion}&rdquo;
                  </div>
                )}
                {request.budgetApprovedById && (
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    ลงชื่อ: {approverMap[request.budgetApprovedById] || "ผู้ใช้ระบบ"} ({formatThaiDate(request.budgetApprovedAt)})
                  </div>
                )}
              </div>

              {/* Step 5: Director approval */}
              <div className="border-l-2 pl-4 border-primary/40 relative">
                <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                <div className="font-bold flex justify-between">
                  <span>5. ผู้อำนวยการโรงเรียน</span>
                  {request.directorApprovedAt ? (
                    <span className="text-xs text-green-600 font-semibold">✓ อนุมัติจัดหาสำเร็จ</span>
                  ) : (
                    <span className="text-xs text-yellow-600 font-semibold">รอ ผอ. อนุมัติ</span>
                  )}
                </div>
                {request.directorOpinion && (
                  <div className="mt-1 p-2 rounded bg-muted/50 text-xs italic">
                    &ldquo;{request.directorOpinion}&rdquo;
                  </div>
                )}
                {request.directorApprovedById && (
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    ลงชื่อ: {approverMap[request.directorApprovedById] || "ผู้อำนวยการ"} ({formatThaiDate(request.directorApprovedAt)})
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Form to sign off */}
          {canSign && request.status !== "APPROVED" && request.status !== "REJECTED" && (
            <Card className="border-primary shadow-lg">
              <CardHeader className="bg-primary/10 border-b">
                <CardTitle className="text-base text-primary">ลงชื่อแสดงความเห็น ({currentStep.toUpperCase()})</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="เขียนบันทึกความเห็นเกี่ยวกับใบขอซื้อพัสดุฉบับนี้..."
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleApprove(false)}
                  >
                    ส่งกลับแก้ไข / ปฏิเสธ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleApprove(true)}
                  >
                    เห็นชอบ / ลงนาม
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
