"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

    try {
      const res = await fetch("/api/projects/bulk-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: draftProjects.map((project) => project.id) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการส่งขออนุมัติ");
      }

      setSuccess(`ส่งขออนุมัติโครงการสำเร็จ ${data.count} โครงการ`);
      router.refresh();

      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เกิดข้อผิดพลาดในการส่งขออนุมัติ");
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
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 font-bold text-white shadow-sm transition-all hover:bg-amber-700 sm:w-auto"
      >
        <Send className="h-4 w-4" />
        ส่งขออนุมัติทั้งหมด ({draftProjects.length})
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-amber-700">
                <Send className="h-5 w-5" />
                ยืนยันการส่งขออนุมัติโครงการ
              </h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground transition-colors hover:text-foreground"
                disabled={loading}
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="text-sm font-bold">{success}</span>
                </div>
              )}

              {!success && (
                <>
                  <p className="text-sm leading-relaxed text-foreground">
                    ต้องการส่งโครงการร่างจำนวน
                    <strong className="mx-1 text-base font-bold text-amber-700">
                      {draftProjects.length} โครงการ
                    </strong>
                    เข้าสู่ขั้นตอนตรวจสอบของหัวหน้ากลุ่มงานหรือไม่
                  </p>

                  <div className="max-h-[200px] overflow-y-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 font-bold text-muted-foreground">
                          <th className="p-2.5">รหัสโครงการ</th>
                          <th className="p-2.5">ชื่อโครงการ</th>
                          <th className="p-2.5 text-right">งบเสนอขอ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftProjects.map((project) => (
                          <tr key={project.id} className="border-b hover:bg-muted/10">
                            <td className="p-2.5 font-mono text-muted-foreground">{project.projectCode}</td>
                            <td className="p-2.5 font-medium">{project.projectName}</td>
                            <td className="p-2.5 text-right">{formatBaht(project.budgetRequested)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 rounded-lg border border-blue-200/70 bg-blue-50 p-3.5 text-blue-900">
                    <h4 className="flex items-center gap-1 text-xs font-bold text-blue-700">
                      <FileText className="h-4 w-4" />
                      สิ่งที่จะเกิดขึ้นถัดไป
                    </h4>
                    <p className="text-[11px] font-medium leading-relaxed">
                      สถานะของโครงการจะเปลี่ยนจาก “ร่าง” เป็น “ส่งขออนุมัติ” และเข้าสู่ขั้นตอนพิจารณาตาม workflow ปัจจุบัน
                    </p>
                  </div>
                </>
              )}

              {!success && (
                <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="rounded-lg">
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={handleBulkSubmit}
                    className="min-w-[120px] gap-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
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
