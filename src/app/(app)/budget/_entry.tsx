"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine } from "lucide-react";
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

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("กรุณาระบุจำนวนเงินที่ต้องการบันทึก");
      return;
    }

    if (numericAmount > max) {
      setError(`เกินวงเงินคงเหลือของโครงการ (สูงสุด ${max.toLocaleString()} บาท)`);
      return;
    }

    setLoading(true);
    const response = await fetch("/api/budget-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        amount: numericAmount,
        description: desc,
        transactionType: "EXPENSE",
      }),
    });
    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "บันทึกรายการไม่สำเร็จ");
      return;
    }

    setAmount("");
    setDesc("");
    setMessage("บันทึกค่าใช้จ่ายของโครงการเรียบร้อยแล้ว");
    router.refresh();
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 lg:grid-cols-[118px_minmax(0,1fr)_104px]">
        <Input
          type="number"
          step="0.01"
          placeholder="จำนวนเงิน"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="h-10 rounded-lg border-outline-variant bg-white"
        />
        <Input
          placeholder="รายละเอียดรายการเบิกจ่าย"
          value={desc}
          onChange={(event) => setDesc(event.target.value)}
          className="h-10 rounded-lg border-outline-variant bg-white"
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={loading}
          className="h-10 rounded-lg text-sm font-bold shadow-sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
      {message ? <StatusAlert variant="success">{message}</StatusAlert> : null}
    </div>
  );
}
