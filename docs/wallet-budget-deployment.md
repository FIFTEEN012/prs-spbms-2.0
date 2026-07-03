# Wallet Budget Deployment Runbook

ระบบนี้เพิ่มตารางแบบ additive และเก็บตารางงบประมาณเดิมไว้ระหว่าง migration ห้ามลบข้อมูลเดิมก่อน reconciliation ผ่าน

## 1. Backup And Preview

1. สร้าง snapshot/branch ของฐาน Neon ปัจจุบัน
2. รัน `npm run db:preview-wallet-migration`
3. ตรวจ `unresolved` และ `negativeWallets` ให้เป็นรายการว่างก่อนยืนยัน migration
4. ยืนยันยอดฐานเดิม: 58 โครงการ, allocation 758,035 บาท, expense 59,900 บาท

Preview ปัจจุบันยังบล็อกการย้าย เนื่องจากโครงการเงินเรียนฟรี 15 ปีบางรายการไม่มีฝ่าย และกระเป๋ากลุ่มบริหารงบประมาณมีวงเงินต่ำกว่ายอดโครงการเดิม ต้องแก้ mapping หรือปรับแผนผ่าน workflow ก่อน

## 2. Baseline Existing Database

ฐานเดิมมีตารางอยู่แล้วแต่ไม่มี Prisma migration history จึงต้อง mark baseline เพียงครั้งเดียว:

```powershell
npx prisma migrate resolve --applied 20260618000000_legacy_baseline
```

ห้ามรัน baseline SQL กับฐานเดิม เพราะตารางมีอยู่แล้ว คำสั่ง `resolve` มีไว้บันทึกประวัติเท่านั้น

## 3. Deploy Additive Schema

```powershell
npm run db:deploy
npx prisma generate
npm run db:seed
```

ตรวจว่ามี `FiscalYear 2569`, FundSource codes 3 รายการ และตาราง `BudgetPlan`, `BudgetWallet`, `WalletLedgerEntry`

## 4. Create And Lock Budget Plan

1. Finance เปิด `/budget-allocation`
2. สร้างแผนปีการศึกษา/ปีงบประมาณ 2569
3. บันทึกรายรับ ยอดยกมา รายการหัก และยอดของแหล่งเงินพิเศษ
4. ตรวจสูตรรวม 100% และ preview 9 กระเป๋า
5. Finance ส่งอนุมัติ
6. Executive อนุมัติและล็อกแผน

## 5. Reconcile Legacy Data

1. Super Admin กดสร้าง migration preview
2. แก้ทุกรายการที่จับคู่ไม่ได้ และปรับแผนผ่าน workflow จนไม่มีกระเป๋าติดลบ
3. สร้าง preview ใหม่
4. ยืนยัน migration พร้อมเหตุผล
5. ตรวจ statement กระเป๋าเทียบรายงานเดิมก่อนปิด flow เขียน `BudgetTransaction` เดิม

## Rollback

หาก migration schema ล้มเหลว ให้ restore Neon snapshot/branch ห้ามลบ ledger บางรายการด้วยมือ หาก migration ข้อมูลถูกยืนยันแล้วแต่ต้องแก้ ให้ใช้ reversal/transfer เท่านั้น
