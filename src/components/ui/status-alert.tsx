"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusAlertVariant = "error" | "success" | "warning" | "info";

const variantStyles: Record<
  StatusAlertVariant,
  {
    className: string;
    icon: typeof AlertTriangle;
  }
> = {
  error: {
    className: "border-destructive/25 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  success: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  info: {
    className: "border-blue-200 bg-blue-50 text-blue-900",
    icon: Info,
  },
};

export function StatusAlert({
  variant = "info",
  children,
  className,
}: {
  variant?: StatusAlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
        styles.className,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
