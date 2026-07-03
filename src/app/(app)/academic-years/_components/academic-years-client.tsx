"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { formatThaiDate } from "@/lib/utils";

type AcademicYearWithCount = {
  id: string;
  yearName: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  isActive: boolean;
  _count: {
    projects: number;
    strategies: number;
  };
};

interface AcademicYearsClientProps {
  initialYears: AcademicYearWithCount[];
  role: string;
}

export function AcademicYearsClient({ initialYears, role }: AcademicYearsClientProps) {
  const router = useRouter();
  const isAdmin = role === "SUPER_ADMIN";

  // State
  const years = initialYears;
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYearWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcademicYearWithCount | null>(null);

  // Form State
  const [yearName, setYearName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format date helper for input type="date"
  const toISODateString = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  const openCreateModal = () => {
    setEditingYear(null);
    setYearName("");
    setStartDate("");
    setEndDate("");
    setIsActive(false);
    setError(null);
    setIsOpen(true);
  };

  const openEditModal = (year: AcademicYearWithCount) => {
    setEditingYear(year);
    setYearName(year.yearName);
    setStartDate(toISODateString(year.startDate));
    setEndDate(toISODateString(year.endDate));
    setIsActive(year.isActive);
    setError(null);
    setIsOpen(true);
  };

  const openDeleteModal = (year: AcademicYearWithCount) => {
    setDeleteTarget(year);
    setError(null);
    setIsDeleteOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearName.trim()) {
      setError("กรุณาระบุปีการศึกษา");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      yearName: yearName.trim(),
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      isActive,
    };

    try {
      const url = editingYear
        ? `/api/academic-years/${editingYear.id}`
        : "/api/academic-years";
      const method = editingYear ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/academic-years/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
      }

      setIsDeleteOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ปีการศึกษา</h1>
          <p className="text-muted-foreground text-sm mt-1">จัดการข้อมูลปีการศึกษาในระบบสำหรับโรงเรียน</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateModal} className="bg-primary hover:bg-primary/95 text-primary-foreground gap-2 flex items-center shadow-sm">
            <Plus className="h-4 w-4" />
            เพิ่มปีการศึกษา
          </Button>
        )}
      </div>

      <Card className="border border-muted/40 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-muted/50 text-muted-foreground font-medium">
                  <th className="p-4 font-semibold">ปีการศึกษา</th>
                  <th className="p-4 font-semibold">วันที่เริ่มต้น</th>
                  <th className="p-4 font-semibold">วันที่สิ้นสุด</th>
                  <th className="p-4 text-center font-semibold">แผนกลยุทธ์</th>
                  <th className="p-4 text-center font-semibold">โครงการทั้งหมด</th>
                  <th className="p-4 font-semibold">สถานะปัจจุบัน</th>
                  {isAdmin && <th className="p-4 text-right font-semibold">การจัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {years.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลปีการศึกษาในระบบ
                    </td>
                  </tr>
                ) : (
                  years.map((y) => (
                    <tr key={y.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-semibold text-foreground text-base">
                        ปี พ.ศ. {y.yearName}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatThaiDate(y.startDate)}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatThaiDate(y.endDate)}
                      </td>
                      <td className="p-4 text-center font-medium">
                        {y._count.strategies} กลยุทธ์
                      </td>
                      <td className="p-4 text-center font-medium">
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 text-xs font-semibold">
                          {y._count.projects} โครงการ
                        </span>
                      </td>
                      <td className="p-4">
                        {y.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold border border-emerald-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            เปิดใช้งานอยู่
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400 border border-gray-200/40 font-medium">
                            ไม่ใช้งาน
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/90 hover:bg-primary/5 h-8 px-2.5"
                              onClick={() => openEditModal(y)}
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" />
                              แก้ไข
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/5 h-8 px-2.5"
                              onClick={() => openDeleteModal(y)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              ลบ
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingYear ? "แก้ไขปีการศึกษา" : "เพิ่มปีการศึกษา"}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 p-6 space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-xs font-medium border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">ปีการศึกษา (พ.ศ.) *</label>
                <Input
                  type="text"
                  placeholder="ตัวอย่าง: 2569"
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                  className="rounded-lg font-medium text-base"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">วันที่เริ่มต้น</label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-lg pr-10 text-sm font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">วันที่สิ้นสุด</label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-lg pr-10 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer mt-2" onClick={() => setIsActive(!isActive)}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => {}} // Controlled by wrapper div click
                  className="h-4.5 w-4.5 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">เปิดใช้งานปีการศึกษานี้</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    * เมื่อเปิดใช้งาน ปีการศึกษาอื่นในระบบจะถูกปรับสถานะเป็นไม่ใช้งานทันที
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={loading} className="rounded-lg">
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading} className="rounded-lg gap-2 bg-primary hover:bg-primary/95 text-primary-foreground min-w-[90px]">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      บันทึก...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      บันทึกข้อมูล
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                ยืนยันการลบปีการศึกษา
              </h2>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-xs font-medium border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-sm text-foreground leading-relaxed">
                ท่านแน่ใจหรือไม่ว่าต้องการลบปีการศึกษา <strong className="text-base font-bold">&quot;ปี พ.ศ. {deleteTarget.yearName}&quot;</strong>? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>

              {deleteTarget._count.projects > 0 ? (
                <div className="p-3.5 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400 border border-yellow-200/50 rounded-lg space-y-1">
                  <h4 className="font-semibold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    คำแจ้งเตือนด้านความปลอดภัย
                  </h4>
                  <p className="text-xs leading-relaxed">
                    พบว่ามีโครงการทั้งหมด <strong>{deleteTarget._count.projects} โครงการ</strong> ในระบบที่เชื่อมโยงกับปีการศึกษานี้ 
                    ระบบบล็อกการลบเพื่อป้องกันความเสียหายต่อข้อมูล
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                  ไม่พบความเชื่อมโยงกับโครงการอื่น สามารถดำเนินการลบได้โดยไม่มีผลกระทบต่อข้อมูลอื่น
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={loading} className="rounded-lg">
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading || deleteTarget._count.projects > 0}
                  onClick={handleDelete}
                  className="rounded-lg gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      ยืนยันลบข้อมูล
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
