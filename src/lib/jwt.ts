import jwt from "jsonwebtoken";
import { IUser } from "../models/User.model";

/**
 * Generate JWT token for authenticated user
 */
export const generateJWT = (user: IUser): string => {
  const payload = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  return token;
};

/**
 * Verify JWT token
 */
export const verifyJWT = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
