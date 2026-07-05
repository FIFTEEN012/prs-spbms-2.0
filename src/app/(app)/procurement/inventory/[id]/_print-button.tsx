"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InventoryItemPrintButton() {
  return (
    <Button
      className="w-full gap-2 bg-primary text-white hover:bg-primary/90"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      พิมพ์หน้านี้
    </Button>
  );
}
