# PRS SPBMS 2.0 — ระบบบริหารแผนปฏิบัติการประจำปีและงบประมาณของโรงเรียน

ระบบเว็บแอปพลิเคชันสำหรับบริหารจัดการแผนปฏิบัติการประจำปีและงบประมาณของโรงเรียน
(School Plan & Budget Management System)

> สถานะปัจจุบัน: **MVP Phase 1** — Auth + RBAC, Academic Year, Projects + Approval Workflow,
> Budget tracking + Real-time validation, Dashboard, Audit log, Notifications (DB)

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 18 + TypeScript
- **UI**: Tailwind CSS + Shadcn-style components + TH Sarabun New
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL serverless)
- **ORM**: Prisma (pooled + direct URL)
- **Auth**: NextAuth.js (Credentials + JWT)
- **Validation**: Zod

---

## Standard List Filtering

The main list screens now use a shared filter/search/sort/pagination pattern:

- `projects`
- `users`
- `approvals`
- `procurement` purchase requests

### Supported query parameters

Shared parameters:

- `q`: keyword search
- `sortBy`: allowlisted sort field per screen
- `sortDir`: `asc` or `desc`
- `page`: 1-based page number
- `limit`: page size, default `10`

Entity-specific parameters:

- `projects`: `status`, `departmentId`
- `users`: `role`, `isActive`, `departmentId`
- `approvals`: `status`, `departmentId`
- `procurement requests`: `status`, `month`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`

### Standard response shape

Collection APIs return:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 10,
  "totalPages": 1,
  "filters": {}
}
```

### Sort allowlists

- Projects: `createdAt`, `updatedAt`, `projectName`, `projectCode`, `budgetRequested`, `budgetApproved`, `status`
- Users: `fullName`, `username`, `role`, `createdAt`
- Approvals: `updatedAt`, `projectName`, `projectCode`, `budgetRequested`
- Procurement requests: `createdAt`, `documentDate`, `requestedAmount`, `status`, `subject`

### Validation and safety

- Invalid `page`, `limit`, `sortBy`, and `sortDir` values silently fall back to safe defaults.
- Invalid dates and negative numeric ranges are ignored instead of crashing the page.
- Sort fields are restricted by allowlist before Prisma query construction.
- Filtering uses Prisma query builders only; no raw SQL is used.

### Adding a new filter field

1. Add the canonical query field to the relevant `src/lib/*-list-service.ts` parser and default query values.
2. Extend the Prisma `where` builder in the same service.
3. Add the control to the page client component through `SearchFilterBar`.
4. Surface the applied filter in `activeFilters` so users can see what is active.
5. Add parser or route tests for the new field.

### Notes

- Search input syncs to the URL with debounce.
- Applying a new filter or sort resets pagination back to page 1.
- `projectId` on `/api/procurements/requests` is still supported for project-specific request loading.

---

## Quick Start

### 1. ติดตั้ง dependencies

```powershell
npm install
```

### 2. สร้าง Supabase project + ตั้งค่า .env

1. ไปที่ https://supabase.com → สร้าง project ใหม่
2. ไปที่ **Project Settings → Database**:
   - **Connection Pooling** (Mode: Transaction, Port 6543) → คัดลอก URI ใส่ `DATABASE_URL`
   - **Connection String → URI** (Port 5432, ไม่ใช่ Pooler) → คัดลอกใส่ `DIRECT_URL`
3. คัดลอกไฟล์ตัวอย่างแล้วแก้ค่า

```powershell
Copy-Item .env.example .env
```

> **สำคัญ**: `DATABASE_URL` ต้องมี `?pgbouncer=true&connection_limit=1` (Transaction mode)
> ส่วน `DIRECT_URL` ใช้ port 5432 — Prisma จะใช้สายนี้เฉพาะตอน migrate เท่านั้น

### 3. รัน migration + seed

```powershell
npm run db:migrate
npm run db:seed
```

### 4. เริ่ม dev server

