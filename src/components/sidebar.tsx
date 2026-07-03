"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, School } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { APP_NAV } from "@/components/app-nav";

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = (data?.user as any)?.role;

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border/70 bg-card/95 print:hidden md:flex">
      <div className="border-b border-border/70 p-5">
        <div className="flex items-center gap-2">
          <School className="size-6 text-primary" />
          <div>
            <div className="font-bold">PRS SPBMS</div>
            <div className="text-xs text-muted-foreground">แผนปฏิบัติการ & งบประมาณ</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-2 overflow-auto px-3 py-4">
        {APP_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-white/15" : "bg-muted text-primary")}>
                <Icon className="size-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-border/70 bg-muted/10 p-4">
        <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-3 text-sm shadow-sm">
          <div className="font-medium">{data?.user?.name}</div>
          <div className="text-xs text-muted-foreground">
            {role ? ROLE_LABELS[role as keyof typeof ROLE_LABELS] : ""}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" /> ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
