import { describe, expect, it } from "vitest";
import { nextProjectStatus } from "./project-machine";

describe("project workflow", () => {
  it("routes approval through department, finance and executive stages", () => {
    expect(nextProjectStatus("DRAFT", "submit")).toBe("PENDING_DEPT_REVIEW");
    expect(nextProjectStatus("PENDING_DEPT_REVIEW", "dept_approve")).toBe("PENDING_FINANCE_REVIEW");
    expect(nextProjectStatus("PENDING_FINANCE_REVIEW", "finance_approve")).toBe("PENDING_EXECUTIVE_APPROVAL");
    expect(nextProjectStatus("PENDING_EXECUTIVE_APPROVAL", "executive_approve")).toBe("IN_PROGRESS");
  });

  it("returns any pending approval to draft when rejected", () => {
    expect(nextProjectStatus("PENDING_FINANCE_REVIEW", "reject_to_draft")).toBe("DRAFT");
  });

  it("requires completion review before closing a project", () => {
    expect(nextProjectStatus("IN_PROGRESS", "submit_completion")).toBe("PENDING_COMPLETION_REVIEW");
    expect(nextProjectStatus("PENDING_COMPLETION_REVIEW", "approve_completion")).toBe("COMPLETED");
    expect(() => nextProjectStatus("DRAFT", "approve_completion")).toThrow("Invalid project transition");
  });
});
