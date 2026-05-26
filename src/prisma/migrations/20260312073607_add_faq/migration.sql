-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "whatsappCommunityLink" TEXT;

-- CreateTable
CREATE TABLE "BrandSetting" (
    "id" TEXT NOT NULL DEFAULT 'active_settings',
    "globalWhatsappLink" TEXT,
    "announcements" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faq_courseId_idx" ON "Faq"("courseId");

-- CreateIndex
CREATE INDEX "Faq_order_idx" ON "Faq"("order");

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
