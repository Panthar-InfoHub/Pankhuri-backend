/**
 * SMS Service for MSG91 Integration
 */

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY!;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID!;
const MSG91_BASE_URL = "https://control.msg91.com/api/v5/flow";

/**
 * Format phone number to include country code if missing
 * Defaults to 91 (India) if 10 digits
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, "");

    // If 10 digits, assume India and add 91
    if (cleaned.length === 10) {
        return `91${cleaned}`;
    }

    // Otherwise return as is (assuming country code is already present)
    return cleaned;
};

/**
 * Send OTP via MSG91
 */
export const sendOtpSMS = async (phoneNumber: string, otp: string): Promise<boolean> => {
    try {
        const formattedPhone = formatPhoneNumber(phoneNumber);

        const payload = {
            template_id: MSG91_TEMPLATE_ID,
            recipients: [
                {
                    mobiles: formattedPhone,
                    VAR1: otp, // Assuming VAR1 is the placeholder for OTP in the MSG91 template
                },
            ],
        };

        const response = await fetch(MSG91_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "authkey": MSG91_AUTH_KEY,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log(`[SMS] OTP sent to ${formattedPhone}:`, result);

        return response.ok;
    } catch (error) {
        console.error("[SMS] Error sending MSG91 OTP:", error);
        return false;
    }
};
