# PRS SPBMS 2.0
ระบบบริหารแผนปฏิบัติการและงบประมาณสถานศึกษา

PRS SPBMS 2.0 คือเว็บแอปสำหรับจัดการแผนงาน โครงการ งบประมาณ การอนุมัติ และการติดตามการใช้จ่ายของสถานศึกษาแบบครบวงจร
ออกแบบมาเพื่อช่วยให้ครู หัวหน้ากลุ่มงาน การเงิน และผู้บริหารทำงานบนกระบวนการเดียวกันได้อย่างเป็นระบบ

> สถานะปัจจุบัน: MVP Phase 1
> รองรับ Auth + RBAC, Academic Year, Projects, Approval Workflow, Budget Tracking, Dashboard, Audit Log และ Notification ในฐานข้อมูล

## ฟีเจอร์หลัก

- ระบบเข้าสู่ระบบด้วย NextAuth
- RBAC แยกสิทธิ์ตามบทบาทผู้ใช้
- จัดการปีการศึกษาและปีงบประมาณ
- สร้างและอนุมัติโครงการ
- ติดตามงบประมาณและการใช้งานจริง
- ตรวจสอบวงเงินแบบเรียลไทม์เพื่อลดความเสี่ยง overspend
- บันทึก audit log สำหรับการเปลี่ยนแปลงสำคัญ
- หน้ารวม dashboard สำหรับภาพรวมการทำงาน
- หน้าจอรายการหลักมี search, filter, sort และ pagination มาตรฐานเดียวกัน

## Tech Stack

- Frontend: Next.js 15, React 18, TypeScript
- UI: Tailwind CSS, component primitives style Shadcn
- Backend: Next.js API Routes
- Database: Supabase PostgreSQL
- ORM: Prisma
- Auth: NextAuth.js
- Validation: Zod

## โครงสร้างโปรเจกต์

```text
src/
├── app/                 # Pages, layouts, API routes
├── components/          # Shared UI components
├── lib/                 # Business logic, auth, RBAC, services
└── middleware.ts        # Route protection

prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

## การติดตั้ง

### 1) ติดตั้ง dependencies

```powershell
npm install
```

### 2) เตรียมไฟล์ environment

คัดลอกจากตัวอย่าง:

```powershell
Copy-Item .env.example .env
```

จากนั้นกรอกค่าจริงของ Supabase, NextAuth และค่ารหัสแอดมินเริ่มต้นให้เรียบร้อย

## ตัวแปรสำคัญใน `.env`

ตัวอย่างค่าที่ต้องมี:

```env
DATABASE_URL="postgresql://...pooler.../postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://...direct.../postgres"
NEXTAUTH_SECRET="change-me-to-a-long-random-string"
NEXTAUTH_URL="http://localhost:3100"
TEST_DATABASE_URL="postgresql://...test-pooler.../postgres?pgbouncer=true&connection_limit=1"
TEST_DIRECT_URL="postgresql://...test-direct.../postgres"
BOOTSTRAP_ADMIN_USERNAME="admin"
BOOTSTRAP_ADMIN_PASSWORD="change-me-before-running-bootstrap"
BOOTSTRAP_ADMIN_FULL_NAME="ผู้ดูแลระบบ"
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="server-only-secret-key"
SUPABASE_STORAGE_BUCKET="school-documents"
```

หมายเหตุ:

- `DATABASE_URL` ใช้ connection แบบ Transaction/Pooled สำหรับ runtime
- `DIRECT_URL` ใช้กับ Prisma migrate
- `TEST_DATABASE_URL` และ `TEST_DIRECT_URL` ควรชี้ไปยังฐานข้อมูลทดสอบแยกจาก production
- ห้าม commit ค่าจริงของ secret ลง repo

## คำสั่งที่ใช้บ่อย

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:reset
npm run db:studio
```

## บัญชีทดสอบที่ seed ไว้

รหัสผ่านเริ่มต้น: `password123`

| Username | Role | คำอธิบาย |
| --- | --- | --- |
| `admin` | Super Admin | ผู้ดูแลระบบทั้งหมด |
| `director` | Executive | ผู้บริหารระดับสูง |
| `head_academic` | Dept Head | หัวหน้ากลุ่มงานวิชาการ |
| `teacher1` | Teacher | ครูผู้สร้างและส่งโครงการ |
| `finance` | Finance | เจ้าหน้าที่การเงิน |
| `procurement` | Procurement | เจ้าหน้าที่พัสดุ |
| `committee` | Committee | คณะกรรมการสถานศึกษา |

## ขั้นตอนการอนุมัติ

```text
[DRAFT] -> [SUBMITTED] -> [REVIEWED] -> [APPROVED]
```

- ครูหรือผู้สร้างโครงการเริ่มจาก `DRAFT`
- หัวหน้ากลุ่มงานตรวจสอบและส่งต่อ
- ผู้บริหารอนุมัติขั้นสุดท้าย
- เมื่ออนุมัติแล้วระบบจะสร้างรายการงบประมาณที่เกี่ยวข้องโดยอัตโนมัติ

## การรันฐานข้อมูล

```powershell
npm run db:migrate
npm run db:seed
```

หากต้องทำงานกับ production schema ให้ใช้ `npm run db:deploy` แทน `db:migrate`

## Deployment Notes

- ตั้ง `NEXTAUTH_SECRET` เป็นค่ายาวและสุ่มจริงก่อนขึ้น production
- ใช้ Supabase connection string ให้ถูกประเภท:
  - runtime -> pooled / transaction
  - migrate -> direct
- ตรวจสอบว่า environment สำหรับทดสอบแยกจาก production
- หากใช้งานไฟล์แนบ ให้ตั้ง `SUPABASE_STORAGE_BUCKET` และ `SUPABASE_SERVICE_ROLE_KEY` ให้พร้อม
- ก่อนเปิดใช้งานจริง ควรตรวจสอบ seed admin และรหัสผ่านเริ่มต้นอีกครั้ง

## เอกสารเพิ่มเติม

- [Wallet Budget Deployment Runbook](./docs/wallet-budget-deployment.md)
- [Supabase environment template](./.env.example)

## หมายเหตุ

- โปรเจกต์นี้ใช้ไฟล์ `.gitignore` เพื่อกันไฟล์ build และ environment หลุดขึ้น repo
- แนะนำให้ทำงานบนฐานข้อมูลทดสอบก่อน deploy production ทุกครั้ง
