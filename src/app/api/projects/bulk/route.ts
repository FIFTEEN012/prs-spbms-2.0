import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { parseThaiDateStr } from "@/lib/date-utils";

// Thai Name Cleaning Helper
function cleanThaiName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/^(นาย|นางสาว|นาง|ครู|ครูผู้ช่วย|ดร\.|อาจารย์|อ\.)\s*/, "")
    .replace(/\s+/g, "");
}

// Loose Strategy Matching Helper
function findClosestStrategy(rawCode: string | null | undefined, strategies: any[], yearId: string) {
  if (!rawCode) return null;
  const cleanCode = rawCode.trim();

  // 1. Try exact match
  let matched = strategies.find(s => s.code === cleanCode && s.academicYearId === yearId);
  if (matched) return matched.id;

  // 2. Try match by digit (e.g. "ข้อ 1", "ข้อ 2" -> S1, S2)
  const matchNums = cleanCode.match(/\d+/g);
  if (matchNums && matchNums.length > 0) {
    for (const numStr of matchNums) {
      const candidateCode = `S${numStr}`;
      matched = strategies.find(s => s.code === candidateCode && s.academicYearId === yearId);
      if (matched) return matched.id;
    }
  }

  // 3. Try loose contains
  matched = strategies.find(
    s => s.academicYearId === yearId && 
         (cleanCode.includes(s.code) || s.code.includes(cleanCode))
  );
  if (matched) return matched.id;

  return null;
}

