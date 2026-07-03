"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusAlert } from "@/components/ui/status-alert";
import { formatBaht } from "@/lib/utils";
import {
  MAX_PURCHASE_ITEMS,
  getPurchaseItemCapacityError,
} from "@/lib/procurement-print";

interface ItemRow {
  itemName: string;
  quantity: string;
  unitPrice: string;
  remarks: string;
}

interface User {
  id: string;
  fullName: string;
  role: string;
}

interface FundSource {
  id: string;
  name: string;
}

interface ProjectActivity {
  id: string;
  name: string;
  budget: any;
  remaining?: number;
  walletIds: string[];
}

interface BudgetWalletOption { id: string; name: string }

interface OtherProjectActivity {
  id: string;
  name: string;
  budget: number;
  remaining: number;
}

interface OtherProject {
  id: string;
  projectName: string;
  projectCode: string;
  activities: OtherProjectActivity[];
}

interface Project {
  id: string;
  projectName: string;
  projectCode: string;
  budgetApproved: any;
  fundSourceId: string | null;
  activities: ProjectActivity[];
}

interface InitialRequest {
  id: string;
  projectId: string;
  activityId: string;
  documentNo: string;
  documentDate: string;
  subject: string;
  category: string;
  categoryDetails: string;
  fundSourceId: string;
  budgetWalletId: string;
  actionPlanPage: string;
  isNotInPlan: boolean;
  necessityDetails: string;
  committee: any;
  borrowedFrom: any;
  items: {
    itemName: string;
    quantity: string;
    unitPrice: string;
    remarks: string;
  }[];
}

