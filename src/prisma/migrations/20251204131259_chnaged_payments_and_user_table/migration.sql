/*
  Warnings:

  - You are about to drop the column `billingInterval` on the `SubscriptionPlan` table. All the data in the column will be lost.
  - You are about to drop the column `isPaidTrial` on the `SubscriptionPlan` table. All the data in the column will be lost.
  - Made the column `trialDays` on table `SubscriptionPlan` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trialFee` on table `SubscriptionPlan` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "SubscriptionPlan" DROP COLUMN "billingInterval",
DROP COLUMN "isPaidTrial",
ALTER COLUMN "subscriptionType" SET DEFAULT 'yearly',
ALTER COLUMN "trialDays" SET NOT NULL,
ALTER COLUMN "trialDays" SET DEFAULT 0,
ALTER COLUMN "trialFee" SET NOT NULL,
ALTER COLUMN "trialFee" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "profession" TEXT;

-- DropEnum
DROP TYPE "BillingInterval";
