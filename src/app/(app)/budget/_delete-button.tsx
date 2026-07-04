"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      const response = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: [projectId] }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบโครงการ");
      }

      setSuccess("ลบโครงการออกจากระบบเรียบร้อยแล้ว");
      router.refresh();

      setTimeout(() => {
        setIsOpen(false);
      }, 1200);
    } catch (caughtError: any) {
      setError(caughtError.message);
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
        className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
        title="ลบโครงการออกจากงบประมาณ"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-outline-variant bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">ยืนยันการลบโครงการ</h2>
                  <p className="text-sm text-muted-foreground">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {success ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              ) : null}

              {!success ? (
                <>
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low/70 p-4">
                    <dl className="space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">รหัสโครงการ</dt>
                        <dd className="font-bold text-foreground">{projectCode}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">ชื่อโครงการ</dt>
                        <dd className="text-right font-bold text-foreground">{projectName}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <div className="space-y-1.5 text-sm">
                        <p className="font-bold text-amber-800">ผลกระทบของการลบ</p>
                        <p className="leading-relaxed text-amber-900/90">
                          ระบบจะลบข้อมูลที่เชื่อมโยงกับโครงการนี้ออกจากระบบ เช่น กิจกรรม ประวัติอนุมัติ
                          ธุรกรรมงบประมาณ และข้อมูลจัดซื้อจัดจ้างที่เกี่ยวข้อง
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
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
                      className="min-w-[132px] rounded-lg bg-destructive text-white hover:bg-destructive/90"
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
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
