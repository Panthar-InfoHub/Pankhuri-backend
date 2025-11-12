import { IUser, UserStatus, UserRole } from "../models/User.model";
import { prisma } from "../lib/db";

export const findUserByPhone = async (phone: string): Promise<IUser | null> => {
  return await prisma.user.findUnique({
    where: { phone },
  });
};

export const findUserByEmail = async (email: string): Promise<IUser | null> => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const createUser = async (userData: Partial<IUser>): Promise<IUser> => {
  // Validate that user has at least email OR phone
  if (!userData.email && !userData.phone) {
    throw new Error("User must have either an email or phone number");
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
      googleId: userData.googleId,
    },
  });
};

export const updateUser = async (
  userId: string,
  updates: Partial<IUser>
): Promise<IUser | null> => {
  return await prisma.user.update({
    where: { id: userId },
    data: updates,
  });
};

export const findOrCreateUserByPhone = async (
  phone: string,
  countryCode?: string
): Promise<IUser> => {
  let user = await findUserByPhone(phone);

  if (user) {
    // // Update last login or other info if needed
    // user = await updateUser(user.id, { isPhoneVerified: true });
    return user;
  }

  // Create new user with phone
  user = await createUser({
    phone,
    countryCode,
    isPhoneVerified: true,
    status: UserStatus.active,
    role: UserRole.user,
  });

  return user;
};

export const findOrCreateUserByEmail = async (
  email: string,
  googleId: string,
  displayName?: string,
  profileImage?: string
): Promise<IUser> => {
  // Try to find by email first
  let user = await findUserByEmail(email);

  if (user) {
    // Link Google account to existing user if not already linked
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId,
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
    googleId,
    displayName,
    profileImage,
    isEmailVerified: true,
    status: UserStatus.active,
    role: UserRole.user,
  });

  return user;
};

