"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";

export function BudgetEntry({ projectId, max }: { projectId: string; max: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    setError(null);
    const n = Number(amount);
    if (!n || n <= 0) {
      setError("กรุณาระบุจำนวนเงิน");
      return;
    }
    if (n > max) {
      setError(`เกินงบคงเหลือ (สูงสุด ${max.toLocaleString()} บาท)`);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/budget-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, amount: n, description: desc, transactionType: "EXPENSE" }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setAmount("");
    setDesc("");
    setMessage("บันทึกรายการงบประมาณแล้ว");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          step="0.01"
          placeholder="จำนวน"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 w-28"
        />
        <Input
          placeholder="รายการ"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="h-8 w-40"
        />
        <Button size="sm" onClick={submit} disabled={loading}>
          บันทึก
        </Button>
      </div>
      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {message && <StatusAlert variant="success">{message}</StatusAlert>}
    </div>
  );
}
