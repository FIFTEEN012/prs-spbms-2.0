import { describe, expect, it } from "vitest";
import { resolveLegacyWalletCode } from "./legacy-budget-migration";

describe("resolveLegacyWalletCode", () => {
  it("maps restricted sources directly to their special wallets", () => {
    expect(resolveLegacyWalletCode("LEARNER_ACTIVITY", "กลุ่มบริหารวิชาการ")).toBe("LEARNER_ACTIVITY");
    expect(resolveLegacyWalletCode("SCHOOL_INCOME", "กลุ่มบริหารทั่วไป")).toBe("SCHOOL_INCOME");
  });

  it("maps the general subsidy by project department", () => {
    expect(resolveLegacyWalletCode("GENERAL_SUBSIDY", "กลุ่มบริหารวิชาการ")).toBe("ACADEMIC");
    expect(resolveLegacyWalletCode("GENERAL_SUBSIDY", "กลุ่มบริหารงบประมาณ")).toBe("BUDGET");
    expect(resolveLegacyWalletCode("GENERAL_SUBSIDY", "กลุ่มบริหารงานบุคคล")).toBe("PERSONNEL");
    expect(resolveLegacyWalletCode("GENERAL_SUBSIDY", "กลุ่มบริหารทั่วไป")).toBe("GENERAL");
  });

  it("returns null instead of guessing an unknown department", () => {
    expect(resolveLegacyWalletCode("GENERAL_SUBSIDY", null)).toBeNull();
    expect(resolveLegacyWalletCode(null, "ฝ่ายที่ไม่รู้จัก")).toBeNull();
  });
});
