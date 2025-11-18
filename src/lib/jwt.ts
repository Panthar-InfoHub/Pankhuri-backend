import { User } from "@/prisma/generated/prisma/client";
import jwt from "jsonwebtoken";

export const generateJWT = (user: User): string => {
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

export const verifyJWT = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};