```powershell
npm run dev
```

เปิด http://localhost:3100

---

## บัญชีทดลอง (seeded)

รหัสผ่านทั้งหมด: `password123`

| Username      | Role                 | คำอธิบาย                        |
|---------------|----------------------|---------------------------------|
| `admin`       | Super Admin          | จัดการระบบทั้งหมด                |
| `director`    | Executive            | ผู้บริหาร — อนุมัติขั้นสุดท้าย   |
| `head_academic` | Dept Head          | หัวหน้ากลุ่มงานวิชาการ           |
| `teacher1`    | Teacher              | ครูผู้รับผิดชอบโครงการ            |
| `finance`     | Finance              | เจ้าหน้าที่การเงิน                |
| `procurement` | Procurement          | เจ้าหน้าที่พัสดุ                  |
| `committee`   | Committee            | คณะกรรมการสถานศึกษา (อ่านอย่างเดียว) |

---

## ขั้นตอนการอนุมัติ (Approval Workflow)

```
[DRAFT] ─► (Teacher ส่ง) ─► [SUBMITTED]
            │
            ▼
[DEPT_HEAD ตรวจสอบ] ─► [REVIEWED]
            │
            ▼
[EXECUTIVE อนุมัติ + กำหนดงบ] ─► [APPROVED]
            │
            ▼
ระบบสร้าง BudgetTransaction (ALLOCATE) อัตโนมัติ
```

ทุกขั้นตอนตีกลับได้ → สถานะเป็น `REJECTED` + แจ้งเตือนผู้รับผิดชอบ

---

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── (app)/              # Authenticated routes
│   │   ├── layout.tsx       # Sidebar layout
│   │   ├── dashboard/
│   │   ├── projects/
│   │   │   ├── [id]/
│   │   │   ├── new/
│   │   │   └── _components/
│   │   ├── approvals/
│   │   ├── budget/
│   │   ├── procurement/
│   │   ├── academic-years/
│   │   └── users/
│   ├── api/                # API routes
│   │   ├── auth/[...nextauth]/
│   │   ├── projects/
│   │   └── budget-transactions/
│   ├── login/
│   └── layout.tsx
├── components/
│   ├── ui/                 # Shadcn-style primitives
│   └── sidebar.tsx
├── lib/
│   ├── prisma.ts
│   ├── auth.ts             # NextAuth config
│   ├── rbac.ts             # Role abilities
│   └── utils.ts
└── middleware.ts           # Route protection

prisma/
├── schema.prisma
└── seed.ts
```

---

## คำสั่งที่มีประโยชน์

```powershell
npm run dev            # Dev server
npm run build          # Production build
npm run db:migrate     # Run pending migrations (uses DIRECT_URL)
npm run db:reset       # Reset DB + reseed
npm run db:seed        # Seed only
npm run db:studio      # Prisma Studio (DB GUI)
```

---

## Roadmap (Phase 2+)

ยังไม่ทำใน MVP — รอ phase ถัดไป

- [ ] Word/PDF export (เล่มแผนปฏิบัติการ, สรุปงบประมาณ)
- [ ] File upload + attachment management
- [ ] Procurement CRUD + linking budget transactions
- [ ] Progress report + KPI evaluation forms
- [ ] Rich text editor for project fields
- [ ] LINE Notify integration
- [ ] Copy project from previous year
- [ ] Project templates
- [ ] QR code for document verification
- [ ] E-signature

---

## Security Notes

- Password hashing: bcrypt (cost 10)
- Session: JWT, signed with `NEXTAUTH_SECRET`
- RBAC enforced ทั้ง UI และ API
- Real-time budget validation ป้องกัน overspend
- Audit log บันทึกทุก action สำคัญ

ก่อน deploy production:
- เปลี่ยน `NEXTAUTH_SECRET` เป็นค่าสุ่มยาว
- เปลี่ยน DB password
- เปิด HTTPS + secure cookies
- เพิ่ม rate limiting ที่ `/api/auth`
