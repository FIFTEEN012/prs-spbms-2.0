export type ProjectState =
  | "DRAFT"
  | "PENDING_DEPT_REVIEW"
  | "PENDING_FINANCE_REVIEW"
  | "PENDING_EXECUTIVE_APPROVAL"
  | "IN_PROGRESS"
  | "PENDING_COMPLETION_REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export type ProjectTransition =
  | "submit"
  | "dept_approve"
  | "finance_approve"
  | "executive_approve"
  | "reject_to_draft"
  | "submit_completion"
  | "approve_completion"
  | "cancel";

const TRANSITIONS: Partial<Record<ProjectState, Partial<Record<ProjectTransition, ProjectState>>>> = {
  DRAFT: { submit: "PENDING_DEPT_REVIEW", cancel: "CANCELLED" },
  PENDING_DEPT_REVIEW: { dept_approve: "PENDING_FINANCE_REVIEW", reject_to_draft: "DRAFT", cancel: "CANCELLED" },
  PENDING_FINANCE_REVIEW: { finance_approve: "PENDING_EXECUTIVE_APPROVAL", reject_to_draft: "DRAFT", cancel: "CANCELLED" },
  PENDING_EXECUTIVE_APPROVAL: { executive_approve: "IN_PROGRESS", reject_to_draft: "DRAFT", cancel: "CANCELLED" },
  IN_PROGRESS: { submit_completion: "PENDING_COMPLETION_REVIEW" },
  PENDING_COMPLETION_REVIEW: { approve_completion: "COMPLETED", reject_to_draft: "IN_PROGRESS" },
};

export function nextProjectStatus(status: ProjectState, action: ProjectTransition): ProjectState {
  const next = TRANSITIONS[status]?.[action];
  if (!next) throw new Error(`Invalid project transition: ${status} -> ${action}`);
  return next;
}
