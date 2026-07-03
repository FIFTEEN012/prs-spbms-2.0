"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  applyDraftValues,
  buildQueryString,
  type QueryValueMap,
} from "@/lib/list-query-state";

function valuesAreEqual(left: QueryValueMap, right: QueryValueMap) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of keys) {
    if ((left[key] ?? "") !== (right[key] ?? "")) {
      return false;
    }
  }

  return true;
}

export function useListControls<TValues extends QueryValueMap>({
  initialValues,
  defaults,
  debounceMs = 350,
  searchKey = "q",
  pageKey = "page",
}: {
  initialValues: TValues;
  defaults: TValues;
  debounceMs?: number;
  searchKey?: keyof TValues & string;
  pageKey?: keyof TValues & string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [draftValues, setDraftValues] = useState<TValues>(initialValues);
  const [appliedValues, setAppliedValues] = useState<TValues>(initialValues);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const draftValuesRef = useRef<TValues>(initialValues);
  const appliedValuesRef = useRef<TValues>(initialValues);

  useEffect(() => {
    draftValuesRef.current = initialValues;
    appliedValuesRef.current = initialValues;
    setDraftValues(initialValues);
    setAppliedValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const navigate = (nextValues: QueryValueMap) => {
    const queryString = buildQueryString(nextValues, defaults);
    const href = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  const setValue = (key: keyof TValues & string, value: string) => {
    const nextDraft = { ...draftValuesRef.current, [key]: value };
    draftValuesRef.current = nextDraft;
    setDraftValues(nextDraft);

    if (key === searchKey) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const nextValues = applyDraftValues(
          appliedValuesRef.current,
          draftValuesRef.current,
          defaults,
          pageKey,
        ) as TValues;

        appliedValuesRef.current = nextValues;
        setAppliedValues(nextValues);
        navigate(nextValues);
      }, debounceMs);
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const nextValues = applyDraftValues(
        appliedValuesRef.current,
        nextDraft,
        defaults,
        pageKey,
      ) as TValues;

      appliedValuesRef.current = nextValues;
      setAppliedValues(nextValues);
      navigate(nextValues);
    }
  };

  const apply = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const nextValues = applyDraftValues(
      appliedValuesRef.current,
      draftValuesRef.current,
      defaults,
      pageKey,
    ) as TValues;

    appliedValuesRef.current = nextValues;
    setAppliedValues(nextValues);
    setDraftValues(nextValues);
    navigate(nextValues);
  };

  const reset = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    appliedValuesRef.current = defaults;
    draftValuesRef.current = defaults;
    setAppliedValues(defaults);
    setDraftValues(defaults);
    navigate(defaults);
  };

  const goToPage = (page: number) => {
    const nextValues = {
      ...appliedValuesRef.current,
      [pageKey]: String(page),
    } as TValues;

    appliedValuesRef.current = nextValues;
    draftValuesRef.current = nextValues;
    setAppliedValues(nextValues);
    setDraftValues(nextValues);
    navigate(nextValues);
  };

  const isDirty = useMemo(
    () => !valuesAreEqual(draftValues, appliedValues),
    [appliedValues, draftValues],
  );

  return {
    appliedValues,
    draftValues,
    isDirty,
    isPending,
    setValue,
    apply,
    reset,
    goToPage,
  };
}
