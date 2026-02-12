-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "externalUrl" TEXT,
ALTER COLUMN "storageKey" DROP NOT NULL;
