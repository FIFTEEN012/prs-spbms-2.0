"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBaht } from "@/lib/utils";

type WalletSummary = {
  id: string;
  code: string;
  name: string;
  percentage: number | null;
  spendMode: string;
  balance: {
    allocated: number;
    committed: number;
    netDisbursed: number;
    accountingBalance: number;
    availableBalance: number;
  };
};

type WalletSummaryResponse = {
  plan: {
    id: string;
    name: string;
    status: string;
    academicYearName: string;
    fiscalYearName: string;
  } | null;
  updatedAt: string;
  wallets: WalletSummary[];
};

const PINNED_CODES = ["CENTRAL", "UTILITIES", "RESERVE"];
const STORAGE_KEY = "prs.globalBudgetWalletPanel.expanded";

function balanceTone(value: number) {
  if (value < 0) return "text-red-700";
  if (value <= 10000) return "text-amber-700";
  return "text-emerald-700";
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function GlobalBudgetWalletPanel() {
  const pathname = usePathname();
  const [data, setData] = useState<WalletSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved != null) setExpanded(saved === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(expanded));
  }, [expanded]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/budget-wallets/summary", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "โหลดข้อมูลงบไม่สำเร็จ");
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดข้อมูลงบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, pathname]);

  useEffect(() => {
    const onFocus = () => loadSummary();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadSummary();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadSummary]);

  const pinnedWallets = useMemo(() => {
    const wallets = data?.wallets ?? [];
    return PINNED_CODES.map((code) => wallets.find((wallet) => wallet.code === code)).filter(
      (wallet): wallet is WalletSummary => Boolean(wallet),
    );
  }, [data?.wallets]);

  const wallets = data?.wallets ?? [];
  const hasWallets = wallets.length > 0;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 w-[calc(100vw-2rem)] max-w-5xl print:hidden md:right-6">
      {expanded && (
        <div className="mb-3 max-h-[min(72vh,42rem)] overflow-hidden rounded-lg border border-border/80 bg-background shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-muted/30 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <WalletCards className="size-4 text-emerald-700" />
                ยอดกระเป๋างบประมาณ
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {data?.plan
                  ? `${data.plan.name} · ปีการศึกษา ${data.plan.academicYearName} · ปีงบประมาณ ${data.plan.fiscalYearName}`
                  : "ยังไม่มีแผนจัดสรรงบที่ล็อกแล้ว"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadSummary} disabled={loading}>
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                รีเฟรช
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setExpanded(false)} aria-label="ปิดยอดกระเป๋างบ">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(min(72vh,42rem)-5rem)] overflow-auto p-4">
            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            {!error && !hasWallets && (
              <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                ยังไม่มีข้อมูลกระเป๋างบที่แสดงได้
              </div>
            )}

            {hasWallets && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {wallets.map((wallet) => (
                  <Link
                    key={wallet.id}
                    href={`/budget-wallets/${wallet.id}`}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{wallet.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {wallet.percentage == null ? wallet.spendMode : `${wallet.percentage.toFixed(2)}% ของเงินอุดหนุนสุทธิ`}
                        </div>
                      </div>
                      <div className={cn("shrink-0 text-right font-mono text-base font-bold", balanceTone(wallet.balance.availableBalance))}>
                        {formatBaht(wallet.balance.availableBalance)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">จัดสรร</div>
                        <div className="mt-0.5 font-medium">{formatBaht(wallet.balance.allocated)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">กัน/ผูกไว้</div>
                        <div className="mt-0.5 font-medium">{formatBaht(wallet.balance.committed)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">จ่ายสุทธิ</div>
                        <div className="mt-0.5 font-medium">{formatBaht(wallet.balance.netDisbursed)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ml-auto rounded-lg border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85 md:max-w-3xl">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/70"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <WalletCards className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">ยอดพร้อมใช้</div>
              <div className="truncate text-xs text-muted-foreground">
                อัปเดต {formatUpdatedAt(data?.updatedAt ?? null)}
              </div>
            </div>
          </div>
          {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronUp className="size-4 shrink-0" />}
        </button>

        <div className="grid gap-2 px-2 pb-2 md:grid-cols-3">
          {(pinnedWallets.length ? pinnedWallets : wallets.slice(0, 3)).map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              className="rounded-md border border-border bg-card px-3 py-2 text-left hover:border-emerald-300"
              onClick={() => setExpanded(true)}
            >
              <div className="truncate text-xs font-medium text-muted-foreground">{wallet.name}</div>
              <div className={cn("mt-1 font-mono text-sm font-bold", balanceTone(wallet.balance.availableBalance))}>
                {formatBaht(wallet.balance.availableBalance)}
              </div>
            </button>
          ))}
          {!hasWallets && (
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground md:col-span-3">
              {loading ? "กำลังโหลดข้อมูลงบ..." : error ?? "ยังไม่มีข้อมูลกระเป๋างบ"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
