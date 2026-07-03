"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Send,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { formatBaht } from "@/lib/utils";

type DraftProjectType = {
  id: string;
  projectCode: string;
  projectName: string;
  budgetRequested: number;
};

interface BulkSubmitButtonProps {
  draftProjects: DraftProjectType[];
}

export function BulkSubmitButton({ draftProjects }: BulkSubmitButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleBulkSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const projectIds = draftProjects.map((p) => p.id);

    try {
      const res = await fetch("/api/projects/bulk-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการส่งขออนุมัติ");
      }

      setSuccess(`ส่งขออนุมัติโครงการทั้งหมดสำเร็จจำนวน ${data.count} โครงการเรียบร้อยแล้ว`);
      
      // Refresh Next.js server component state
      router.refresh();

      // Keep the success state visible briefly while the refreshed server data loads.
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <>
      <Button
        onClick={() => {
          setError(null);
          setSuccess(null);
          setIsOpen(true);
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 font-bold text-white shadow-md transition-all hover:bg-amber-700 sm:w-auto"
      >
        <Send className="h-4 w-4" />
        ส่งขออนุมัติทั้งหมด ({draftProjects.length})
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-500">
                <Send className="h-5 w-5" />
                ยืนยันการส่งขออนุมัติโครงการทั้งหมด
              </h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-xs font-medium border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 animate-in fade-in duration-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold">{success}</span>
                </div>
              )}

              {!success && (
                <>
                  <p className="text-sm text-foreground leading-relaxed">
                    คุณแน่ใจหรือไม่ว่าต้องการส่งขออนุมัติโครงการร่างทั้งหมดจำนวน 
                    <strong className="text-amber-700 dark:text-amber-400 font-bold mx-1 text-base">
                      {draftProjects.length} โครงการ
                    </strong> 
                    โครงการเหล่านี้จะถูกส่งไปยังขั้นตอนการตรวจสอบของหัวหน้ากลุ่มงาน
                  </p>

                  <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b bg-muted/50 font-medium text-muted-foreground">
                          <th className="p-2.5">รหัสโครงการ</th>
                          <th className="p-2.5">ชื่อโครงการ</th>
                          <th className="p-2.5 text-right">งบเสนอขอ (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftProjects.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-muted/10 font-medium text-foreground/90">
                            <td className="p-2.5 font-mono text-muted-foreground">{p.projectCode}</td>
                            <td className="p-2.5">{p.projectName}</td>
                            <td className="p-2.5 text-right">{formatBaht(p.budgetRequested)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3.5 bg-blue-50 text-blue-900 border border-blue-200/50 rounded-xl space-y-1 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-900/30">
                    <h4 className="font-bold text-xs flex items-center gap-1">
                      <FileText className="h-4 w-4 text-blue-600" />
                      สิ่งที่จะเกิดขึ้นถัดไป:
                    </h4>
                    <p className="text-[11px] leading-relaxed font-medium">
                      สถานะของโครงการทั้งหมดจะเปลี่ยนจาก <strong className="text-gray-600 dark:text-gray-300">ร่าง (DRAFT)</strong> เป็น <strong className="text-blue-700 dark:text-blue-400">ส่งขออนุมัติ (SUBMITTED)</strong> และระบบจะส่งการแจ้งเตือนไปยังหัวหน้ากลุ่มงาน (Department Head) เพื่อพิจารณาตรวจสอบต่อไป
                    </p>
                  </div>
                </>
              )}

              {/* Modal Footer */}
              {!success && (
                <div className="pt-4 border-t flex justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="rounded-lg"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={handleBulkSubmit}
                    className="rounded-lg gap-1.5 bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังส่งข้อมูล...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        ยืนยันส่งขออนุมัติ
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
