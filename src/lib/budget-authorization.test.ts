import { describe, expect, it } from "vitest";
import {
  canApproveBudgetPlan,
  canManageBudgetPlan,
  canViewBudgetWallet,
} from "./authorization";

describe("budget wallet authorization", () => {
  it("allows finance to manage plans and executives to approve them", () => {
    expect(canManageBudgetPlan({ id: "f", role: "FINANCE", departmentId: null })).toBe(true);
    expect(canManageBudgetPlan({ id: "e", role: "EXECUTIVE", departmentId: null })).toBe(false);
    expect(canApproveBudgetPlan({ id: "e", role: "EXECUTIVE", departmentId: null })).toBe(true);
    expect(canApproveBudgetPlan({ id: "f", role: "FINANCE", departmentId: null })).toBe(false);
  });

  it("limits department wallet statements while allowing operational roles", () => {
    const academicWallet = { departmentId: "academic" };
    expect(canViewBudgetWallet({ id: "t", role: "TEACHER", departmentId: "academic" }, academicWallet)).toBe(true);
    expect(canViewBudgetWallet({ id: "t", role: "TEACHER", departmentId: "general" }, academicWallet)).toBe(false);
    expect(canViewBudgetWallet({ id: "p", role: "PROCUREMENT", departmentId: null }, academicWallet)).toBe(true);
    expect(canViewBudgetWallet({ id: "c", role: "COMMITTEE", departmentId: null }, academicWallet)).toBe(false);
    expect(canViewBudgetWallet({ id: "a", role: "SUPER_ADMIN", departmentId: null }, academicWallet)).toBe(true);
  });
});
