import type { Role } from "@prisma/client";

export type Actor = {
  id: string;
  role: Role;
  departmentId?: string | null;
};

export type ProjectResource = {
  responsibleUserId?: string | null;
  departmentId?: string | null;
  status: string;
};

export type ProjectAction =
  | "submit"
  | "dept_approve"
  | "finance_approve"
  | "executive_approve"
  | "reject_to_draft"
  | "submit_completion"
  | "approve_completion"
  | "cancel";

export function canReadProject(actor: Actor, project: ProjectResource): boolean {
  if (
    actor.role === "SUPER_ADMIN" ||
    actor.role === "EXECUTIVE" ||
    actor.role === "FINANCE" ||
    actor.role === "PROCUREMENT"
  ) {
    return true;
  }
  if (actor.role === "COMMITTEE") {
    return (
      project.status === "IN_PROGRESS" ||
      project.status === "PENDING_COMPLETION_REVIEW" ||
      project.status === "COMPLETED"
    );
  }
  if (actor.role === "DEPT_HEAD" || actor.role === "TEACHER") {
    return (
      (actor.departmentId != null && actor.departmentId === project.departmentId) ||
      actor.id === project.responsibleUserId
    );
  }
  return false;
}

export function canViewProjectBudgetHistory(
  actor: Actor,
  project: ProjectResource,
): boolean {
  if (
    actor.role === "SUPER_ADMIN" ||
    actor.role === "EXECUTIVE" ||
    actor.role === "FINANCE" ||
    actor.role === "PROCUREMENT"
  ) {
    return true;
  }

  if (actor.role === "TEACHER" || actor.role === "DEPT_HEAD") {
    return (
      actor.id === project.responsibleUserId ||
      (actor.departmentId != null && actor.departmentId === project.departmentId)
    );
  }

  return false;
}

export function canManageBudgetPlan(actor: Actor): boolean {
  return actor.role === "SUPER_ADMIN" || actor.role === "FINANCE";
}

export function canApproveBudgetPlan(actor: Actor): boolean {
  return actor.role === "SUPER_ADMIN" || actor.role === "EXECUTIVE";
}

export function canViewBudgetWallet(
  actor: Actor,
  wallet: { departmentId?: string | null },
): boolean {
  if (
    actor.role === "SUPER_ADMIN" ||
    actor.role === "EXECUTIVE" ||
    actor.role === "FINANCE" ||
    actor.role === "PROCUREMENT"
  ) {
    return true;
  }
  return (
    (actor.role === "TEACHER" || actor.role === "DEPT_HEAD") &&
    actor.departmentId != null &&
    actor.departmentId === wallet.departmentId
  );
}

export function canEditProject(actor: Actor, project: ProjectResource): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  return (
    (actor.role === "TEACHER" || actor.role === "DEPT_HEAD") &&
    project.status === "DRAFT" &&
    ((actor.departmentId != null && actor.departmentId === project.departmentId) ||
      actor.id === project.responsibleUserId)
  );
}

export function canActOnProject(
  actor: Actor,
  project: ProjectResource,
  action: ProjectAction,
): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  switch (action) {
    case "submit":
    case "submit_completion":
      return (
        (actor.role === "TEACHER" || actor.role === "DEPT_HEAD") &&
        ((actor.departmentId != null && actor.departmentId === project.departmentId) ||
          actor.id === project.responsibleUserId)
      );
    case "dept_approve":
    case "approve_completion":
      return (
        actor.role === "DEPT_HEAD" &&
        actor.departmentId != null &&
        actor.departmentId === project.departmentId
      );
    case "finance_approve":
      return actor.role === "FINANCE";
    case "executive_approve":
      return actor.role === "EXECUTIVE";
    case "reject_to_draft":
      return (
        (actor.role === "DEPT_HEAD" &&
          actor.departmentId != null &&
          actor.departmentId === project.departmentId) ||
        actor.role === "FINANCE" ||
        actor.role === "EXECUTIVE"
      );
    case "cancel":
      return actor.role === "EXECUTIVE";
  }
}

export function requireOverrideReason(actor: Actor, reason?: string | null): void {
  if (actor.role === "SUPER_ADMIN" && !reason?.trim()) {
    throw new Error("Super Admin override requires a reason");
  }
}
