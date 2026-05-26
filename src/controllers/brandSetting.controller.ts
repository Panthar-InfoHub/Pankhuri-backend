import { Request, Response, NextFunction } from "express";
import * as brandSettingService from "@/services/brandSetting.service";

/**
 * Get brand settings
 * GET /api/brand-settings
 */
export const getBrandSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const settings = await brandSettingService.getBrandSettings();
    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update brand settings (Admin only)
 * PATCH /api/brand-settings
 */
export const updateBrandSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { globalWhatsappLink, announcements } = req.body;
    
    const settings = await brandSettingService.updateBrandSettings({
      globalWhatsappLink,
      announcements,
    });

    return res.status(200).json({
      success: true,
      message: "Brand settings updated successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};
