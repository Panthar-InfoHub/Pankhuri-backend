-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "trainerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';
