import { User, UserRole, UserStatus, Prisma, Gender } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// Helper function to extract country code from phone number
const extractCountryCode = (phoneNumber: string): string | undefined => {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Common country codes (you can expand this list)
  const countryCodes: { [key: string]: string } = {
    "1": "US/CA", // US/Canada
    "91": "IN", // India
    "44": "GB", // UK
    "61": "AU", // Australia
    "81": "JP", // Japan
    "86": "CN", // China
    "49": "DE", // Germany
    "33": "FR", // France
    "39": "IT", // Italy
    "7": "RU", // Russia
    "82": "KR", // South Korea
    "65": "SG", // Singapore
    "60": "MY", // Malaysia
    "62": "ID", // Indonesia
    "63": "PH", // Philippines
    "66": "TH", // Thailand
    "84": "VN", // Vietnam
    "52": "MX", // Mexico
    "55": "BR", // Brazil
    "34": "ES", // Spain
    "351": "PT", // Portugal
    "27": "ZA", // South Africa
    "971": "AE", // UAE
    "966": "SA", // Saudi Arabia
    "20": "EG", // Egypt
  };

  // Try to match country codes (longest first)
  for (const code of Object.keys(countryCodes).sort((a, b) => b.length - a.length)) {
    if (cleaned.startsWith(code)) {
      return countryCodes[code];
    }
  }

  return undefined;
};

// ==================== BASIC USER OPERATIONS ====================

export const findUserByPhone = async (phone: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { phone },
  });
};

export const findAdminByEmail = async (email: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { email, role: UserRole.admin },
  });
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const createUser = async (userData: Prisma.UserCreateInput) => {
  // Validate that user has at least email OR phone
  if (!userData.email && !userData.phone) {
    throw new Error("User must have either an email or phone number");
  }

  // Check for duplicate email
  if (userData.email) {
    const existingEmail = await findUserByEmail(userData.email);
    if (existingEmail) {
      throw new Error("User with this email already exists");
    }
  }

  // Check for duplicate phone
  if (userData.phone) {
    const existingPhone = await findUserByPhone(userData.phone);
    if (existingPhone) {
      throw new Error("User with this phone number already exists");
    }
  }

  return await prisma.user.create({
    data: {
      email: userData.email,
      phone: userData.phone,
      displayName: userData.displayName,
      profileImage: userData.profileImage,
      dateOfBirth: userData.dateOfBirth,
      gender: userData.gender,
      countryCode: userData.countryCode,
      languagePreference: userData.languagePreference,
      isEmailVerified: userData.isEmailVerified ?? false,
      isPhoneVerified: userData.isPhoneVerified ?? false,
      fcmTokens: userData.fcmTokens ?? [],
      status: userData.status ?? UserStatus.active,
      role: userData.role ?? UserRole.user,
      hasUsedTrial: userData.hasUsedTrial ?? false,
    },
  });
};

export const updateUser = async (
  userId: string,
  updates: Prisma.UserUpdateInput
): Promise<User | null> => {
  // Check for duplicate email (if updating email)
  if (updates.email && typeof updates.email === "string") {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: updates.email,
        NOT: { id: userId },
      },
    });
    if (existingEmail) {
      throw new Error("Email already exists");
    }
  }

  // Check for duplicate phone (if updating phone)
  if (updates.phone && typeof updates.phone === "string") {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phone: updates.phone,
        NOT: { id: userId },
      },
    });
    if (existingPhone) {
      throw new Error("Phone number already exists");
    }
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updates,
  });
};

// ==================== ADMIN USER MANAGEMENT ====================

// Get all users with filtering and pagination
export const getAllUsers = async (filters?: {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { role, status, search, page = 1, limit = 50 } = filters || {};

  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { displayName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        trainerProfile: true,
        _count: {
          select: {
            trainedCourses: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get user by ID with full details
export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      trainerProfile: true,
      trainedCourses: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
          rating: true,
          status: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      _count: {
        select: {
          trainedCourses: true,
        },
      },
    },
  });

  return user;
};

// Create user (Admin)
export const createUserAdmin = async (data: {
  email?: string;
  phone?: string;
  displayName?: string;
  profileImage?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  countryCode?: string;
  role: UserRole;
  status?: UserStatus;
}) => {
  if (!data.email && !data.phone) {
    throw new Error("Email or phone is required");
  }

  // Check for existing user
  if (data.email) {
    const existing = await findUserByEmail(data.email);
    if (existing) {
      throw new Error("User with this email already exists");
    }
  }

  if (data.phone) {
    const existing = await findUserByPhone(data.phone);
    if (existing) {
      throw new Error("User with this phone already exists");
    }
  }

  return await createUser(data);
};

// Update user (Admin)
export const updateUserAdmin = async (id: string, data: Partial<User>) => {
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new Error("User not found");
  }

  // If updating email, check uniqueness
  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id },
      },
    });
    if (existing) {
      throw new Error("User with this email already exists");
    }
  }

  // If updating phone, check uniqueness
  if (data.phone && data.phone !== user.phone) {
    const existing = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        NOT: { id },
      },
    });
    if (existing) {
      throw new Error("User with this phone already exists");
    }
  }

  return await updateUser(id, data);
};

// Delete user (Admin) - soft delete by setting status to inactive
export const deleteUser = async (id: string) => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          trainedCourses: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Don't allow deletion of users with active courses (as trainer)
  if (user._count.trainedCourses > 0) {
    // Soft delete - just deactivate
    await prisma.user.update({
      where: { id },
      data: { status: UserStatus.suspended },
    });
    return { message: "User deactivated (has courses as trainer)" };
  }

  // Can safely delete regular users
  await prisma.user.delete({
    where: { id },
  });

  return { message: "User deleted successfully" };
};

// Update user status
export const updateUserStatus = async (id: string, status: UserStatus) => {
  return await prisma.user.update({
    where: { id },
    data: { status },
  });
};

// Update user role
export const updateUserRole = async (id: string, role: UserRole) => {
  return await prisma.user.update({
    where: { id },
    data: { role },
  });
};

// ==================== AUTH HELPERS ====================

export const findOrCreateUserByPhone = async (phone: string): Promise<User> => {
  // Try to find by phone first
  let user = await findUserByPhone(phone);

  if (user) {
    // Update verification status
    if (!user.isPhoneVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          isPhoneVerified: true,
        },
      });
    }
    return user;
  }

  // Auto-extract country code from phone number
  const autoCountryCode = extractCountryCode(phone);

  // Create new user with phone
  user = await createUser({
    phone,
    countryCode: autoCountryCode,
    isPhoneVerified: true,
    status: UserStatus.active,
    role: UserRole.user,
  });

  return user;
};

export const findOrCreateUserByEmail = async (
  email: string,
  displayName?: string,
  profileImage?: string
): Promise<User> => {
  // Try to find by email first
  let user = await findUserByEmail(email);

  if (user) {
    // Update user info if provided
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: displayName || user.displayName,
        profileImage: profileImage || user.profileImage,
        isEmailVerified: true,
      },
    });
    return user;
  }

  // Create new user
  user = await createUser({
    email,
    displayName,
    profileImage,
    isEmailVerified: true,
    status: UserStatus.active,
    role: UserRole.user,
  });

  return user;
};
