import { prisma } from "@/lib/db";

/**
 * Get the current brand settings
 * If no settings exist, it creates a default one
 */
export const getBrandSettings = async () => {
  let settings = await prisma.brandSetting.findUnique({
    where: { id: "active_settings" },
  });

  if (!settings) {
    // Create default settings if not exists
    settings = await prisma.brandSetting.create({
      data: {
        id: "active_settings",
        globalWhatsappLink: null,
        announcements: [],
      },
    });
  }

  return settings;
};

/**
 * Update brand settings
 */
export const updateBrandSettings = async (data: {
  globalWhatsappLink?: string | null;
  announcements?: any[];
}) => {
  return await prisma.brandSetting.upsert({
    where: { id: "active_settings" },
    update: {
      ...(data.globalWhatsappLink !== undefined && { globalWhatsappLink: data.globalWhatsappLink }),
      ...(data.announcements !== undefined && { announcements: data.announcements }),
      updatedAt: new Date(),
    },
    create: {
      id: "active_settings",
      globalWhatsappLink: data.globalWhatsappLink ?? null,
      announcements: data.announcements ?? [],
    },
  });
};
