/*
  Warnings:

  - You are about to drop the `UserStreak` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."UserStreak" DROP CONSTRAINT "UserStreak_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- DropTable
DROP TABLE "public"."UserStreak";
