import { prisma } from "../lib/db";
import { formatPhoneNumber, sendOtpSMS } from "./sms.service";

const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a random 6-digit OTP
 */
const generate6DigitOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Request an OTP for a phone number
 * Handles phone formatting, database upsert (1 row per phone), and MSG91 sending
 */
export const requestPhoneOtp = async (phoneNumber: string) => {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const otp = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Upsert logic: Reuse row if exists, otherwise create
    await prisma.otp.upsert({
        where: { phoneNumber: formattedPhone },
        update: {
            otpCode: otp,
            expiresAt: expiresAt,
            
        },
        create: {
            phoneNumber: formattedPhone,
            otpCode: otp,
            expiresAt: expiresAt,
        },
    });

    // Trigger SMS sending
    const sent = await sendOtpSMS(formattedPhone, otp);

    if (!sent) {
        // We don't throw here to allow fallback or logging, but the controller should handle result
        return { success: false, error: "SMS gateway failed" };
    }

    return { success: true, message: "OTP sent successfully" };
};

/**
 * Verify OTP for a phone number
 */
export const verifyPhoneOtp = async (phoneNumber: string, otpCode: string): Promise<boolean> => {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const otpRecord = await prisma.otp.findUnique({
        where: { phoneNumber: formattedPhone },
    });

    if (!otpRecord) {
        throw new Error("No OTP requested for this phone number");
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
        throw new Error("OTP has expired. Please request a new one.");
    }

    // Check code match
    if (otpRecord.otpCode !== otpCode) {
        throw new Error("Invalid OTP code");
    }

    // To prevent replay attacks, we "invalidate" the OTP after successful verification
    // Since user wants to keep the row, we'll just set the expiry to the past
    await prisma.otp.update({
        where: { phoneNumber: formattedPhone },
        data: {
            expiresAt: new Date(0), // Set to epoch to mark as expired/used
        },
    });

    return true;
};