export function EditPurchaseRequestForm({
  project,
  users,
  fundSources,
  wallets,
  initialRequest,
  otherProjects,
}: {
  project: Project;
  users: User[];
  fundSources: FundSource[];
  wallets: BudgetWalletOption[];
  initialRequest: InitialRequest;
  otherProjects: OtherProject[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isHighAmountConfirmOpen, setIsHighAmountConfirmOpen] = useState(false);

  // Form Fields
  const [documentNo, setDocumentNo] = useState(initialRequest.documentNo);
  const [documentDate, setDocumentDate] = useState(initialRequest.documentDate);
  const [subject, setSubject] = useState(initialRequest.subject);
  const [activityId, setActivityId] = useState(initialRequest.activityId);
  const [category, setCategory] = useState(initialRequest.category);
  const [categoryDetails, setCategoryDetails] = useState(initialRequest.categoryDetails);
  const [fundSourceId, setFundSourceId] = useState(initialRequest.fundSourceId);
  const [budgetWalletId, setBudgetWalletId] = useState(initialRequest.budgetWalletId);
  const [actionPlanPage, setActionPlanPage] = useState(initialRequest.actionPlanPage);
  const [isNotInPlan, setIsNotInPlan] = useState(initialRequest.isNotInPlan);
  const [necessityDetails, setNecessityDetails] = useState(initialRequest.necessityDetails);

  // Committee selection initialization
  const committeeList = Array.isArray(initialRequest.committee)
    ? initialRequest.committee
    : JSON.parse((initialRequest.committee as string) || "[]");

  const getUserId = (commItem: any) => {
    if (!commItem) return "";
    if (commItem.id) return commItem.id;
    const found = users.find((u) => u.fullName === commItem.name);
    return found ? found.id : "";
  };

  const initialPresident = getUserId(committeeList.find((c: any) => c.role === "CHAIRMAN"));
  const initialMembers = committeeList.filter((c: any) => c.role === "MEMBER");
  const initialMember1 = getUserId(initialMembers[0]);
  const initialMember2 = getUserId(initialMembers[1]);

  const [presidentId, setPresidentId] = useState(initialPresident);
  const [member1Id, setMember1Id] = useState(initialMember1);
  const [member2Id, setMember2Id] = useState(initialMember2);

  // Borrowing State initialization — split same-project vs cross-project
  const [borrowedFrom, setBorrowedFrom] = useState<{ activityId: string; activityName: string; amount: string }[]>(() => {
    const list = Array.isArray(initialRequest.borrowedFrom)
      ? initialRequest.borrowedFrom
      : JSON.parse((initialRequest.borrowedFrom as string) || "[]");
    return list
      .filter((b: any) => !b.projectId) // same-project entries have no projectId
      .map((b: any) => ({
        activityId: b.activityId,
        activityName: b.activityName,
        amount: String(b.amount),
      }));
  });

  // Cross-project borrowing state
  const [crossBorrowSelectedProjectId, setCrossBorrowSelectedProjectId] = useState("");
  const [crossProjectBorrowedFrom, setCrossProjectBorrowedFrom] = useState<
    { projectId: string; projectName: string; activityId: string; activityName: string; amount: string }[]
  >(() => {
    const list = Array.isArray(initialRequest.borrowedFrom)
      ? initialRequest.borrowedFrom
      : JSON.parse((initialRequest.borrowedFrom as string) || "[]");
    return list
      .filter((b: any) => !!b.projectId) // cross-project entries have projectId
      .map((b: any) => ({
        projectId: b.projectId,
        projectName: b.projectName,
        activityId: b.activityId,
        activityName: b.activityName,
        amount: String(b.amount),
      }));
  });

  // Procurement Items
  const [items, setItems] = useState<ItemRow[]>(initialRequest.items);

  // Total Calculations
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    const total = items.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const u = Number(item.unitPrice) || 0;
      return sum + q * u;
    }, 0);
    setTotalAmount(total);
  }, [items]);

  // Thai Baht Text conversion helper
  function getBahtText(num: number): string {
    if (isNaN(num) || num <= 0) return "ศูนย์บาทถ้วน";
    num = Math.round(num * 100) / 100;
    const numStr = num.toFixed(2);
    const [integerPart, decimalPart] = numStr.split(".");
    
    const thNumbers = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const thPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    
    let result = "";
    
    if (Number(integerPart) > 0) {
      const len = integerPart.length;
      for (let i = 0; i < len; i++) {
        const digit = Number(integerPart[i]);
        if (digit !== 0) {
          const pos = len - 1 - i;
          if (pos % 6 === 0 && pos > 0) {
            result += "ล้าน";
          }
          
          const posName = thPositions[pos % 6];
          let digitName = thNumbers[digit];
          
          if (pos % 6 === 1 && digit === 1) {
            digitName = ""; // Just "สิบ"
          }
          if (pos % 6 === 1 && digit === 2) {
            digitName = "ยี่";
          }
          if (pos % 6 === 0 && digit === 1 && len > 1 && (pos % 6 === 0)) {
            digitName = "เอ็ด";
          }
          
          result += digitName + posName;
        }
      }
      result += "บาท";
    }
    
    if (Number(decimalPart) === 0 || decimalPart === "00") {
      result += "ถ้วน";
    } else {
      const len = decimalPart.length;
      for (let i = 0; i < len; i++) {
        const digit = Number(decimalPart[i]);
        if (digit !== 0) {
          const pos = len - 1 - i;
          const posName = thPositions[pos];
          let digitName = thNumbers[digit];
          
          if (pos === 1 && digit === 1) {
            digitName = "";
          }
          if (pos === 1 && digit === 2) {
            digitName = "ยี่";
          }
          if (pos === 0 && digit === 1 && decimalPart[0] !== "0") {
            digitName = "เอ็ด";
          }
          
          result += digitName + posName;
        }
      }
      result += "สตางค์";
    }
    
    return result;
  }

  // Row Manipulation
  const handleAddItem = () => {
    if (items.length >= MAX_PURCHASE_ITEMS) return;
    setItems([...items, { itemName: "", quantity: "", unitPrice: "", remarks: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleToggleBorrow = (actId: string, actName: string, isChecked: boolean) => {
    if (isChecked) {
      setBorrowedFrom([...borrowedFrom, { activityId: actId, activityName: actName, amount: "" }]);
    } else {
      setBorrowedFrom(borrowedFrom.filter(item => item.activityId !== actId));
    }
  };

  const handleBorrowAmountChange = (actId: string, amountStr: string) => {
    setBorrowedFrom(borrowedFrom.map(item => {
      if (item.activityId === actId) {
        return { ...item, amount: amountStr };
      }
      return item;
    }));
  };

  // Cross-project borrow handlers
  const handleToggleCrossBorrow = (projectId: string, projectName: string, actId: string, actName: string, isChecked: boolean) => {
    const key = `${projectId}::${actId}`;
    if (isChecked) {
      setCrossProjectBorrowedFrom([...crossProjectBorrowedFrom, { projectId, projectName, activityId: actId, activityName: actName, amount: "" }]);
    } else {
      setCrossProjectBorrowedFrom(crossProjectBorrowedFrom.filter(item => `${item.projectId}::${item.activityId}` !== key));
    }
  };

  const handleCrossBorrowAmountChange = (projectId: string, actId: string, amountStr: string) => {
    setCrossProjectBorrowedFrom(crossProjectBorrowedFrom.map(item => {
      if (item.projectId === projectId && item.activityId === actId) {
        return { ...item, amount: amountStr };
      }
      return item;
    }));
  };

  // Submit Handler
  const showFormError = (message: string) => {
    setFormSuccess(null);
    setFormError(message);
  };

  const handleSubmit = async (
    e?: React.FormEvent,
    skipHighAmountConfirm = false,
  ) => {
    e?.preventDefault();
    setFormError(null);

    if (!subject.trim()) return showFormError("กรุณากรอกเรื่องขออนุมัติ");
    const capacityError = getPurchaseItemCapacityError(items.length);
    if (capacityError) return showFormError(capacityError);

    // Dynamic Validation based on budget rules
    const requireThreeCommittees = totalAmount > 100000;
    if (!presidentId) {
      return showFormError("กรุณาเลือกประธานกรรมการตรวจรับ");
    }

    if (requireThreeCommittees) {
      if (!member1Id || !member2Id) {
        return showFormError("วงเงินเกิน 100,000 บาท บังคับต้องแต่งตั้งคณะกรรมการตรวจรับครบทั้ง 3 ท่าน");
      }
      if (presidentId === member1Id || presidentId === member2Id || member1Id === member2Id) {
        return showFormError("รายชื่อคณะกรรมการตรวจรับจะต้องไม่ซ้ำกัน");
      }
    }

    // Overspend & Borrowing Validation
    const selectedActivity = project.activities.find((act) => act.id === activityId);
    const activityRemaining = selectedActivity ? Number(selectedActivity.remaining ?? selectedActivity.budget) : 0;
    const isOverActivityBudget = selectedActivity && totalAmount > activityRemaining;
    const isOverProjectBudget = !selectedActivity && totalAmount > Number(project.budgetApproved);
    const isOverBudget = isOverActivityBudget || isOverProjectBudget;
    const budgetDeficit = isOverActivityBudget
      ? totalAmount - activityRemaining
      : isOverProjectBudget
      ? totalAmount - Number(project.budgetApproved)
      : 0;

    if (isOverBudget) {
      const totalSameBorrowed = borrowedFrom.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const totalCrossBorrowed = crossProjectBorrowedFrom.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const totalBorrowed = totalSameBorrowed + totalCrossBorrowed;
      if (totalBorrowed < budgetDeficit) {
        return showFormError(`งบประมาณไม่เพียงพอ ขาดอยู่ ${formatBaht(budgetDeficit)} บาท กรุณาระบุการยืมงบประมาณให้ครบถ้วน (ปัจจุบันระบุยืมไว้ ${formatBaht(totalBorrowed)})`);
      }

      for (const b of borrowedFrom) {
        const bAct = project.activities.find((a) => a.id === b.activityId);
        const bRemaining = bAct ? Number(bAct.remaining ?? bAct.budget) : 0;
        const bAmount = Number(b.amount) || 0;
        if (bAmount <= 0) {
          return showFormError(`กรุณาระบุจำนวนเงินที่ยืมจากกิจกรรม "${b.activityName}" ให้ถูกต้อง`);
        }
        if (bAmount > bRemaining) {
          return showFormError(`ไม่สามารถยืมเงินจากกิจกรรม "${b.activityName}" เกินงบประมาณที่คงเหลืออยู่ได้ (มีอยู่ ${formatBaht(bRemaining)})`);
        }
      }

      for (const b of crossProjectBorrowedFrom) {
        const bProj = otherProjects.find((p) => p.id === b.projectId);
        const bAct = bProj?.activities.find((a) => a.id === b.activityId);
        const bRemaining = bAct ? bAct.remaining : 0;
        const bAmount = Number(b.amount) || 0;
        if (bAmount <= 0) {
          return showFormError(`กรุณาระบุจำนวนเงินที่ยืมจากกิจกรรม "${b.activityName}" (${b.projectName}) ให้ถูกต้อง`);
        }
        if (bAmount > bRemaining) {
          return showFormError(`ไม่สามารถยืมเงินจากกิจกรรม "${b.activityName}" (${b.projectName}) เกินงบที่คงเหลือ (มีอยู่ ${formatBaht(bRemaining)})`);
        }
      }
    }

    // Build committee json structure
    const committeeList = [];
    const presUser = users.find(u => u.id === presidentId);
    if (presUser) {
      committeeList.push({ name: presUser.fullName, role: "CHAIRMAN", id: presUser.id });
    }
    const m1User = users.find(u => u.id === member1Id);
    if (m1User) {
      committeeList.push({ name: m1User.fullName, role: "MEMBER", id: m1User.id });
    }
    const m2User = users.find(u => u.id === member2Id);
    if (m2User) {
      committeeList.push({ name: m2User.fullName, role: "MEMBER", id: m2User.id });
    }

    if (totalAmount > 10000 && !skipHighAmountConfirm) {
      setIsHighAmountConfirmOpen(true);
      return;
    }

    setLoading(true);
    setFormSuccess(null);
    try {
      // Merge same-project and cross-project borrow lists
      const mergedBorrowedFrom = [
        ...borrowedFrom.map(item => ({
          activityId: item.activityId,
          activityName: item.activityName,
          amount: Number(item.amount),
        })),
        ...crossProjectBorrowedFrom.map(item => ({
          projectId: item.projectId,
          projectName: item.projectName,
          activityId: item.activityId,
          activityName: item.activityName,
          amount: Number(item.amount),
        })),
      ];

      const res = await fetch(`/api/procurements/requests/${initialRequest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          activityId,
          documentNo,
          documentDate,
          subject,
          category,
          categoryDetails,
          fundSourceId,
          budgetWalletId,
          actionPlanPage,
          isNotInPlan,
          necessityDetails,
          committee: committeeList,
          borrowedFrom: isOverBudget ? mergedBorrowedFrom : [],
          items: items.map(item => ({
            itemName: item.itemName,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            remarks: item.remarks,
          })),
        }),
      });

      setLoading(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return showFormError(err.error || "เกิดข้อผิดพลาดในการบันทึกคำขอ");
      }

      setFormSuccess("บันทึกการแก้ไขคำขอจัดซื้อจัดจ้างเรียบร้อยแล้ว");
      router.push(`/procurement/${initialRequest.id}`);
      router.refresh();
    } catch (_error) {
      setLoading(false);
      showFormError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && <StatusAlert variant="error">{formError}</StatusAlert>}
      {formSuccess && <StatusAlert variant="success">{formSuccess}</StatusAlert>}

      <ConfirmDialog
        open={isHighAmountConfirmOpen}
        title="ยืนยันวงเงินจัดซื้อ"
        description="วงเงินขอซื้อเกิน 10,000 บาท จะต้องมีใบเสนอราคาแนบด้วยในขั้นตอนการตรวจพัสดุ"
        confirmLabel="ยืนยันและบันทึก"
        variant="warning"
        loading={loading}
        onClose={() => setIsHighAmountConfirmOpen(false)}
        onConfirm={() => {
          setIsHighAmountConfirmOpen(false);
          void handleSubmit(undefined, true);
        }}
      />

      <Card className="shadow-lg border-muted/60 backdrop-blur-md">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle>1. ข้อมูลหัวเอกสารและแผนปฏิบัติการ</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold">เลขที่หนังสือราชการ (ที่)</label>
            <Input
              placeholder="เช่น รร.ปส. / ..."
              value={documentNo}
              onChange={(e) => setDocumentNo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">วันที่เขียนเอกสาร</label>
            <Input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">กิจกรรมย่อย (ในโครงการ)</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={activityId}
              onChange={(e) => {
                setActivityId(e.target.value);
                setBorrowedFrom([]);
                setCrossProjectBorrowedFrom([]);
                setCrossBorrowSelectedProjectId("");
              }}
            >
              <option value="">-- โครงการหลัก (ไม่ระบุคำขอย่อย) --</option>
              {project.activities.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.name} (คงเหลือ: {formatBaht(Number(act.remaining ?? act.budget))} / ทั้งหมด: {formatBaht(Number(act.budget))})
                </option>
              ))}
            </select>
          </div>

          {/* Borrowing UI Section */}
          {(() => {
            const selectedActivity = project.activities.find(act => act.id === activityId);
            const activityRemaining = selectedActivity ? Number(selectedActivity.remaining ?? selectedActivity.budget) : 0;
            const projectBudget = Number(project.budgetApproved);
            const isOverActivityBudget = selectedActivity && totalAmount > activityRemaining;
            const isOverProjectBudget = !selectedActivity && totalAmount > projectBudget;
            const isOverBudget = isOverActivityBudget || isOverProjectBudget;
            const budgetDeficit = isOverActivityBudget
              ? totalAmount - activityRemaining
              : isOverProjectBudget
              ? totalAmount - projectBudget
              : 0;
            const totalSameBorrowed = borrowedFrom.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
            const totalCrossBorrowed = crossProjectBorrowedFrom.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
            const totalBorrowed = totalSameBorrowed + totalCrossBorrowed;

            if (!isOverBudget) return null;

            const overLabel = isOverActivityBudget
              ? `เกินวงเงินคงเหลือของกิจกรรมย่อย &ldquo;${selectedActivity!.name}&rdquo; (คงเหลือ ${formatBaht(activityRemaining)} บาท)`
              : `เกินวงเงินงบประมาณที่เหลือของโครงการ (คงเหลือ ${formatBaht(projectBudget)} บาท)`;

            return (
              <div className="md:col-span-3 space-y-4 p-4 border rounded-lg bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/50 text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <h4 className="font-bold text-sm">ตรวจพบการใช้งบประมาณเกินวงเงินที่มีอยู่</h4>
                    <p className="text-xs mt-1">
                      ยอดจัดหาทั้งหมด {formatBaht(totalAmount)} บาท{" "}
                      <span dangerouslySetInnerHTML={{ __html: overLabel }} />{" "}
                      เป็นจำนวนเงิน <span className="font-bold">{formatBaht(budgetDeficit)}</span> บาท
                    </p>
                  </div>
                </div>

                {/* Section A: same-project activities (if any) */}
                {project.activities.filter((act) => act.id !== activityId).length > 0 && (
                  <div className="pt-2 border-t border-amber-200 dark:border-amber-900 space-y-3">
                    <p className="text-xs font-semibold">ยืมงบจากกิจกรรมย่อยอื่นในโครงการเดียวกัน:</p>
                    <div className="space-y-2">
                      {project.activities
                        .filter((act) => act.id !== activityId)
                        .map((act) => {
                          const remaining = Number(act.remaining ?? act.budget);
                          const isChecked = borrowedFrom.some((b) => b.activityId === act.id);
                          const borrowItem = borrowedFrom.find((b) => b.activityId === act.id);
                          return (
                            <div key={act.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 rounded bg-background border text-foreground">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`borrow-${act.id}`}
                                  checked={isChecked}
                                  disabled={remaining <= 0}
                                  onChange={(e) => handleToggleBorrow(act.id, act.name, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor={`borrow-${act.id}`} className="text-sm font-medium cursor-pointer">
                                  {act.name} <span className="text-xs text-muted-foreground">(คงเหลือ {formatBaht(remaining)} บาท)</span>
                                </label>
                              </div>
                              {isChecked && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">จำนวนที่ยืม:</span>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">฿</span>
                                    <Input
                                      type="number"
                                      placeholder="0.00"
                                      value={borrowItem?.amount || ""}
                                      onChange={(e) => handleBorrowAmountChange(act.id, e.target.value)}
                                      className="w-36 h-9 pl-6 text-right text-xs"
                                      max={remaining}
                                      required
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Section B: cross-project borrow */}
                {otherProjects.length > 0 && (
                  <div className="pt-2 border-t border-amber-200 dark:border-amber-900 space-y-3">
                    <p className="text-xs font-semibold">📦 ยืมงบจากโครงการอื่น:</p>
                    <div className="flex items-center gap-2">
                      <select
                        className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={crossBorrowSelectedProjectId}
                        onChange={(e) => setCrossBorrowSelectedProjectId(e.target.value)}
                      >
                        <option value="">-- เลือกโครงการที่ต้องการยืมงบ --</option>
                        {otherProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.projectCode}] {p.projectName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {crossBorrowSelectedProjectId && (() => {
                      const selProj = otherProjects.find((p) => p.id === crossBorrowSelectedProjectId)!;
                      return (
                        <div className="space-y-2 pl-2">
                          {selProj.activities.map((act) => {
                            const key = `${selProj.id}::${act.id}`;
                            const isChecked = crossProjectBorrowedFrom.some(
                              (b) => b.projectId === selProj.id && b.activityId === act.id
                            );
                            const borrowItem = crossProjectBorrowedFrom.find(
                              (b) => b.projectId === selProj.id && b.activityId === act.id
                            );
                            return (
                              <div key={key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 rounded bg-background border text-foreground">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`cross-${key}`}
                                    checked={isChecked}
                                    onChange={(e) => handleToggleCrossBorrow(selProj.id, selProj.projectName, act.id, act.name, e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor={`cross-${key}`} className="text-sm font-medium cursor-pointer">
                                    {act.name}{" "}
                                    <span className="text-xs text-muted-foreground">(คงเหลือ {formatBaht(act.remaining)} บาท)</span>
                                  </label>
                                </div>
                                {isChecked && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">จำนวนที่ยืม:</span>
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">฿</span>
                                      <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={borrowItem?.amount || ""}
                                        onChange={(e) => handleCrossBorrowAmountChange(selProj.id, act.id, e.target.value)}
                                        className="w-36 h-9 pl-6 text-right text-xs"
                                        max={act.remaining}
                                        required
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {crossProjectBorrowedFrom.length > 0 && (
                      <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1 pt-1">
                        <p className="font-semibold">รายการที่เลือกยืมข้ามโครงการ:</p>
                        {crossProjectBorrowedFrom.map((b, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{b.projectName} / {b.activityName}</span>
                            <span className="font-mono">{b.amount ? formatBaht(Number(b.amount)) : "ยังไม่ระบุ"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Progress */}
                <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-amber-200 dark:border-amber-900">
                  <span>ยอดงบประมาณที่ต้องการยืม: {formatBaht(budgetDeficit)} บาท</span>
                  <span className={totalBorrowed >= budgetDeficit ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                    ยอดเงินระบุยืมแล้ว: {formatBaht(totalBorrowed)} บาท
                  </span>
                </div>
              </div>
            );
          })()}

          {wallets.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">กระเป๋างบประมาณ</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={budgetWalletId}
                onChange={(e) => setBudgetWalletId(e.target.value)}
                required
              >
                <option value="">-- เลือกกระเป๋าที่กันวงเงินไว้ --</option>
                {wallets
                  .filter((wallet) => {
                    const activity = project.activities.find((item) => item.id === activityId);
                    return !activity || activity.walletIds.length === 0 || activity.walletIds.includes(wallet.id);
                  })
                  .map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
              </select>
            </div>
          )}

          <div className="md:col-span-3 space-y-2">
            <label className="text-sm font-semibold">เรื่องขออนุมัติ</label>
            <Input
              placeholder="ระบุเรื่องขออนุมัติซื้อ/จ้าง..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">ประเภทการขอซื้อ/จ้าง</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="SUPPLIES">วัสดุ</option>
              <option value="EQUIPMENT">ครุภัณฑ์</option>
              <option value="FUEL">น้ำมันเชื้อเพลิง</option>
              <option value="RENOVATION">ปรับปรุง/ซ่อมแซม</option>
              <option value="REMUNERATION">เบิกค่าตอบแทน</option>
              <option value="EXPENSES">เบิกเงินค่าใช้สอย</option>
              <option value="TEMP_WAGE">ค่าจ้างชั่วคราว</option>
              <option value="CONTRACT">จ้างเหมา</option>
              <option value="OTHERS">อื่นๆ (ระบุรายละเอียดเพิ่มเติม)</option>
            </select>
          </div>

          {category === "OTHERS" && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">ระบุรายละเอียดเพิ่มเติม</label>
              <Input
                placeholder="ระบุเพิ่มเติม..."
                value={categoryDetails}
                onChange={(e) => setCategoryDetails(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold">แหล่งงบประมาณ</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={fundSourceId}
              onChange={(e) => setFundSourceId(e.target.value)}
            >
              <option value="">-- ดึงงบตามประเภทของโครงการ --</option>
              {fundSources.map((fs) => (
                <option key={fs.id} value={fs.id}>
                  {fs.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">กำหนดไว้ในแผนปฏิบัติการ หน้าที่</label>
            <Input
              placeholder="เช่น หน้า 12"
              value={actionPlanPage}
              onChange={(e) => setActionPlanPage(e.target.value)}
              disabled={isNotInPlan}
            />
          </div>

          <div className="md:col-span-3 space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNotInPlan"
                checked={isNotInPlan}
                onChange={(e) => {
                  setIsNotInPlan(e.target.checked);
                  if (e.target.checked) setActionPlanPage("");
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="isNotInPlan" className="text-sm font-bold text-red-600 dark:text-red-400">
                ไม่ได้กำหนดไว้ในแผนปฏิบัติการประจำปี (ขออนุมัติกรณีเร่งด่วน/จำเป็น)
              </label>
            </div>

            {isNotInPlan && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-red-600 dark:text-red-400">รายละเอียดความจำเป็นเร่งด่วน</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="ระบุเหตุผลความจำเป็นที่ต้องจัดซื้อจัดจ้างนอกแผนปฏิบัติการ..."
                  value={necessityDetails}
                  onChange={(e) => setNecessityDetails(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-muted/60">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle>2. รายการรายละเอียดพัสดุจัดซื้อจัดจ้าง</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted border-b text-left">
                  <th className="p-2 w-12 text-center">ที่</th>
                  <th className="p-2 min-w-[250px]">รายการวัสดุ/ครุภัณฑ์</th>
                  <th className="p-2 w-24 text-right">จำนวนหน่วย</th>
                  <th className="p-2 w-32 text-right">ราคาต่อหน่วย</th>
                  <th className="p-2 w-36 text-right">รวมเงิน (บาท)</th>
                  <th className="p-2 min-w-[150px]">หมายเหตุ</th>
                  <th className="p-2 w-16 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => {
                  const qty = Number(row.quantity) || 0;
                  const unitP = Number(row.unitPrice) || 0;
                  const rowSum = qty * unitP;
                  return (
                    <tr key={index} className="border-b">
                      <td className="p-2 text-center font-mono">{index + 1}</td>
                      <td className="p-2">
                        <Input
                          placeholder="ชื่อรายการ เช่น กระดาษ A4"
                          value={row.itemName}
                          onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                          required
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={row.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          className="text-right"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={row.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                          className="text-right"
                          required
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-medium">
                        {formatBaht(rowSum)}
                      </td>
                      <td className="p-2">
                        <Input
                          placeholder="เช่น แหล่งสเปก"
                          value={row.remarks}
                          onChange={(e) => handleItemChange(index, "remarks", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                        >
                          ลบ
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={items.length >= MAX_PURCHASE_ITEMS}
            >
              + เพิ่มรายการพัสดุ
            </Button>
            <div className="text-xs text-muted-foreground">
              ใช้ได้สูงสุด {MAX_PURCHASE_ITEMS} รายการต่อบันทึกข้อความ
              {items.length >= MAX_PURCHASE_ITEMS && (
                <span className="ml-1 font-semibold text-amber-700">
                  หากมีรายการเพิ่มเติม กรุณาแยกเป็นคำขอใหม่
                </span>
              )}
            </div>
            <div className="text-right space-y-1">
              <div className="text-lg font-bold">
                ยอดรวมเงินทั้งสิ้น: <span className="text-primary">{formatBaht(totalAmount)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                (ตัวอักษร: <span className="font-semibold text-primary">{getBahtText(totalAmount)}</span>)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-muted/60">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle>
            3. คณะกรรมการตรวจรับพัสดุ
            <span className="text-xs font-normal ml-2 block md:inline text-muted-foreground">
              (ตามระเบียบ: วงเงินเกิน 100,000 บาท บังคับ 3 ท่าน / ต่ำกว่า 100,000 บาท แนะนำ 1-3 ท่าน)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary">ประธานกรรมการตรวจรับ</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={presidentId}
              onChange={(e) => setPresidentId(e.target.value)}
              required
            >
              <option value="">-- เลือกบุคลากร (ประธาน) --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">กรรมการคนที่ 1</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={member1Id}
              onChange={(e) => setMember1Id(e.target.value)}
              required={totalAmount > 100000}
            >
              <option value="">-- เลือกบุคลากร (กรรมการ) --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">กรรมการคนที่ 2</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={member2Id}
              onChange={(e) => setMember2Id(e.target.value)}
              required={totalAmount > 100000}
            >
              <option value="">-- เลือกบุคลากร (กรรมการ) --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {totalAmount > 100000 && (
            <div className="md:col-span-3 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
              ⚠️ วงเงินคำขอจัดซื้อจัดจ้างนี้มีมูลค่าเกิน 100,000 บาท ตามระเบียบราชการจะต้องระบุรายชื่อกรรมการตรวจรับพัสดุครบถ้วน 3 ท่าน
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/procurement/${initialRequest.id}`)}
          disabled={loading}
        >
          ยกเลิก
        </Button>
        <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
          {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไขคำขอ"}
        </Button>
      </div>
    </form>
  );
}
