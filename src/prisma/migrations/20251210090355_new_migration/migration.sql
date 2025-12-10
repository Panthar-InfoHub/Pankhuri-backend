/*
  Warnings:

  - A unique constraint covering the columns `[userId,planId]` on the table `UserSubscription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('razorpay', 'google_play');

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "provider" "PaymentGateway" NOT NULL DEFAULT 'razorpay';

-- AlterTable
ALTER TABLE "UserSubscription" ADD COLUMN     "currentPurchaseToken" TEXT,
ADD COLUMN     "linkedPurchaseTokens" JSONB,
ADD COLUMN     "provider" "PaymentGateway" NOT NULL DEFAULT 'razorpay';

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_planId_key" ON "UserSubscription"("userId", "planId");
