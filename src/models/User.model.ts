import { User, Gender, UserStatus, UserRole } from "@prisma/client";

// Export Prisma types for use in other files
export type IUser = User;
export { Gender, UserStatus, UserRole };
