-- CreateEnum
CREATE TYPE "public"."SubscriptionType" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "public"."BillingInterval" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('pending', 'trial', 'active', 'past_due', 'cancelled', 'halted', 'expired');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('trial', 'recurring', 'one_time');

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- CreateTable
CREATE TABLE "public"."SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "subscriptionType" "public"."SubscriptionType" NOT NULL,
    "duration" INTEGER,
    "price" INTEGER NOT NULL,
    "discountedPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "planId" TEXT,
    "billingInterval" "public"."BillingInterval" NOT NULL,
    "trialDays" INTEGER,
    "isPaidTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialFee" INTEGER,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextBillingAt" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userSubscriptionId" TEXT,
    "invoiceId" TEXT,
    "gatewaySubscriptionId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "transactionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentGateway" TEXT NOT NULL DEFAULT 'razorpay',
    "paymentMethod" TEXT,
    "paymentType" "public"."PaymentType" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "eventType" TEXT,
    "isWebhookProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "public"."SubscriptionPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_planId_key" ON "public"."SubscriptionPlan"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_subscriptionId_key" ON "public"."UserSubscription"("subscriptionId");

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_demoVideoId_fkey" FOREIGN KEY ("demoVideoId") REFERENCES "public"."Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSubscription" ADD CONSTRAINT "UserSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "public"."UserSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
