"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { CheckCircle2, Send, Stamp, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import { can } from "@/lib/rbac";

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

  async function call(action: string, body: Record<string, unknown> = {}) {
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
      const bodyJson = await res.json().catch(() => ({}));
      setError(bodyJson.error ?? "ดำเนินการไม่สำเร็จ");
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
    <div className="w-full max-w-full space-y-3 rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur md:min-w-[280px] md:max-w-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-primary">
        <Stamp className="size-4" />
        การดำเนินการโครงการ
      </div>
      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {message && <StatusAlert variant="success">{message}</StatusAlert>}

      {canSubmit && (
        <Button className="w-full gap-2 rounded-lg font-bold" disabled={loading} onClick={() => call("submit")}>
          <Send className="size-4" />
          ส่งขออนุมัติ
        </Button>
      )}

      {canReview && (
        <div className="space-y-2">
          <Input
            placeholder="ความเห็น (ถ้ามี)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full gap-2 rounded-lg font-bold" disabled={loading} onClick={() => call("review_approve", { comment })}>
              <CheckCircle2 className="size-4" />
              ตรวจสอบผ่าน
            </Button>
            <Button className="w-full gap-2 rounded-lg font-bold" variant="destructive" disabled={loading} onClick={() => call("reject", { comment })}>
              <Undo2 className="size-4" />
              ตีกลับ
            </Button>
          </div>
        </div>
      )}

      {canApprove && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">งบที่อนุมัติ (บาท)</label>
          <Input
            type="number"
            step="0.01"
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
          />
          <Input
            placeholder="ความเห็น (ถ้ามี)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full gap-2 rounded-lg font-bold" disabled={loading} onClick={() => call("approve", { budget, comment })}>
              <CheckCircle2 className="size-4" />
              อนุมัติ
            </Button>
            <Button className="w-full gap-2 rounded-lg font-bold" variant="destructive" disabled={loading} onClick={() => call("reject", { comment })}>
              <XCircle className="size-4" />
              ตีกลับ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
