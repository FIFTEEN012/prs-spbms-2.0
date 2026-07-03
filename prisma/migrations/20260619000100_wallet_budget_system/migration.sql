-- CreateEnum
CREATE TYPE "BudgetPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetSourceEntryType" AS ENUM ('RECEIPT', 'CARRY_FORWARD', 'DEDUCTION', 'RETURN', 'CORRECTION_INCREASE', 'CORRECTION_DECREASE');

-- CreateEnum
CREATE TYPE "BudgetWalletCode" AS ENUM ('RESERVE', 'UTILITIES', 'CENTRAL', 'ACADEMIC', 'BUDGET', 'PERSONNEL', 'GENERAL', 'LEARNER_ACTIVITY', 'SCHOOL_INCOME');

-- CreateEnum
CREATE TYPE "WalletSpendMode" AS ENUM ('TRANSFER_ONLY', 'OPERATING', 'PROJECT_ACTIVITY', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "WalletLedgerEntryType" AS ENUM ('ALLOCATION', 'COMMITMENT', 'COMMITMENT_RELEASE', 'DISBURSEMENT', 'REFUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE');

-- CreateEnum
CREATE TYPE "WalletReferenceType" AS ENUM ('BUDGET_PLAN', 'PROJECT_ACTIVITY', 'PURCHASE_REQUEST', 'OPERATING_EXPENSE', 'BUDGET_TRANSFER', 'MIGRATION', 'REVERSAL');

-- CreateEnum
CREATE TYPE "BudgetRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetMigrationStatus" AS ENUM ('PREVIEWED', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "FundSource" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "budgetWalletId" TEXT;

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "yearName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "status" "BudgetPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "percentageSnapshot" JSONB NOT NULL,
    "generalSubsidyNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "learnerActivityNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "schoolIncomeNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetSourceAccount" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "fundSourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetSourceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetSourceEntry" (
    "id" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "entryType" "BudgetSourceEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "documentNo" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetSourceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetWallet" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "code" "BudgetWalletCode" NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(7,4),
    "spendMode" "WalletSpendMode" NOT NULL,
    "departmentId" TEXT,
    "warningPercent" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "entryType" "WalletLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" "WalletReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFundingAllocation" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "approvedAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityFundingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetTransferRequest" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "fromWalletId" TEXT NOT NULL,
    "toWalletId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BudgetRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdById" TEXT NOT NULL,
    "approverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingExpense" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "documentNo" TEXT,
    "status" "BudgetRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approverId" TEXT,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetMigrationRun" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "status" "BudgetMigrationStatus" NOT NULL DEFAULT 'PREVIEWED',
    "preview" JSONB NOT NULL,
    "legacyProjectCount" INTEGER NOT NULL,
    "legacyAllocation" DECIMAL(14,2) NOT NULL,
    "legacyExpense" DECIMAL(14,2) NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetMigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_yearName_key" ON "FiscalYear"("yearName");

-- CreateIndex
CREATE INDEX "BudgetPlan_status_idx" ON "BudgetPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlan_academicYearId_fiscalYearId_key" ON "BudgetPlan"("academicYearId", "fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetSourceAccount_budgetPlanId_fundSourceId_key" ON "BudgetSourceAccount"("budgetPlanId", "fundSourceId");

-- CreateIndex
CREATE INDEX "BudgetSourceEntry_sourceAccountId_entryDate_idx" ON "BudgetSourceEntry"("sourceAccountId", "entryDate");

-- CreateIndex
CREATE INDEX "BudgetWallet_departmentId_idx" ON "BudgetWallet"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetWallet_budgetPlanId_code_key" ON "BudgetWallet"("budgetPlanId", "code");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletId_postedAt_idx" ON "WalletLedgerEntry"("walletId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_walletId_entryType_referenceType_referenc_key" ON "WalletLedgerEntry"("walletId", "entryType", "referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityFundingAllocation_activityId_walletId_key" ON "ActivityFundingAllocation"("activityId", "walletId");

-- CreateIndex
CREATE INDEX "BudgetTransferRequest_budgetPlanId_status_idx" ON "BudgetTransferRequest"("budgetPlanId", "status");

-- CreateIndex
CREATE INDEX "OperatingExpense_budgetPlanId_status_idx" ON "OperatingExpense"("budgetPlanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FundSource_code_key" ON "FundSource"("code");

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_budgetWalletId_fkey" FOREIGN KEY ("budgetWalletId") REFERENCES "BudgetWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSourceAccount" ADD CONSTRAINT "BudgetSourceAccount_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSourceAccount" ADD CONSTRAINT "BudgetSourceAccount_fundSourceId_fkey" FOREIGN KEY ("fundSourceId") REFERENCES "FundSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSourceEntry" ADD CONSTRAINT "BudgetSourceEntry_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "BudgetSourceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSourceEntry" ADD CONSTRAINT "BudgetSourceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetWallet" ADD CONSTRAINT "BudgetWallet_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetWallet" ADD CONSTRAINT "BudgetWallet_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BudgetWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "WalletLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFundingAllocation" ADD CONSTRAINT "ActivityFundingAllocation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProjectActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFundingAllocation" ADD CONSTRAINT "ActivityFundingAllocation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BudgetWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransferRequest" ADD CONSTRAINT "BudgetTransferRequest_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransferRequest" ADD CONSTRAINT "BudgetTransferRequest_fromWalletId_fkey" FOREIGN KEY ("fromWalletId") REFERENCES "BudgetWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransferRequest" ADD CONSTRAINT "BudgetTransferRequest_toWalletId_fkey" FOREIGN KEY ("toWalletId") REFERENCES "BudgetWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransferRequest" ADD CONSTRAINT "BudgetTransferRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransferRequest" ADD CONSTRAINT "BudgetTransferRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BudgetWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMigrationRun" ADD CONSTRAINT "BudgetMigrationRun_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMigrationRun" ADD CONSTRAINT "BudgetMigrationRun_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Normalize the three legacy sources without changing their ids or balances.
UPDATE "FundSource"
SET "code" = CASE
  WHEN "name" IN ('เงินอุดหนุนรายหัว', 'เงินอุดหนุนทั่วไป', 'เงินอุดหนุนการศึกษา') THEN 'GENERAL_SUBSIDY'
  WHEN "name" IN ('เงินกิจกรรมพัฒนาผู้เรียน', 'ค่ากิจกรรมพัฒนาคุณภาพผู้เรียน') THEN 'LEARNER_ACTIVITY'
  WHEN "name" IN ('เงินรายได้สถานศึกษา', 'รายได้สถานศึกษา') THEN 'SCHOOL_INCOME'
  ELSE "code"
END
WHERE "code" IS NULL;

CREATE UNIQUE INDEX "AcademicYear_one_active_idx"
ON "AcademicYear" (("isActive")) WHERE "isActive" = true;

CREATE UNIQUE INDEX "FiscalYear_one_active_idx"
ON "FiscalYear" (("isActive")) WHERE "isActive" = true;

INSERT INTO "FiscalYear" ("id", "yearName", "isActive", "startDate", "endDate", "createdAt", "updatedAt")
VALUES ('fiscal-year-2569', '2569', true, TIMESTAMP '2025-10-01 00:00:00', TIMESTAMP '2026-09-30 23:59:59', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("yearName") DO NOTHING;
