"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronRight, LogOut, Menu, School, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { APP_NAV, getPageTitle, isNavItemActive } from "@/components/app-nav";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { data } = useSession();
  const role = (data?.user as any)?.role;
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden print:hidden">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-card/85 shadow-sm backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <School className="size-4" />
              </span>
              <div className="truncate text-base font-bold text-primary">PRS SPBMS</div>
            </div>
            <div className="mt-1 truncate text-xs font-medium text-muted-foreground">
              {pageTitle}
            </div>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
            aria-label="เปิดเมนู"
            aria-expanded={isOpen}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border/70 bg-card shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="border-b border-border/70 bg-muted/50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <School className="size-5" />
                </span>
                <div>
                  <div className="font-bold text-primary">PRS SPBMS</div>
                  <div className="text-xs text-muted-foreground">แผนปฏิบัติการ & งบประมาณ</div>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                <div className="text-xs text-muted-foreground">หน้าปัจจุบัน</div>
                <div className="text-sm font-semibold">{pageTitle}</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="ปิดเมนู"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-auto px-4 py-4">
          {APP_NAV.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                  active
                    ? "border-primary/20 bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "border-transparent bg-background/80 text-muted-foreground hover:border-border/80 hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-lg",
                    active ? "bg-white/15" : "bg-muted text-primary",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex-1">{item.label}</span>
                <ChevronRight className={cn("size-4", active ? "text-white/80" : "text-muted-foreground")} />
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/70 bg-muted/30 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 rounded-lg border border-border/70 bg-background/90 px-4 py-3 shadow-sm">
            <div className="truncate font-medium">{data?.user?.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {role ? ROLE_LABELS[role as keyof typeof ROLE_LABELS] : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-5" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
