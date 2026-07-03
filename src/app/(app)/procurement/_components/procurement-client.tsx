"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  PENDING: "bg-yellow-100 text-yellow-800",
  PLAN_REVIEWED: "bg-blue-100 text-blue-800",
  FINANCE_REVIEWED: "bg-purple-100 text-purple-800",
  PROCUREMENT_REVIEWED: "bg-indigo-100 text-indigo-800",
  BUDGET_REVIEWED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

type AvailableProject = {
  id: string;
  projectCode: string;
  projectName: string;
  department: { name: string } | null;
};

type EditableItemRow = {
  id?: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  remarks: string;
};

interface ProcurementClientProps {
  requests: PurchaseRequestListRow[];
  availableProjects: AvailableProject[];
  showProcureCol: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  initialQuery: PurchaseRequestListQueryValues;
}

export function ProcurementClient({
  requests,
  availableProjects,
  showProcureCol,
  total,
  page,
  limit,
  totalPages,
  initialQuery,
}: ProcurementClientProps) {
  const router = useRouter();
  const {
    appliedValues,
    draftValues,
    isDirty,
    isPending,
    setValue,
    reset,
    goToPage,
  } = useListControls({
    initialValues: initialQuery,
    defaults: defaultPurchaseRequestListQueryValues,
  });

  const [projectSearch, setProjectSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "create">("all");
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequestListRow | null>(null);
  const [editItems, setEditItems] = useState<EditableItemRow[]>([]);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [isSavingInline, setIsSavingInline] = useState(false);

  const departments = useMemo(() => {
    const deps = new Set<string>();
    availableProjects.forEach((p) => {
      if (p.department?.name) deps.add(p.department.name);
    });
    return Array.from(deps).sort();
  }, [availableProjects]);

  const filteredProjects = useMemo(() => {
    return availableProjects.filter((p) => {
      const matchSearch =
        p.projectCode.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.projectName.toLowerCase().includes(projectSearch.toLowerCase());
      const matchDept =
        selectedDepartment === "" || p.department?.name === selectedDepartment;
      return matchSearch && matchDept;
    });
  }, [availableProjects, projectSearch, selectedDepartment]);

  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const sortOptions = [
    { value: "createdAt", label: "วันที่สร้างล่าสุด" },
    { value: "documentDate", label: "วันที่เอกสาร" },
    { value: "requestedAmount", label: "ยอดเงินรวม" },
    { value: "status", label: "สถานะคำขอ" },
    { value: "subject", label: "เรื่อง" },
  ];

  const activeFilters = useMemo<ActiveFilterSummary[]>(() => {
    const items: ActiveFilterSummary[] = [];

    if (appliedValues.q) {
      items.push({ key: "q", label: "ค้นหา", value: appliedValues.q });
    }
    if (appliedValues.status) {
      items.push({
        key: "status",
        label: "สถานะ",
        value: STATUS_LABELS[appliedValues.status] ?? appliedValues.status,
      });
    }
    if (appliedValues.month) {
      items.push({ key: "month", label: "เดือน", value: appliedValues.month });
    }
    if (appliedValues.dateFrom) {
      items.push({ key: "dateFrom", label: "ตั้งแต่", value: appliedValues.dateFrom });
    }
    if (appliedValues.dateTo) {
      items.push({ key: "dateTo", label: "ถึง", value: appliedValues.dateTo });
    }
    if (appliedValues.minAmount) {
      items.push({
        key: "minAmount",
        label: "ยอดขั้นต่ำ",
        value: formatBaht(Number(appliedValues.minAmount)),
      });
    }
    if (appliedValues.maxAmount) {
      items.push({
        key: "maxAmount",
        label: "ยอดสูงสุด",
        value: formatBaht(Number(appliedValues.maxAmount)),
      });
    }

    return items;
  }, [appliedValues]);

  const openLedgerDrawer = (request: PurchaseRequestListRow) => {
    setSelectedRequest(request);
    setDrawerError(null);
    setPageMessage(null);
    setEditItems(
      request.items.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        remarks: item.remarks ?? "",
      })),
    );
  };

  const updateEditItem = (
    index: number,
    field: keyof EditableItemRow,
    value: string,
  ) => {
    setEditItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const editTotal = editItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  const saveInlineItems = async () => {
    if (!selectedRequest || !selectedRequest.canInlineEdit) return;

    for (const item of editItems) {
      if (!item.itemName.trim()) {
        setDrawerError("กรุณาระบุรายการพัสดุให้ครบ");
        return;
      }
      if ((Number(item.quantity) || 0) <= 0 || (Number(item.unitPrice) || 0) <= 0) {
        setDrawerError("จำนวนและราคาต่อหน่วยต้องมากกว่า 0");
        return;
      }
    }

    setIsSavingInline(true);
    setDrawerError(null);
    try {
      const response = await fetch(`/api/procurements/requests/${selectedRequest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedRequest.project.id,
          activityId: selectedRequest.activity?.id ?? "",
          documentNo: selectedRequest.documentNo ?? "",
          documentDate: selectedRequest.documentDate.slice(0, 10),
          subject: selectedRequest.subject,
          category: selectedRequest.category,
          categoryDetails: selectedRequest.categoryDetails ?? "",
          fundSourceId: selectedRequest.fundSourceId ?? "",
          budgetWalletId: selectedRequest.budgetWalletId ?? "",
          actionPlanPage: selectedRequest.actionPlanPage ?? "",
          isNotInPlan: selectedRequest.isNotInPlan,
          necessityDetails: selectedRequest.necessityDetails ?? "",
          committee: selectedRequest.committee ?? [],
          borrowedFrom: selectedRequest.borrowedFrom ?? [],
          items: editItems.map((item) => ({
            itemName: item.itemName.trim(),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            remarks: item.remarks.trim(),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "บันทึกทะเบียนตัดยอดไม่สำเร็จ");
      }

      setSelectedRequest(null);
      setEditItems([]);
      setPageMessage("บันทึกทะเบียนตัดยอดพัสดุเรียบร้อยแล้ว");
      router.refresh();
    } catch (cause) {
      setDrawerError(cause instanceof Error ? cause.message : "บันทึกทะเบียนตัดยอดไม่สำเร็จ");
    } finally {
      setIsSavingInline(false);
    }
  };

  return (
    <div className="space-y-6">
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ทะเบียนตัดยอดพัสดุ
                </div>
                <h2 className="mt-1 truncate text-xl font-bold">{selectedRequest.subject}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedRequest.project.projectCode} · {selectedRequest.project.projectName}
                  {selectedRequest.activity ? ` · ${selectedRequest.activity.name}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSelectedRequest(null)}
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <BalanceTile label="จัดสรรทั้งหมด" value={selectedRequest.allocatedBudget} />
                <BalanceTile label="คงเหลือจากครั้งก่อน" value={selectedRequest.previousBalance} />
                <BalanceTile label="ยอดขอปัจจุบัน" value={editTotal} />
                <BalanceTile label="คงเหลือหลังใบนี้" value={selectedRequest.remainingBalance} />
              </div>

              <div className="rounded-xl border">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                  <div>
                    <h3 className="font-semibold">ใช้ทำอะไรไปบ้าง</h3>
                    <p className="text-xs text-muted-foreground">
                      รายการนี้เป็นต้นทางของยอดขออนุมัติและยอดคงเหลือในบันทึกข้อความ
                    </p>
                  </div>
                  {selectedRequest.canInlineEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditItems((items) => [
                          ...items,
                          { itemName: "", quantity: "1", unitPrice: "", remarks: "" },
                        ])
                      }
                    >
                      <Plus className="h-4 w-4" />
                      เพิ่มรายการ
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-left text-muted-foreground">
                        <th className="w-12 p-3 text-center">#</th>
                        <th className="p-3">รายการ</th>
                        <th className="w-24 p-3 text-right">จำนวน</th>
                        <th className="w-32 p-3 text-right">ราคา/หน่วย</th>
                        <th className="w-36 p-3 text-right">รวม</th>
                        <th className="p-3">หมายเหตุ</th>
                        {selectedRequest.canInlineEdit && <th className="w-12 p-3"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, index) => {
                        const rowTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                        return (
                          <tr key={item.id ?? index} className="border-b">
                            <td className="p-3 text-center font-mono">{index + 1}</td>
                            <td className="p-3">
                              {selectedRequest.canInlineEdit ? (
                                <input
                                  value={item.itemName}
                                  onChange={(event) => updateEditItem(index, "itemName", event.target.value)}
                                  className="h-9 w-full rounded-md border bg-background px-2"
                                />
                              ) : (
                                item.itemName
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {selectedRequest.canInlineEdit ? (
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(event) => updateEditItem(index, "quantity", event.target.value)}
                                  className="h-9 w-20 rounded-md border bg-background px-2 text-right"
                                />
                              ) : (
                                item.quantity
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {selectedRequest.canInlineEdit ? (
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(event) => updateEditItem(index, "unitPrice", event.target.value)}
                                  className="h-9 w-28 rounded-md border bg-background px-2 text-right"
                                />
                              ) : (
                                formatBaht(Number(item.unitPrice))
                              )}
                            </td>
                            <td className="p-3 text-right font-semibold">{formatBaht(rowTotal)}</td>
                            <td className="p-3">
                              {selectedRequest.canInlineEdit ? (
                                <input
                                  value={item.remarks}
                                  onChange={(event) => updateEditItem(index, "remarks", event.target.value)}
                                  className="h-9 w-full rounded-md border bg-background px-2"
                                />
                              ) : (
                                item.remarks || "-"
                              )}
                            </td>
                            {selectedRequest.canInlineEdit && (
                              <td className="p-3 text-right">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  disabled={editItems.length === 1}
                                  onClick={() => setEditItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30">
                        <td colSpan={4} className="p-3 text-right font-bold">รวมยอดขออนุมัติ</td>
                        <td className="p-3 text-right font-bold text-primary">{formatBaht(editTotal)}</td>
                        <td colSpan={selectedRequest.canInlineEdit ? 2 : 1}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {drawerError && <StatusAlert variant="error">{drawerError}</StatusAlert>}
            </div>

            <div className="flex justify-between gap-3 border-t px-5 py-4">
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/procurement/${selectedRequest.id}`}>เปิดรายละเอียด</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/procurement/${selectedRequest.id}/print`} target="_blank">พิมพ์บันทึกข้อความ</Link>
                </Button>
              </div>
              {selectedRequest.canInlineEdit && (
                <Button onClick={saveInlineItems} disabled={isSavingInline || editItems.length === 0}>
                  บันทึกการแก้ไข
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          พัสดุ / จัดซื้อจัดจ้าง
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:text-base">
          จัดการ บันทึกคำขอ และติดตามความคืบหน้าการจัดซื้อจัดจ้างพัสดุรายโครงการ
        </p>
      </div>

      {pageMessage && <StatusAlert variant="success">{pageMessage}</StatusAlert>}

      {showProcureCol && (
        <div className="flex border-b border-border/60 pb-px">
          <button
            onClick={() => setActiveTab("all")}
            className={`relative pb-3 text-sm font-semibold transition-all ${
              activeTab === "all"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            รายการคำขอทั้งหมด ({total})
            {activeTab === "all" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`relative ml-6 pb-3 text-sm font-semibold transition-all ${
              activeTab === "create"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            สร้างคำขอใหม่
            {activeTab === "create" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      )}

      {showProcureCol && activeTab === "create" && (
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="max-w-3xl text-xl leading-tight">
              สร้างเอกสารขอจัดซื้อจัดจ้างพัสดุรายโครงการ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-b border-border/50 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="ค้นหารหัส หรือชื่อโครงการ..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-[200px]"
                >
                  <option value="">ทุกฝ่าย/กลุ่มงาน</option>
                  {departments.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {filteredProjects.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">
                  ไม่พบโครงการที่ตรงกับเงื่อนไข
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm"
                  >
                    <div className="mb-3 inline-flex rounded-full bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      {project.projectCode}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          โครงการ
                        </div>
                        <div className="mt-1 text-base font-bold leading-snug">
                          {project.projectName}
                        </div>
                      </div>
                      <DetailRow
                        label="ฝ่าย/กลุ่มงาน"
                        value={project.department?.name ?? "-"}
                      />
                      <Button asChild className="w-full">
                        <Link href={`/procurement/new?projectId=${project.id}`}>
                          เขียนใบขออนุมัติ
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-3">รหัส</th>
                    <th className="p-3">โครงการ</th>
                    <th className="p-3">ฝ่าย/กลุ่มงาน</th>
                    <th className="p-3 text-right">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                        ไม่พบโครงการที่ตรงกับเงื่อนไข
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <tr key={project.id} className="border-b">
                        <td className="p-3 font-mono text-xs">{project.projectCode}</td>
                        <td className="p-3 font-medium">{project.projectName}</td>
                        <td className="p-3">{project.department?.name ?? "-"}</td>
                        <td className="p-3 text-right">
                          <Button size="sm" asChild variant="outline">
                            <Link href={`/procurement/new?projectId=${project.id}`}>
                              เขียนใบขออนุมัติ
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(!showProcureCol || activeTab === "all") && (
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="max-w-3xl text-xl leading-tight">
              ทะเบียนตัดยอดพัสดุ
            </CardTitle>
          </CardHeader>
        <CardContent className="space-y-4 p-4">
          <SearchFilterBar
            searchValue={draftValues.q}
            onSearchChange={(value) => setValue("q", value)}
            searchPlaceholder="ค้นหาเรื่อง, เลขคำขอ, ชื่อโครงการ, ผู้บันทึก..."
            filters={[
              {
                type: "select",
                key: "status",
                label: "สถานะ",
                options: statusOptions,
                value: draftValues.status,
                onChange: (value) => setValue("status", value),
                allLabel: "ทุกสถานะ",
              },
              {
                type: "month",
                key: "month",
                label: "เดือน",
                value: draftValues.month,
                onChange: (value) => setValue("month", value),
              },
              {
                type: "date",
                key: "dateFrom",
                label: "วันที่เริ่มต้น",
                value: draftValues.dateFrom,
                onChange: (value) => setValue("dateFrom", value),
              },
              {
                type: "date",
                key: "dateTo",
                label: "วันที่สิ้นสุด",
                value: draftValues.dateTo,
                onChange: (value) => setValue("dateTo", value),
              },
              {
                type: "number",
                key: "minAmount",
                label: "ยอดขั้นต่ำ",
                value: draftValues.minAmount,
                onChange: (value) => setValue("minAmount", value),
                placeholder: "ขั้นต่ำ",
                min: "0",
                step: "0.01",
              },
              {
                type: "number",
                key: "maxAmount",
                label: "ยอดสูงสุด",
                value: draftValues.maxAmount,
                onChange: (value) => setValue("maxAmount", value),
                placeholder: "สูงสุด",
                min: "0",
                step: "0.01",
              },
            ]}
            sortOptions={sortOptions}
            sortValue={draftValues.sortBy}
            onSortChange={(value) => setValue("sortBy", value)}
            sortDirection={draftValues.sortDir}
            onSortDirectionChange={(value) => setValue("sortDir", value)}
            totalCount={total}
            filteredCount={requests.length}
            isLoading={isPending}
            isDirty={isDirty}
            onReset={reset}
            activeFilters={activeFilters}
          />

          <PaginationControls
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={goToPage}
            disabled={isPending}
          />

          {requests.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          วันที่เอกสาร
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatThaiDate(request.documentDate)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          STATUS_COLORS[request.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {STATUS_LABELS[request.status] || request.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <DetailRow
                        label="เลขคำขอ"
                        value={request.documentNo ?? "รอดำเนินการ"}
                        mono
                      />

                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          เรื่อง
                        </div>
                        <div className="mt-1 text-base font-bold leading-snug">
                          {request.subject}
                        </div>
                        <div className="mt-1 text-sm leading-snug text-muted-foreground">
                          {request.project.projectCode} · {request.project.projectName}
                        </div>
                        {request.activity && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            กิจกรรม: {request.activity.name}
                          </div>
                        )}
                      </div>

                      <DetailRow
                        label="รายการย่อ"
                        value={request.itemSummary || "-"}
                      />
                      <DetailRow
                        label="จัดสรรทั้งหมด"
                        value={formatMaybeBaht(request.allocatedBudget)}
                        mono
                      />
                      <DetailRow
                        label="คงเหลือจากครั้งก่อน"
                        value={formatMaybeBaht(request.previousBalance)}
                        mono
                      />
                      <DetailRow
                        label="ขอใช้ครั้งนี้"
                        value={formatBaht(Number(request.requestedAmount))}
                        mono
                        strong
                      />
                      <DetailRow
                        label="คงเหลือหลังใบนี้"
                        value={formatMaybeBaht(request.remainingBalance)}
                        mono
                      />
                      <DetailRow
                        label="คงเหลือกิจกรรมปัจจุบัน"
                        value={formatMaybeBaht(request.activityCurrentRemaining)}
                        mono
                        strong
                      />
                    </div>

                    <Button className="mt-4 w-full" onClick={() => openLedgerDrawer(request)}>
                      เปิดทะเบียนตัดยอด
                    </Button>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
                <table className="w-full min-w-[1500px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="p-3">วันที่</th>
                      <th className="p-3">เลขที่</th>
                      <th className="p-3">โครงการ</th>
                      <th className="p-3">กิจกรรม</th>
                      <th className="p-3">เรื่อง/รายการย่อ</th>
                      <th className="p-3 text-right">จัดสรรทั้งหมด</th>
                      <th className="p-3 text-right">คงเหลือก่อน</th>
                      <th className="p-3 text-right">ขอใช้ครั้งนี้</th>
                      <th className="p-3 text-right">คงเหลือหลังใบนี้</th>
                      <th className="p-3 text-right">คงเหลือกิจกรรมปัจจุบัน</th>
                      <th className="p-3">สถานะ</th>
                      <th className="p-3 text-right">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr
                        key={request.id}
                        className="cursor-pointer border-b hover:bg-muted/30"
                        onClick={() => openLedgerDrawer(request)}
                      >
                        <td className="p-3">{formatThaiDate(request.documentDate)}</td>
                        <td className="p-3 font-mono text-xs">
                          {request.documentNo ?? "รอดำเนินการ"}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-xs text-muted-foreground">{request.project.projectCode}</div>
                          <div className="font-semibold">{request.project.projectName}</div>
                          <div className="text-xs text-muted-foreground">
                            {request.project.departmentName ?? "-"}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="max-w-[220px] font-medium">
                            {request.activity?.name ?? "โครงการหลัก"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {request.budgetWallet?.name ?? request.fundSource?.name ?? "-"}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="max-w-[260px] font-semibold">{request.subject}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {request.itemSummary || "-"} · {request.itemCount} รายการ
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatMaybeBaht(request.allocatedBudget)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatMaybeBaht(request.previousBalance)}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatBaht(Number(request.requestedAmount))}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatMaybeBaht(request.remainingBalance)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {formatMaybeBaht(request.activityCurrentRemaining)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              STATUS_COLORS[request.status] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {STATUS_LABELS[request.status] || request.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(event) => {
                              event.stopPropagation();
                              openLedgerDrawer(request);
                            }}
                          >
                            เปิดรายการ
                          </Button>
                          <Button
                            size="sm"
                            asChild
                            variant="outline"
                            className="ml-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Link href={`/procurement/${request.id}`}>รายละเอียด</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <PaginationControls
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={goToPage}
            disabled={isPending}
          />
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function formatMaybeBaht(value: number | null | undefined) {
  return typeof value === "number" ? formatBaht(value) : "-";
}

function BalanceTile({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{formatMaybeBaht(value)}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={[
          "text-right text-sm",
          mono ? "font-mono" : "",
          strong ? "font-semibold" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
