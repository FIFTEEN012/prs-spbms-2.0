import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  await prisma.schoolProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "โรงเรียนตัวอย่าง",
      address: "อำเภอเมือง จังหวัดมหาสารคาม",
      affiliation: "สพม. มหาสารคาม",
      vision: "เป็นสถานศึกษาที่จัดการศึกษาอย่างมีคุณภาพ",
      mission: "พัฒนาผู้เรียนให้เป็นคนดี มีความรู้ คู่คุณธรรม",
    },
  });

  const departments = await Promise.all(
    [
      "กลุ่มบริหารวิชาการ",
      "กลุ่มบริหารงบประมาณ",
      "กลุ่มบริหารงานบุคคล",
      "กลุ่มบริหารทั่วไป",
    ].map((name) =>
      prisma.department.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const year = await prisma.academicYear.upsert({
    where: { yearName: "2569" },
    update: { isActive: true },
    create: {
      yearName: "2569",
      isActive: true,
      startDate: new Date("2026-05-16"),
      endDate: new Date("2027-03-31"),
    },
  });

  await prisma.fiscalYear.upsert({
    where: { yearName: "2569" },
    update: { isActive: true },
    create: {
      yearName: "2569",
      isActive: true,
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-09-30"),
    },
  });

  await Promise.all([
    prisma.strategy.upsert({
      where: { academicYearId_code: { academicYearId: year.id, code: "S1" } },
      update: {},
      create: {
        academicYearId: year.id,
        code: "S1",
        title: "ยกระดับคุณภาพผู้เรียน",
      },
    }),
    prisma.strategy.upsert({
      where: { academicYearId_code: { academicYearId: year.id, code: "S2" } },
      update: {},
      create: {
        academicYearId: year.id,
        code: "S2",
        title: "พัฒนาครูและบุคลากร",
      },
    }),
    prisma.strategy.upsert({
      where: { academicYearId_code: { academicYearId: year.id, code: "S3" } },
      update: {},
      create: {
        academicYearId: year.id,
        code: "S3",
        title: "พัฒนาสภาพแวดล้อมการเรียนรู้",
      },
    }),
  ]);

  await Promise.all([
    prisma.fundSource.upsert({
      where: { code: "GENERAL_SUBSIDY" },
      update: {},
      create: { code: "GENERAL_SUBSIDY", name: "เงินอุดหนุนรายหัว", budgetAmount: 2000000 },
    }),
    prisma.fundSource.upsert({
      where: { code: "LEARNER_ACTIVITY" },
      update: {},
      create: { code: "LEARNER_ACTIVITY", name: "เงินกิจกรรมพัฒนาผู้เรียน", budgetAmount: 800000 },
    }),
    prisma.fundSource.upsert({
      where: { code: "SCHOOL_INCOME" },
      update: {},
      create: { code: "SCHOOL_INCOME", name: "เงินรายได้สถานศึกษา", budgetAmount: 500000 },
    }),
  ]);

  const users: Array<{
    username: string;
    role: Role;
    fullName: string;
    department?: string;
  }> = [
    { username: "admin", role: "SUPER_ADMIN", fullName: "ผู้ดูแลระบบ" },
    { username: "director", role: "EXECUTIVE", fullName: "ผู้อำนวยการโรงเรียน" },
    {
      username: "head_academic",
      role: "DEPT_HEAD",
      fullName: "หัวหน้ากลุ่มบริหารวิชาการ",
      department: "กลุ่มบริหารวิชาการ",
    },
    {
      username: "teacher1",
      role: "TEACHER",
      fullName: "ครูสมชาย ใจดี",
      department: "กลุ่มบริหารวิชาการ",
    },
    {
      username: "finance",
      role: "FINANCE",
      fullName: "เจ้าหน้าที่การเงิน",
      department: "กลุ่มบริหารงบประมาณ",
    },
    {
      username: "procurement",
      role: "PROCUREMENT",
      fullName: "เจ้าหน้าที่พัสดุ",
      department: "กลุ่มบริหารงบประมาณ",
    },
    { username: "committee", role: "COMMITTEE", fullName: "คณะกรรมการสถานศึกษา" },
  ];

  for (const u of users) {
    const dept = u.department
      ? departments.find((d) => d.name === u.department)
      : null;
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash: hash("password123"),
        fullName: u.fullName,
        role: u.role,
        departmentId: dept?.id,
      },
    });
  }

  console.log("✅ Seeded. Default password for all users: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
