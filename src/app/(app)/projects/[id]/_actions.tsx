"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import { can } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export function ProjectActions({
  projectId,
  status,
  role,
  budgetRequested,
}: {
  projectId: string;
  status: string;
  role?: Role;
  budgetRequested: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(budgetRequested);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: string, body: any = {}) {
    setMessage(null);
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "ดำเนินการไม่สำเร็จ");
      return;
    }
    setMessage("ดำเนินการเรียบร้อยแล้ว");
    router.refresh();
  }

  const canSubmit = can(role, "project.submit") && status === "DRAFT";
  const canReview = can(role, "project.review") && status === "SUBMITTED";
  const canApprove = can(role, "project.approve") && status === "REVIEWED";

  if (!canSubmit && !canReview && !canApprove) return null;

  return (
    <div className="w-full max-w-full space-y-2 md:min-w-[240px] md:max-w-sm">
      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {message && <StatusAlert variant="success">{message}</StatusAlert>}
      {canSubmit && (
        <Button className="w-full" disabled={loading} onClick={() => call("submit")}>
          ส่งขออนุมัติ
        </Button>
      )}
      {canReview && (
        <div className="space-y-2">
          <Input
            placeholder="ความเห็น (ถ้ามี)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full" disabled={loading} onClick={() => call("review_approve", { comment })}>
              ตรวจสอบผ่าน
            </Button>
            <Button className="w-full" variant="destructive" disabled={loading} onClick={() => call("reject", { comment })}>
              ตีกลับ
            </Button>
          </div>
        </div>
      )}
      {canApprove && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">งบที่อนุมัติ (บาท)</label>
          <Input
            type="number"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <Input
            placeholder="ความเห็น (ถ้ามี)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full" disabled={loading} onClick={() => call("approve", { budget, comment })}>
              อนุมัติ
            </Button>
            <Button className="w-full" variant="destructive" disabled={loading} onClick={() => call("reject", { comment })}>
              ตีกลับ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
