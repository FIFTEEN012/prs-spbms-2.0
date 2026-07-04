# รายงาน Performance PRS SPBMS 2.0

วันที่วัดผล: 3 กรกฎาคม 2026  
สภาพแวดล้อม: local dev database ตาม `.env`, production build ผ่าน `next build` แล้วรัน `next start`  
Runtime ที่พบ: Node v24.14.1, npm 11.12.1, Next 15.5.19, React 18.3.1, Prisma 5.22.0

## สรุป

รอบนี้ optimize เฉพาะ hotspot ที่วัดพบใน production build โดยไม่เปลี่ยน workflow, RBAC, validation หรือ schema. ผลลัพธ์หลักคือ route กลุ่ม dashboard/projects/budget-allocation เร็วขึ้นชัดเจน และมี loading feedback ระดับ App Router สำหรับหน้าหลักทั้งหมดในกลุ่ม `(app)`.

Next 15.5.19 ใน local package ระบุ `engines.node` เป็น `^18.18.0 || ^19.8.0 || >=20.0.0` ดังนั้น Node v24.14.1 ไม่หลุดเงื่อนไขรองรับ. ยังไม่เพิ่ม `.nvmrc` หรือ `engines` ในรอบนี้ เพราะผลวัดชี้ว่าคอขวดหลักอยู่ที่ server data fetching/DB มากกว่ารุ่น Node. ถ้าทีมต้องการ reproducible runtime แนะนำ pin Node 22 LTS ในรอบถัดไป.

## วิธีวัด

- Baseline: หลัง `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` แล้ววัด production build ด้วย session admin seeded user.
- After: วัด production build ด้วย `npm run perf:benchmark`, `PERF_ITERATIONS=5`.
- DB query count: วัดด้วย Prisma query counter ที่เปิดเฉพาะ `PERF_QUERY_COUNT=1` ผ่าน `/api/perf/query-count`; ไม่เปิดใน production runtime ปกติ.
- Benchmark script: `scripts/perf-benchmark.mjs`

## ผลก่อน/หลัง

| Route/API | ก่อน median (ms) | หลัง median (ms) | DB queries หลัง | Bottleneck หลัก | Improvement |
| --- | ---: | ---: | ---: | --- | ---: |
| `/dashboard` | 516 | 226 | 8 | query active year ซ้ำและ query อิสระรันตามลำดับ | 56.2% |
| `/projects` | 662 | 303 | 8 | list data + reference data | 54.2% |
| `/approvals` | 173 | 80 | 2 | reference departments | 53.8% |
| `/budget` | 234 | 150 | 3 | โหลด transactions แบบ nested | 35.9% |
| `/budget-allocation` | 900 | 498 | 12 | nested budget plan/wallet data | 44.7% |
| `/procurement` | 456 | 405 | 13 | project selector และ purchase request aggregates | 11.2% |
| `/academic-years` | 47 | 42 | 1 | เบาอยู่แล้ว | 10.6% |
| `/users` | 208 | 119 | 3 | departments reference | 42.8% |
| `/projects/[id]` | 446 | 475 | 13 | audit/history/balance windows ยังเป็น hotspot | -6.5% |
| `/projects/[id]/edit` | 335 | 330 | 6 | form reference data | 1.5% |
| `/projects/new` | 89 | 56 | 2 | form reference data | 37.1% |
| `/api/projects?page=1&limit=10` | 336 | 276 | 7 | list service aggregate data | 17.9% |
| `/api/approvals?page=1&limit=10` | 96 | 82 | 2 | approval list query | 14.6% |
| `/api/procurements/requests?page=1&limit=10` | 452 | 427 | 11 | procurement remaining-budget calculations | 5.5% |
| `/api/users?page=1&limit=10` | 134 | 117 | 3 | list query | 12.7% |
| `/api/budget-wallets/summary` | 211 | 210 | 5 | wallet summary calculation | 0.5% |

หมายเหตุ: เวลา "หลัง" ใช้รอบ `PERF_ITERATIONS=5` ที่ไม่เปิด query counter เพื่อลด overhead. คอลัมน์ DB queries ใช้รอบแยก `PERF_QUERY_COUNT=1`, `PERF_ITERATIONS=3`.

## สิ่งที่ปรับ

