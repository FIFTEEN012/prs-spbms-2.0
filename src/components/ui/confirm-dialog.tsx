"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusAlert } from "@/components/ui/status-alert";
import { cn } from "@/lib/utils";

type ConfirmDialogVariant = "default" | "destructive" | "warning";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "default",
  loading = false,
  error,
  children,
  reasonLabel,
  reasonValue,
  reasonPlaceholder,
  reasonRequired = false,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  reasonLabel?: string;
  reasonValue?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  onReasonChange?: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const isDestructive = variant === "destructive";
  const isWarning = variant === "warning";
  const reasonMissing =
    reasonRequired && onReasonChange && reasonValue?.trim() === "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {(isDestructive || isWarning) && (
              <AlertTriangle
                className={cn(
                  "h-5 w-5 shrink-0",
                  isDestructive ? "text-destructive" : "text-amber-600",
                )}
              />
            )}
            <h2 id="confirm-dialog-title" className="truncate text-lg font-semibold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {description && (
            <div className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          )}

          {children}

          {onReasonChange && (
            <label className="block space-y-2 text-sm">
              <span className="font-medium">
                {reasonLabel ?? "เหตุผล"}
                {reasonRequired ? " *" : ""}
              </span>
              <Textarea
                value={reasonValue ?? ""}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={reasonPlaceholder}
                disabled={loading}
              />
            </label>
          )}

          {error && <StatusAlert variant="error">{error}</StatusAlert>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading || reasonMissing}
            className={cn(isWarning && "bg-amber-600 text-white hover:bg-amber-700")}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
