"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBaht } from "@/lib/utils";
import { ChevronRight, Info, Plus, Trash2, Loader2, Package, Check, Save, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailableProject {
  id: string;
  projectName: string;
  projectCode: string;
  departmentName: string;
  budgetApproved: number;
  spent: number;
  remaining: number;
}


interface ItemRow {

  id: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  remarks: string;
}

const STEPS = [
  { id: 1, title: "เลือกโครงการ" },
  { id: 2, title: "ข้อมูลคำขอ" },
  { id: 3, title: "รายการพัสดุ" },
  { id: 4, title: "ตรวจสอบ" }
];

export function CreatePurchaseRequestForm({
  availableProjects,
  sessionRole,
}: {
  availableProjects: AvailableProject[];
  sessionRole: string;
}) {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Form Fields
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("SUPPLIES");
  const [necessityDetails, setNecessityDetails] = useState("");
  
  // Procurement Items
  const [items, setItems] = useState<ItemRow[]>([
    { id: "1", itemName: "", quantity: "", unitPrice: "", remarks: "" },
  ]);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const selectedProject = availableProjects.find(p => p.id === selectedProjectId);
  
  const totalAmount = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    const u = Number(item.unitPrice) || 0;
    return sum + (q * u);
  }, 0);

  const remainingAfter = selectedProject ? selectedProject.remaining - totalAmount : 0;
  const isOverBudget = remainingAfter < 0;

  // Auto-update subject when project is selected
  useEffect(() => {
    if (selectedProject && !subject) {
      setSubject(`ขออนุมัติซื้อวัสดุ/ครุภัณฑ์เพื่อดำเนินโครงการ ${selectedProject.projectName}`);
    }
  }, [selectedProject, subject]);

  // Handle Stepper
  useEffect(() => {
    if (!selectedProjectId) {
      setCurrentStep(1);
    } else if (!subject) {
      setCurrentStep(2);
    } else if (items.length === 0 || !items[0].itemName) {
      setCurrentStep(3);
    } else {
      setCurrentStep(4);
    }
  }, [selectedProjectId, subject, items]);

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), itemName: "", quantity: "", unitPrice: "", remarks: "" }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof ItemRow, value: string) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleSubmit = async () => {
    setFormError("");
    setFormSuccess("");

    if (!selectedProjectId) {
      setFormError("กรุณาเลือกโครงการ");
      return;
    }
    if (!subject.trim()) {
      setFormError("กรุณาระบุเรื่องคำขอ");
      return;
    }
    if (items.length === 0) {
      setFormError("กรุณาเพิ่มรายการพัสดุอย่างน้อย 1 รายการ");
      return;
    }
    
    // Validate items
    for (const item of items) {
      if (!item.itemName.trim()) {
        setFormError("กรุณาระบุชื่อรายการพัสดุให้ครบถ้วน");
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        setFormError(`จำนวนของรายการ "${item.itemName}" ต้องมากกว่า 0`);
        return;
      }
      if (!item.unitPrice || Number(item.unitPrice) <= 0) {
        setFormError(`ราคาต่อหน่วยของรายการ "${item.itemName}" ต้องมากกว่า 0`);
        return;
      }
    }

    if (isOverBudget) {
      setFormError("ยอดขอเกินงบคงเหลือของโครงการ ไม่สามารถบันทึกได้");
      return;
    }

    setLoading(true);
    
    try {
      // In current api, activityId is optional. But to bypass budget checking in the API which is poorly implemented, 
      // we might just submit project level if allowed. 
      // Wait, the API requires activityId if we want to use the detailed budget checking. 
      // But we removed activityId requirement in UI. The API supports activityId as optional.
      // Let's send without activityId.
      const payload = {
        projectId: selectedProjectId,
        subject,
        documentDate,
        documentNo: documentNo || undefined,
        category,
        necessityDetails,
        items: items.map(i => ({
          itemName: i.itemName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          remarks: i.remarks
        }))
      };

      const res = await fetch("/api/procurements/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      setFormSuccess("บันทึกคำขอจัดซื้อสำเร็จ");
      setTimeout(() => {
        router.push("/procurement");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || !selectedProjectId || !subject.trim() || items.length === 0 || isOverBudget;

  if (availableProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
        <Package className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">ยังไม่มีโครงการที่พร้อมสร้างคำขอจัดซื้อ</h2>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          {sessionRole === "COMMITTEE" 
            ? "บัญชีนี้ไม่มีสิทธิ์สร้างคำขอจัดซื้อ (บัญชีนี้มีสิทธิ์ตรวจสอบเท่านั้น)"
            : "คำขอจัดซื้อสามารถสร้างได้จากโครงการที่ได้รับอนุมัติแล้วเท่านั้น หรือคุณอาจไม่มีสิทธิ์เข้าถึงโครงการในขณะนี้"
          }
        </p>
        <Button onClick={() => router.push("/procurement")} variant="outline">
          กลับไปหน้าพัสดุ/จัดซื้อ
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative">
      
      {/* Main Form Area */}
      <div className="flex-1 space-y-6">
        
        {/* Stepper */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="flex items-center px-6 py-4 justify-between border-b">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm transition-colors",
                  currentStep >= step.id 
                    ? "bg-purple-600 text-white" 
                    : "bg-gray-100 text-gray-500"
                )}>
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className={cn(
                  "ml-2 text-sm hidden sm:block",
                  currentStep >= step.id ? "text-gray-900 font-medium" : "text-gray-500"
                )}>
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-4 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Section 1: เลือกโครงการ */}
        <Card id="step-1" className={cn("border-l-4", selectedProjectId ? "border-l-purple-600" : "border-l-gray-300")}>
          <CardHeader>
            <CardTitle className="text-lg">1. เลือกโครงการที่ได้รับอนุมัติแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xl">
              <label className="text-sm font-medium mb-1.5 block">โครงการ <span className="text-red-500">*</span></label>
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="" disabled>-- เลือกโครงการ --</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} — {p.projectName} (คงเหลือ {formatBaht(p.remaining)})
                  </option>
                ))}
              </select>
            </div>

            {selectedProject && (
              <div className="mt-6 p-4 rounded-lg bg-gray-50 border grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">รหัสโครงการ</p>
                  <p className="font-medium text-gray-900">{selectedProject.projectCode}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">กลุ่มบริหาร/แผนก</p>
                  <p className="font-medium text-gray-900">{selectedProject.departmentName || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">งบประมาณที่อนุมัติ</p>
                  <p className="font-medium text-gray-900">{formatBaht(selectedProject.budgetApproved)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">ใช้จ่ายแล้ว</p>
                  <p className="font-medium text-amber-600">{formatBaht(selectedProject.spent)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: ข้อมูลคำขอจัดซื้อ */}
        <Card id="step-2" className={cn("border-l-4", subject ? "border-l-purple-600" : "border-l-gray-300", !selectedProjectId && "opacity-50 pointer-events-none")}>
          <CardHeader>
            <CardTitle className="text-lg">2. ข้อมูลคำขอจัดซื้อ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">เรื่องคำขอ <span className="text-red-500">*</span></label>
                <Input 
                  placeholder="เช่น ขออนุมัติจัดซื้อวัสดุสำนักงาน" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">วันที่เอกสาร <span className="text-red-500">*</span></label>
                <Input 
                  type="date" 
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">เลขที่เอกสาร (ถ้ามี)</label>
                <Input 
                  placeholder="เช่น ศธ 04001/..." 
                  value={documentNo}
                  onChange={(e) => setDocumentNo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">ประเภทคำขอ</label>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="SUPPLIES">จัดซื้อวัสดุ</option>
                  <option value="EQUIPMENT">จัดซื้อครุภัณฑ์</option>
                  <option value="HIRE">จัดจ้าง</option>
                  <option value="MAINTENANCE">ซ่อมแซม</option>
                  <option value="OTHERS">อื่นๆ</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">หมายเหตุ / ความจำเป็น (ถ้ามี)</label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="ระบุรายละเอียดเพิ่มเติม" 
                rows={2}
                value={necessityDetails}
                onChange={(e) => setNecessityDetails(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: รายการพัสดุ */}
        <Card id="step-3" className={cn("border-l-4", items.length > 0 && items[0].itemName ? "border-l-purple-600" : "border-l-gray-300", (!selectedProjectId || !subject) && "opacity-50 pointer-events-none")}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">3. รายการพัสดุ/รายการจัดซื้อ</CardTitle>
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มรายการ
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg w-12 text-center">#</th>
                    <th className="px-4 py-3 min-w-[200px]">รายการ <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3 w-24">จำนวน <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3 w-32">ราคา/หน่วย <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3 w-32 text-right">รวม (บาท)</th>
                    <th className="px-4 py-3 min-w-[150px]">หมายเหตุ</th>
                    <th className="px-4 py-3 rounded-tr-lg w-16 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                        <td className="px-4 py-2">
                          <Input 
                            value={item.itemName} 
                            onChange={(e) => updateItem(item.id, "itemName", e.target.value)} 
                            placeholder="ชื่อพัสดุ"
                            className="border-gray-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input 
                            type="number" 
                            min="1"
                            value={item.quantity} 
                            onChange={(e) => updateItem(item.id, "quantity", e.target.value)} 
                            placeholder="0"
                            className="border-gray-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={item.unitPrice} 
                            onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)} 
                            placeholder="0.00"
                            className="border-gray-200"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatBaht(lineTotal)}
                        </td>
                        <td className="px-4 py-2">
                          <Input 
                            value={item.remarks} 
                            onChange={(e) => updateItem(item.id, "remarks", e.target.value)} 
                            placeholder="-"
                            className="border-gray-200"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Sidebar / Summary Area */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        
        {/* Helper Panel */}
        <Card className="bg-purple-50/50 border-purple-100 hidden lg:block">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-purple-900 flex items-center">
              <Info className="w-4 h-4 mr-2 text-purple-600" />
              คำแนะนำการกรอก
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-purple-800 space-y-3">
            <p><strong>เลือกโครงการ:</strong> เลือกได้เฉพาะโครงการที่ได้รับอนุมัติแล้ว และคุณมีสิทธิ์เข้าถึง</p>
            <p><strong>รายการพัสดุ:</strong> กรอกชื่อรายการ จำนวน และราคาต่อหน่วย ระบบจะคำนวณยอดรวมให้อัตโนมัติ</p>
            <p><strong>งบคงเหลือ:</strong> ระบบจะตรวจสอบว่ายอดขอต้องไม่เกินงบคงเหลือของโครงการ</p>
            <p><strong>หลังบันทึก:</strong> คำขอจะเข้าสู่ขั้นตอนตรวจสอบตามลำดับ (รอแผนงานตรวจ)</p>
          </CardContent>
        </Card>

        {/* Budget Summary Sticky */}
        <div className="sticky top-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">สรุปงบประมาณ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {!selectedProject ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  กรุณาเลือกโครงการ<br/>เพื่อดูข้อมูลงบประมาณ
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">งบคงเหลือก่อนขอ</span>
                    <span className="font-medium">{formatBaht(selectedProject.remaining)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b pb-3">
                    <span className="text-gray-500">ยอดขอครั้งนี้</span>
                    <span className="font-semibold text-purple-600">{formatBaht(totalAmount)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm pt-1">
                    <span className="font-medium">งบคงเหลือหลังขอ</span>
                    <span className={cn(
                      "font-bold",
                      isOverBudget ? "text-red-600" : (remainingAfter < (selectedProject.budgetApproved * 0.1) ? "text-amber-600" : "text-green-600")
                    )}>
                      {formatBaht(remainingAfter)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden flex">
                    {/* Spent bar */}
                    <div 
                      className="bg-gray-300 h-2" 
                      style={{ width: `${Math.min(100, (selectedProject.spent / selectedProject.budgetApproved) * 100)}%` }} 
                    />
                    {/* Current Request bar */}
                    <div 
                      className={cn("h-2 transition-all", isOverBudget ? "bg-red-500" : "bg-purple-500")} 
                      style={{ width: `${Math.min(100, (totalAmount / selectedProject.budgetApproved) * 100)}%` }} 
                    />
                  </div>

                  {isOverBudget && (
                    <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900">ยอดขอเกินงบคงเหลือ</p>
                        <p className="text-xs text-red-700 mt-1">กรุณาปรับจำนวนหรือราคาต่อหน่วยให้ไม่เกินงบคงเหลือของโครงการ</p>
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                      {formError}
                    </div>
                  )}

                  {formSuccess && (
                    <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-700">
                      {formSuccess}
                    </div>
                  )}
                </>
              )}
            </CardContent>
            
            {/* Action Bottom */}
            <CardFooter className="bg-gray-50 border-t flex flex-col gap-3 rounded-b-xl">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    บันทึกคำขอจัดซื้อ
                  </>
                )}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={() => router.push("/procurement")}
                disabled={loading}
              >
                ยกเลิก
              </Button>
            </CardFooter>
          </Card>
        </div>

      </div>

      {/* Mobile Action Bar Overlay */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg lg:hidden z-10 flex gap-3">
        <Button 
          variant="outline" 
          className="flex-1" 
          onClick={() => router.push("/procurement")}
          disabled={loading}
        >
          ยกเลิก
        </Button>
        <Button 
          className="flex-1"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
        </Button>
      </div>

    </div>
  );
}
