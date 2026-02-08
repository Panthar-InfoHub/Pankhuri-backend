-- AlterEnum
ALTER TYPE "LessonStatus" ADD VALUE 'scheduled';

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';