// Loose Fund Source Matching Helper
function findClosestFundSource(rawName: string | null | undefined, existingSources: any[]) {
  if (!rawName) return null;
  const cleanName = rawName.trim();
  
  // 1. Try exact match
  let matched = existingSources.find(f => f.name === cleanName);
  if (matched) return matched.id;

  // 2. Try simple contains match (e.g. "รายได้สถานศึกษา" matches "เงินรายได้สถานศึกษา")
  matched = existingSources.find(f => cleanName.includes(f.name) || f.name.includes(cleanName));
  if (matched) return matched.id;

  // 3. Define keyword mapping for loose matching
  const rules = [
    { pattern: /รายได้/, keyword: "รายได้" },
    { pattern: /ปัจจัยพื้นฐาน/, keyword: "ปัจจัยพื้นฐาน" },
    { pattern: /(เสมอภาค|กสศ)/, keyword: "เสมอภาค" },
    { pattern: /(รายหัว|อุดหนุนการศึกษา)/, keyword: "รายหัว" },
    { pattern: /(กิจกรรม|พัฒนาผู้เรียน)/, keyword: "กิจกรรม" },
    { pattern: /หนังสือ/, keyword: "หนังสือ" },
    { pattern: /อุปกรณ์/, keyword: "อุปกรณ์" },
    { pattern: /เครื่องแบบ/, keyword: "เครื่องแบบ" },
  ];

  // Try split parts first
  const parts = cleanName.split(/[\/\+]/);
  for (const part of parts) {
    const trimmedPart = part.trim();
    for (const rule of rules) {
      if (rule.pattern.test(trimmedPart)) {
        const found = existingSources.find(f => f.name.includes(rule.keyword));
        if (found) return found.id;
      }
    }
  }

  // Try entire string with rules
  for (const rule of rules) {
    if (rule.pattern.test(cleanName)) {
      const found = existingSources.find(f => f.name.includes(rule.keyword));
      if (found) return found.id;
    }
  }

  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user?.role, "project.create")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    const items = await req.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลโครงการสำหรับการนำเข้า" }, { status: 400 });
    }

    // 1. Fetch reference data for matching
    const [years, departments, strategies, fundSources, users] = await Promise.all([
      prisma.academicYear.findMany(),
      prisma.department.findMany(),
      prisma.strategy.findMany(),
      prisma.fundSource.findMany(),
      prisma.user.findMany({ where: { isActive: true } }),
    ]);

    const activeYear = years.find((y) => y.isActive);

    // 2. Fetch existing project codes to check duplicates
    const codesInCsv = Array.from(new Set(items.map((it: any) => it.projectCode?.trim()).filter(Boolean)));
    const existingProjects = await prisma.project.findMany({
      where: { projectCode: { in: codesInCsv } },
      select: { projectCode: true },
    });
    const dbCodesSet = new Set(existingProjects.map((p) => p.projectCode));

    const errors: string[] = [];
    const validatedItems: any[] = [];

    // Group items by projectCode to allow project definition + activity sub-rows mapping
    const groups: Record<string, { main: any; activities: any[] }> = {};
    for (let i = 0; i < items.length; i++) {
      const rowNum = i + 2;
      const row = items[i];
      const projectCode = row.projectCode?.trim();

      if (!projectCode) {
        errors.push(`แถวที่ ${rowNum}: ไม่ระบุรหัสโครงการ`);
        continue;
      }

      if (!groups[projectCode]) {
        groups[projectCode] = { main: null, activities: [] };
      }

      const isActivity = !!row.activityName?.trim();
      if (isActivity) {
        groups[projectCode].activities.push({ row, rowNum });
      } else {
        if (groups[projectCode].main) {
          errors.push(`แถวที่ ${rowNum}: พบข้อมูลโครงการหลักซ้ำกันสำหรับรหัสโครงการ '${projectCode}'`);
        } else {
          groups[projectCode].main = { row, rowNum };
        }
      }
    }

    // 3. Process each group
    for (const [projectCode, group] of Object.entries(groups)) {
      let mainRow = group.main;
      if (!mainRow) {
        if (group.activities.length > 0) {
          mainRow = group.activities[0]; // fallback to first activity row if no main project row defined
        } else {
          continue;
        }
      }

      const row = mainRow.row;
      const rowNum = mainRow.rowNum;

      const projectName = row.projectName?.trim();
      const yearName = row.yearName?.trim();
      const strategyCode = row.strategyCode?.trim();
      const departmentName = row.departmentName?.trim();
      const fundSourceName = row.fundSourceName?.trim();
      const responsibleName = row.responsibleName?.trim();
      const startDateRaw = row.startDate;
      const endDateRaw = row.endDate;

      if (!projectName) {
        errors.push(`แถวที่ ${rowNum}: ไม่ระบุชื่อโครงการ`);
        continue;
      }

      // Unique code validation in Database
      if (dbCodesSet.has(projectCode)) {
        errors.push(`แถวที่ ${rowNum}: รหัสโครงการ '${projectCode}' มีอยู่แล้วในระบบ`);
        continue;
      }

      // Academic Year matching
      let matchedYear = activeYear;
      if (yearName) {
        matchedYear = years.find((y) => y.yearName === yearName);
        if (!matchedYear) {
          errors.push(`แถวที่ ${rowNum}: ไม่พบข้อมูลปีการศึกษา '${yearName}'`);
          continue;
        }
      }
      if (!matchedYear) {
        errors.push(`แถวที่ ${rowNum}: ไม่ระบุปีการศึกษา และไม่พบปีการศึกษาที่เป็นปัจจุบัน (Active) ในระบบ`);
        continue;
      }

      // Department matching
      let matchedDeptId = null;
      if (departmentName) {
        const cleanDeptName = departmentName.trim();
        let dept = departments.find((d) => d.name === cleanDeptName);
        if (!dept) {
          dept = departments.find((d) => cleanDeptName.includes(d.name) || d.name.includes(cleanDeptName));
        }
        if (dept) {
          matchedDeptId = dept.id;
        }
      }

      // Enforce department restriction for non-admins
      if (session!.user.role !== "SUPER_ADMIN") {
        if (!matchedDeptId) {
          matchedDeptId = session!.user.departmentId;
        } else if (matchedDeptId !== session!.user.departmentId) {
          errors.push(`แถวที่ ${rowNum}: ไม่มีสิทธิ์สร้างโครงการในฝ่ายอื่น '${departmentName}'`);
        }
      }

      // Strategy matching
      const matchedStrategyId = findClosestStrategy(strategyCode, strategies, matchedYear.id);

      // Fund Source matching
      const matchedFundId = findClosestFundSource(fundSourceName, fundSources);

      // User matching
      let matchedUserId = session!.user.id;
      if (responsibleName) {
        const cleanInputName = cleanThaiName(responsibleName);
        const usr = users.find(
          (u) => 
            u.fullName === responsibleName || 
            u.username === responsibleName ||
            cleanThaiName(u.fullName) === cleanInputName ||
            u.username === cleanInputName
        );
        if (usr) {
          matchedUserId = usr.id;
        }
      }

      // Activities parsing
      const mappedActivities = [];
      let totalActivitiesBudget = 0;

      for (const act of group.activities) {
        const actRow = act.row;
        const actRowNum = act.rowNum;
        const name = actRow.activityName?.trim();
        if (!name) continue;

        let actBudget = 0;
        if (actRow.activityBudget !== undefined && actRow.activityBudget !== null && actRow.activityBudget !== "") {
          const cleanVal = String(actRow.activityBudget).replace(/,/g, "").trim();
          actBudget = Number(cleanVal);
          if (isNaN(actBudget)) {
            errors.push(`แถวที่ ${actRowNum}: งบประมาณกิจกรรม '${actRow.activityBudget}' ไม่ใช่ตัวเลขที่ถูกต้อง`);
          }
        }

        const matchedActFundId = findClosestFundSource(actRow.activityFundSource, fundSources) || matchedFundId;

        totalActivitiesBudget += actBudget;
        mappedActivities.push({
          name,
          budget: actBudget,
          fundSourceId: matchedActFundId,
        });
      }

      // Project Budget calculation (fallback to sum of activities if project's budget is 0 or empty)
      let budgetRequested = 0;
      const budgetRequestedRaw = row.budgetRequested;
      if (budgetRequestedRaw !== undefined && budgetRequestedRaw !== null && budgetRequestedRaw !== "") {
        const cleanVal = String(budgetRequestedRaw).replace(/,/g, "").trim();
        budgetRequested = Number(cleanVal);
        if (isNaN(budgetRequested)) {
          errors.push(`แถวที่ ${rowNum}: งบประมาณเสนอขอ '${budgetRequestedRaw}' ไม่ใช่ตัวเลขที่ถูกต้อง`);
        }
      }
      if (budgetRequested === 0 && totalActivitiesBudget > 0) {
        budgetRequested = totalActivitiesBudget;
      }

      // Dates validation
      const startDate = startDateRaw ? parseThaiDateStr(startDateRaw) : null;
      const endDate = endDateRaw ? parseThaiDateStr(endDateRaw) : null;

      validatedItems.push({
        academicYearId: matchedYear.id,
        projectCode,
        projectName,
        strategyId: matchedStrategyId,
        departmentId: matchedDeptId,
        fundSourceId: matchedFundId,
        responsibleUserId: matchedUserId,
        rationale: row.rationale || null,
        objectives: row.objectives || null,
        quantitativeTarget: row.quantitativeTarget || null,
        qualitativeTarget: row.qualitativeTarget || null,
        indicators: row.indicators || null,
        method: row.method || null,
        expectedOutcome: row.expectedOutcome || null,
        startDate,
        endDate,
        budgetRequested,
        activities: mappedActivities,
      });
    }

    // 4. Return errors if any
    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    // 5. Atomic transaction to insert projects and nested activities
    await prisma.$transaction(async (tx) => {
      for (const item of validatedItems) {
        const project = await tx.project.create({
          data: {
            academicYearId: item.academicYearId,
            projectCode: item.projectCode,
            projectName: item.projectName,
            strategyId: item.strategyId,
            departmentId: item.departmentId,
            fundSourceId: item.fundSourceId,
            responsibleUserId: item.responsibleUserId,
            rationale: item.rationale,
            objectives: item.objectives,
            quantitativeTarget: item.quantitativeTarget,
            qualitativeTarget: item.qualitativeTarget,
            indicators: item.indicators,
            method: item.method,
            expectedOutcome: item.expectedOutcome,
            startDate: item.startDate,
            endDate: item.endDate,
            budgetRequested: item.budgetRequested,
            status: "DRAFT",
            activities: {
              create: item.activities.map((act: any) => ({
                name: act.name,
                budget: act.budget,
                fundSourceId: act.fundSourceId,
              })),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: session!.user.id,
            action: "CREATE",
            entityName: "Project",
            entityId: project.id,
            metadata: { importSource: "CSV", activitiesCount: item.activities.length },
          },
        });
      }
    }, {
      maxWait: 60000,
      timeout: 60000,
    });

    return NextResponse.json({ success: true, count: validatedItems.length });
  } catch (e: any) {
    console.error("CSV Import Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล: " + e.message }, { status: 500 });
  }
}
