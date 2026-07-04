import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const REFERENCE_REVALIDATE_SECONDS = 60;

export const getDepartmentsReference = unstable_cache(
  () =>
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["departments-reference"],
  { revalidate: REFERENCE_REVALIDATE_SECONDS },
);

export const getActiveAcademicYearReference = unstable_cache(
  () =>
    prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, yearName: true },
    }),
  ["active-academic-year-reference"],
  { revalidate: REFERENCE_REVALIDATE_SECONDS },
);

export const getStrategiesReference = unstable_cache(
  () =>
    prisma.strategy.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true },
    }),
  ["strategies-reference"],
  { revalidate: REFERENCE_REVALIDATE_SECONDS },
);

export const getFundSourcesReference = unstable_cache(
  () =>
    prisma.fundSource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["fund-sources-reference"],
  { revalidate: REFERENCE_REVALIDATE_SECONDS },
);
