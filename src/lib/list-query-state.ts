export type QueryValueMap = Record<string, string>;

export function normalizeQueryValues(
  values: QueryValueMap,
  defaults: QueryValueMap,
) {
  const entries = Object.entries(values).filter(([key, value]) => {
    if (value === "") return false;
    return defaults[key] !== value;
  });

  return Object.fromEntries(entries);
}

export function buildQueryString(
  values: QueryValueMap,
  defaults: QueryValueMap,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(normalizeQueryValues(values, defaults))) {
    params.set(key, value);
  }

  return params.toString();
}

export function shouldResetPage(
  currentValues: QueryValueMap,
  nextValues: QueryValueMap,
  pageKey = "page",
) {
  const keys = new Set([
    ...Object.keys(currentValues),
    ...Object.keys(nextValues),
  ]);

  for (const key of keys) {
    if (key === pageKey) continue;
    if ((currentValues[key] ?? "") !== (nextValues[key] ?? "")) {
      return true;
    }
  }

  return false;
}

export function applyDraftValues(
  currentValues: QueryValueMap,
  draftValues: QueryValueMap,
  defaults: QueryValueMap,
  pageKey = "page",
) {
  const nextValues = { ...draftValues };

  if (shouldResetPage(currentValues, nextValues, pageKey)) {
    nextValues[pageKey] = defaults[pageKey] ?? "1";
  }

  return nextValues;
}

export function updateSingleQueryValue(
  currentValues: QueryValueMap,
  key: string,
  value: string,
  defaults: QueryValueMap,
  pageKey = "page",
) {
  const nextValues = { ...currentValues, [key]: value };

  if (key !== pageKey) {
    nextValues[pageKey] = defaults[pageKey] ?? "1";
  }

  return nextValues;
}
