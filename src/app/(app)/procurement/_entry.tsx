"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";

export function ProcurementEntry({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    setError(null);
    if (!itemName.trim()) {
      setError("กรุณาระบุรายการ");
      return;
    }
    const q = Number(quantity);
    const p = Number(unitPrice);
    if (!q || q <= 0) {
      setError("กรุณาระบุจำนวนที่ถูกต้อง");
      return;
    }
    if (!p || p <= 0) {
      setError("กรุณาระบุราคาต่อหน่วยที่ถูกต้อง");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/procurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, itemName, quantity: q, unitPrice: p }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setItemName("");
    setQuantity("");
    setUnitPrice("");
    setMessage("บันทึกคำขอจัดซื้อจัดจ้างแล้ว");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="รายการพัสดุ"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="h-8 w-40"
        />
        <Input
          type="number"
          placeholder="จำนวน"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-8 w-20"
        />
        <Input
          type="number"
          step="0.01"
          placeholder="ราคา/หน่วย"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="h-8 w-24"
        />
        <Button size="sm" onClick={submit} disabled={loading}>
          ขอจัดซื้อ
        </Button>
      </div>
      {error && <StatusAlert variant="error">{error}</StatusAlert>}
      {message && <StatusAlert variant="success">{message}</StatusAlert>}
    </div>
  );
}
