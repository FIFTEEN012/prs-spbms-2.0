"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface BudgetDeleteButtonProps {
  projectId: string;
  projectName: string;
  projectCode: string;
}

export function BudgetDeleteButton({
  projectId,
  projectName,
  projectCode,
}: BudgetDeleteButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: [projectId] }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบโครงการ");
      }

      setSuccess(`ลบโครงการสำเร็จเรียบร้อยแล้ว`);
      router.refresh();

      setTimeout(() => {
        setIsOpen(false);
      }, 1200);
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
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-lg"
        title="ลบโครงการออกจากงบประมาณ"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200 text-left">
          <div className="bg-background border rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                ยืนยันการลบโครงการอนุมัติ
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
            <div className="p-6 space-y-4">
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
                    คุณแน่ใจหรือไม่ว่าต้องการลบโครงการอนุมัติงบประมาณนี้?
                  </p>
                  
                  <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 font-medium text-foreground/80 border">
                    <div><strong>รหัสโครงการ:</strong> {projectCode}</div>
                    <div><strong>ชื่อโครงการ:</strong> {projectName}</div>
                  </div>

                  <div className="p-3.5 bg-red-50 text-red-900 border border-red-200/50 rounded-xl space-y-1 dark:bg-red-950/20 dark:text-red-200 dark:border-red-900/30">
                    <h4 className="font-bold text-xs flex items-center gap-1 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      คำเตือนสำคัญ:
                    </h4>
                    <p className="text-[11px] leading-relaxed font-medium">
                      การดำเนินการนี้จะทำการลบข้อมูลทั้งหมดที่เชื่อมโยง เช่น กิจกรรม ประวัติการอนุมัติ รายการทำธุรกรรมงบ และประวัติการจัดซื้อจัดจ้างออกจากระบบแบบถาวรโดยไม่สามารถกู้คืนได้
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
                    onClick={handleDelete}
                    className="rounded-lg gap-1.5 bg-destructive hover:bg-destructive/90 text-white min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังลบ...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        ยืนยันลบ
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
