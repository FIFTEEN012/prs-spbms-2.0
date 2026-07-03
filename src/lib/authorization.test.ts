import { describe, expect, it } from "vitest";
import {
  canActOnProject,
  canEditProject,
  canReadProject,
  canViewProjectBudgetHistory,
} from "./authorization";

const teacher = { id: "teacher-1", role: "TEACHER", departmentId: "academic" } as const;
const otherTeacherInSameDept = { id: "teacher-2", role: "TEACHER", departmentId: "academic" } as const;
const teacherInOtherDept = { id: "teacher-3", role: "TEACHER", departmentId: "general" } as const;
const head = { id: "head-1", role: "DEPT_HEAD", departmentId: "academic" } as const;
const finance = { id: "fin-1", role: "FINANCE", departmentId: "budget" } as const;
const committee = { id: "board-1", role: "COMMITTEE", departmentId: null } as const;
const executive = { id: "exec-1", role: "EXECUTIVE", departmentId: null } as const;
const procurement = { id: "proc-1", role: "PROCUREMENT", departmentId: "budget" } as const;

const ownDraft = { responsibleUserId: "teacher-1", departmentId: "academic", status: "DRAFT" } as const;
const deptDraft = { responsibleUserId: "teacher-2", departmentId: "academic", status: "DRAFT" } as const;
const otherDeptDraft = { responsibleUserId: "teacher-3", departmentId: "general", status: "DRAFT" } as const;

describe("project authorization", () => {
  it("allows a teacher to read projects in their department or their own projects", () => {
    // Can read own project
    expect(canReadProject(teacher, ownDraft)).toBe(true);
    // Can read projects in same department
    expect(canReadProject(teacher, deptDraft)).toBe(true);
    // Cannot read projects in other department
    expect(canReadProject(teacher, otherDeptDraft)).toBe(false);
  });

  it("allows teachers in same department to edit draft projects", () => {
    // Owner can edit
    expect(canEditProject(teacher, ownDraft)).toBe(true);
    // Colleague in same department can edit
    expect(canEditProject(otherTeacherInSameDept, ownDraft)).toBe(true);
    // Teacher in other department cannot edit
    expect(canEditProject(teacherInOtherDept, ownDraft)).toBe(false);
    // Cannot edit if not DRAFT
    expect(canEditProject(teacher, { ...ownDraft, status: "SUBMITTED" })).toBe(false);
  });

  it("limits department review to a head in the project's department", () => {
    const submitted = { ...ownDraft, status: "SUBMITTED" } as const;
    expect(canActOnProject(head, submitted, "dept_approve")).toBe(true);
    expect(canActOnProject({ ...head, departmentId: "general" }, submitted, "dept_approve")).toBe(false);
  });

  it("allows finance review after department review and hides drafts from committee", () => {
    expect(canActOnProject(finance, { ...ownDraft, status: "PENDING_FINANCE_REVIEW" }, "finance_approve")).toBe(true);
    expect(canReadProject(committee, ownDraft)).toBe(false);
    expect(canReadProject(committee, { ...ownDraft, status: "COMPLETED" })).toBe(true);
  });

  it("limits detailed budget history to related operational roles", () => {
    expect(canViewProjectBudgetHistory(teacher, ownDraft)).toBe(true);
    expect(canViewProjectBudgetHistory(otherTeacherInSameDept, ownDraft)).toBe(true);
    expect(canViewProjectBudgetHistory(teacherInOtherDept, ownDraft)).toBe(false);
    expect(canViewProjectBudgetHistory(head, ownDraft)).toBe(true);
    expect(canViewProjectBudgetHistory(finance, ownDraft)).toBe(true);
    expect(canViewProjectBudgetHistory(executive, ownDraft)).toBe(true);
    expect(canViewProjectBudgetHistory(procurement, ownDraft)).toBe(true);
    expect(
      canViewProjectBudgetHistory(committee, { ...ownDraft, status: "COMPLETED" }),
    ).toBe(false);
    expect(
      canViewProjectBudgetHistory(
        { id: "admin-1", role: "SUPER_ADMIN", departmentId: null },
        ownDraft,
      ),
    ).toBe(true);
  });
});
