-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('WHOLE_APP', 'CATEGORY', 'COURSE');

-- CreateEnum
CREATE TYPE "public"."EntitlementStatus" AS ENUM ('active', 'revoked', 'expired');

-- AlterEnum
ALTER TYPE "public"."SubscriptionType" ADD VALUE 'lifetime';

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_planId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserSubscription" DROP CONSTRAINT "UserSubscription_planId_fkey";

-- AlterTable
ALTER TABLE "public"."Payment" ALTER COLUMN "planId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "public"."SubscriptionPlan" ADD COLUMN     "planType" "public"."PlanType" NOT NULL DEFAULT 'WHOLE_APP',
ADD COLUMN     "targetId" TEXT;

-- AlterTable
ALTER TABLE "public"."UserSubscription" ALTER COLUMN "planId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."UserEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."PlanType" NOT NULL,
    "targetId" TEXT,
    "status" "public"."EntitlementStatus" NOT NULL DEFAULT 'active',
    "source" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEntitlement_userId_idx" ON "public"."UserEntitlement"("userId");

-- CreateIndex
CREATE INDEX "UserEntitlement_userId_status_idx" ON "public"."UserEntitlement"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_userId_type_targetId_key" ON "public"."UserEntitlement"("userId", "type", "targetId");

-- AddForeignKey
ALTER TABLE "public"."UserSubscription" ADD CONSTRAINT "UserSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
