import { describe, expect, it } from "vitest";
import {
  applyDraftValues,
  buildQueryString,
  normalizeQueryValues,
  shouldResetPage,
  updateSingleQueryValue,
} from "@/lib/list-query-state";

describe("list query state", () => {
  const defaults = {
    q: "",
    status: "",
    sortBy: "createdAt",
    sortDir: "desc",
    page: "1",
    limit: "10",
  };

  it("omits empty and default values from the query string", () => {
    expect(
      normalizeQueryValues(
        {
          ...defaults,
          q: "school",
          page: "2",
        },
        defaults,
      ),
    ).toEqual({
      q: "school",
      page: "2",
    });

    expect(
      buildQueryString(
        {
          ...defaults,
          q: "school",
          page: "2",
        },
        defaults,
      ),
    ).toBe("q=school&page=2");
  });

  it("resets page when non-page filters change", () => {
    expect(
      shouldResetPage(
        { ...defaults, page: "3" },
        { ...defaults, q: "budget", page: "3" },
      ),
    ).toBe(true);

    expect(
      applyDraftValues(
        { ...defaults, page: "3" },
        { ...defaults, q: "budget", page: "3" },
        defaults,
      ),
    ).toEqual({
      ...defaults,
      q: "budget",
      page: "1",
    });
  });

  it("does not reset page when only page changes", () => {
    expect(
      shouldResetPage(
        { ...defaults, page: "2" },
        { ...defaults, page: "3" },
      ),
    ).toBe(false);
  });

  it("resets page when updating a single non-page query value", () => {
    expect(
      updateSingleQueryValue(
        { ...defaults, page: "5" },
        "q",
        "project",
        defaults,
      ),
    ).toEqual({
      ...defaults,
      q: "project",
      page: "1",
    });
  });
});
