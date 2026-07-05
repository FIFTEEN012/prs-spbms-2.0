"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function PrintTrigger() {
  const [layoutError, setLayoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function preparePrint() {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images).map(async (image) => {
          if (image.complete) return;
          try {
            await image.decode();
          } catch {
            // The overflow check below still protects the printed document.
          }
        }),
      );

      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (cancelled) return;

      const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-print-page]"));
      if (pages.length !== 2) {
        setLayoutError("รูปแบบเอกสารไม่ครบ 2 หน้า กรุณาติดต่อผู้ดูแลระบบ");
        return;
      }

      const overflowingPage = pages.find(
        (page) => page.scrollHeight > page.clientHeight + 1 || page.scrollWidth > page.clientWidth + 1,
      );
      if (overflowingPage) {
        setLayoutError(
          `ข้อความในหน้าที่ ${overflowingPage.dataset.printPage} เกินพื้นที่ A4 กรุณาย่อรายละเอียดหรือแยกคำขอใหม่`,
        );
        return;
      }

      const shouldAutoPrint = new URLSearchParams(window.location.search).get("autoprint") === "1";
      if (shouldAutoPrint) window.print();
    }

    void preparePrint();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!layoutError) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(90vw,42rem)] -translate-x-1/2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900 shadow-lg print:hidden">
      {layoutError}
    </div>
  );
}

export function PrintButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}
