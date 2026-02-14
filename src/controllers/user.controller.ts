import { Request, Response, NextFunction } from "express";
import * as userService from "../services/user.service";
import * as trainerService from "../services/trainer.service";
import { UserRole, UserStatus, Gender, TrainerStatus } from "@/prisma/generated/prisma/client";

// ==================== PUBLIC USER ENDPOINTS ====================

// GET /api/users/me - Get current user profile
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await userService.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/me - Update current user profile
export const updateCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { displayName, profileImage, dateOfBirth, gender, countryCode, languagePreference, profession, metadata } =
      req.body;

    // Users can only update their own profile fields
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dateOfBirth);
    if (gender !== undefined) updateData.gender = gender;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (languagePreference !== undefined) updateData.languagePreference = languagePreference;
    if (profession !== undefined) updateData.profession = profession;
    if (metadata !== undefined) updateData.metadata = metadata;

    const user = await userService.updateUser(req.user.id, updateData);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/me - Close own account (Soft Delete)
 * Complies with Google Play policy for user-initiated account deletion
 */
export const deleteMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const result = await userService.deleteUser(req.user.id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== PUBLIC TRAINER ENDPOINTS ====================

// GET /api/trainers - Get all trainers (public view)
export const getAllTrainersPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, page, limit } = req.query;

    const result = await trainerService.getAllTrainers({
      status: TrainerStatus.active, // Only show active trainers publicly
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/trainers/:id - Get trainer by ID (public view)
export const getTrainerByIdPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const trainer = await trainerService.getTrainerById(id);

    if (!trainer || trainer.status !== TrainerStatus.active) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found",
      });
    }

    res.json({
      success: true,
      data: trainer,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN USER MANAGEMENT ====================

// GET /api/admin/users - Get all users with filters
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, status, search, page, limit } = req.query;

    const result = await userService.getAllUsers({
      role: role as UserRole | undefined,
      status: status as UserStatus | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users/:id - Get user by ID
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/users - Create user
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email,
      phone,
      displayName,
      profileImage,
      dateOfBirth,
      gender,
      countryCode,
      role,
      status,
    } = req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone is required",
      });
    }

    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role is required",
      });
    }

    const user = await userService.createUserAdmin({
      email,
      phone,
      displayName,
      profileImage,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      countryCode,
      role,
      status,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/users/:id - Update user
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      email,
      phone,
      displayName,
      profileImage,
      dateOfBirth,
      gender,
      countryCode,
      languagePreference,
      role,
      status,
      hasUsedTrial,
    } = req.body;

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dateOfBirth);
    if (gender !== undefined) updateData.gender = gender;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (languagePreference !== undefined) updateData.languagePreference = languagePreference;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (hasUsedTrial !== undefined) updateData.hasUsedTrial = hasUsedTrial;

    const user = await userService.updateUserAdmin(id, updateData);

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/users/:id - Delete user
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await userService.deleteUser(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/users/:id/status - Update user status
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(UserStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active", "inactive", or "suspended"',
      });
    }

    const user = await userService.updateUserStatus(id, status as UserStatus);

    res.json({
      success: true,
      message: "User status updated",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/users/:id/role - Update user role
export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "user", "admin", or "moderator"',
      });
    }

    const user = await userService.updateUserRole(id, role as UserRole);

    res.json({
      success: true,
      message: "User role updated",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN TRAINER MANAGEMENT ====================

// GET /api/admin/trainers - Get all trainers
export const getAllTrainers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, page, limit } = req.query;

    const result = await trainerService.getAllTrainers({
      status: status as TrainerStatus | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/trainers/:id - Get trainer by ID
export const getTrainerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const trainer = await trainerService.getTrainerById(id);

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found",
      });
    }

    res.json({
      success: true,
      data: trainer,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/trainers - Create trainer profile
export const createTrainerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, bio, specialization, experience, socialLinks } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const trainer = await trainerService.createTrainerProfile({
      userId,
      bio,
      specialization,
      experience,
      socialLinks,
    });

    res.status(201).json({
      success: true,
      message: "Trainer profile created successfully",
      data: trainer,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/trainers/:id - Update trainer profile
export const updateTrainerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { bio, specialization, experience, socialLinks, status } = req.body;

    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (specialization !== undefined) updateData.specialization = specialization;
    if (experience !== undefined) updateData.experience = experience;
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
    if (status !== undefined) updateData.status = status;

    const trainer = await trainerService.updateTrainerProfile(id, updateData);

    res.json({
      success: true,
      message: "Trainer profile updated successfully",
      data: trainer,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/trainers/:id - Delete trainer profile
export const deleteTrainerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await trainerService.deleteTrainerProfile(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