- เพิ่ม `src/app/(app)/loading.tsx` เพื่อให้ navigation ไปหน้าหลักมี skeleton feedback ทันทีระหว่างรอ server component/DB.
- เพิ่ม `npm run perf:benchmark` สำหรับ login seeded user และวัด route/API สำคัญหลัง login.
- เพิ่ม query counter เฉพาะ benchmark/dev ผ่าน `PERF_QUERY_COUNT=1`; endpoint `/api/perf/query-count` คืน 404 เมื่อไม่เปิด env.
- Dashboard: reuse active academic year, parallelize query อิสระ, ลดการ query ซ้ำ.
- Projects/Procurement/Budget: ลด nested include ที่ไม่ใช้, เปลี่ยนเป็น `select` เฉพาะ field ที่ render, และใช้ aggregate/groupBy แทนโหลด transactions ทั้งหมดในหน้า budget.
- Project detail: แยก transaction history เป็น paginated DB query จริง แทนโหลด transactions ทั้งหมดแล้ว slice ใน memory.
- Budget allocation: parallelize academic/fiscal/latest plan และ wallet/transfer/operating expense queries; ลด dashboard helper ที่โหลด nested data เกินจำเป็น.
- Reference data cache: departments, active academic year, strategies, fund sources ใช้ short-lived `unstable_cache` 60 วินาที.

## Build/Bundle

`npm run build` ผ่านสำเร็จ. Route สำคัญยังเป็น dynamic (`ƒ`) เพราะอิง session/RBAC/DB. First Load JS หลังปรับ:

| Route | First Load JS |
| --- | ---: |
| `/projects` | 160 kB |
| `/procurement` | 155 kB |
| `/approvals` | 153 kB |
| `/users` | 151 kB |
| `/budget-allocation` | 134 kB |
| `/budget` | 115 kB |
| `/dashboard` | 106 kB |

ยังไม่ได้เพิ่ม bundle analyzer dependency เพราะ route time ที่ช้าที่สุดยังสัมพันธ์กับ server/DB มากกว่า bundle size.

## Cache และ Invalidation Risk

Reference cache TTL 60 วินาทีเหมาะกับข้อมูลที่ไม่ใช่สิทธิ์ผู้ใช้และไม่ใช่งบ realtime:

- departments
- active academic year
- strategies
- fund sources

ความเสี่ยง: หลังแก้ข้อมูล reference อาจเห็นค่าเก่าถึงประมาณ 60 วินาทีในบางหน้า. ไม่ cache ข้อมูลสิทธิ์ผู้ใช้, project list, budget realtime, wallet balance หรือ workflow state.

## QA/Test

คำสั่งที่ผ่านหลังแก้:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` ผ่าน 23 test files / 93 tests
- `npm run perf:benchmark` ผ่าน production build พร้อม login admin seeded user

Smoke ที่ครอบคลุมในรอบนี้: login, dashboard, projects, approvals, budget, budget-allocation, procurement, academic years, users, project detail/edit/new และ API list หลัก. ยังไม่ได้รัน browser E2E แบบ mutating สำหรับ create/edit/submit/approve/purchase request ในรอบนี้ เพราะ project มี `test:e2e` เป็น placeholder และการ smoke แบบ mutation จะเพิ่มข้อมูลใน dev DB; แนะนำเพิ่ม Playwright scenario แยกที่ cleanup fixture ได้ในรอบถัดไป.

## Hotspot ที่ยังเหลือ

- `/projects/[id]` ยังช้ากว่า baseline เล็กน้อยหลังเปลี่ยนเป็น paginated history จริง เพราะยังต้องคำนวณ audit/history/balance window หลาย query. ได้ความถูกต้องด้าน pagination และลด memory load แต่ยังควร optimize ต่อ.
- `/api/procurements/requests` และ `/procurement` ยังมี query count สูงจาก remaining-budget/activity calculations.
- `/budget-allocation` ดีขึ้นมาก แต่ยังอยู่ราว 500ms จาก wallet ledger + operating expense summaries.

## ข้อเสนอถัดไป

1. เพิ่ม Playwright smoke workflow ที่สร้าง fixture ชั่วคราวและ cleanup ได้: create/edit project, submit, approve, create purchase request.
2. วิเคราะห์ `/projects/[id]` ด้วย query plan และพิจารณา index เฉพาะ transaction history/filter ถ้าข้อมูลจริงเยอะ.
3. ลด bundle หน้า `/projects`, `/procurement`, `/approvals`, `/users` ด้วย dynamic import เฉพาะ client controls ที่หนัก.
4. แยก procurement remaining-budget calculation เป็น aggregate query หรือ cached per project/activity ถ้าข้อมูลจริงโต.
