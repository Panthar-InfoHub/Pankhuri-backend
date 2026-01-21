
export const registerUser = async (name: string, phone: string) => {
    try {

        const response = await fetch("https://api.interakt.ai/v1/public/track/users/", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${process.env.INTERAKT_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                countryCode: "+91",
                phoneNumber: phone,
                traits: {
                    name,
                },
            }),
        });

        const responseText = await response.text();
        console.debug("User registration response:", responseText);

        return { success: true, message: "User registred on Interakt dashboard" };

    } catch (error: any) {
        console.error("Error while registering user on interakt ==> ", error)
        return { success: false, message: `Error while User registration on Interakt dashboard ==> ${error.message}` };
    }

}


export const sendMessage = async ({ phoneNo = "", name, course, date, publicUrl }: any) => {

    try {

        const messagePayload = {
            countryCode: "91",
            phoneNumber: phoneNo,
            type: "Template",
            template: {
                name: "certificate_message_",
                languageCode: "en",
                headerValues: [publicUrl],
                bodyValues: [name, course, date], // Template variables
            }
        };

        const interaktRes = await fetch("https://api.interakt.ai/v1/public/message/", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${process.env.INTERAKT_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(messagePayload),
        });

        const rawText = await interaktRes.text(); // 
        console.debug("Raw Interakt Response:", rawText);

        let interaktResponseJson;
        try {
            interaktResponseJson = JSON.parse(rawText);
            console.debug("Interakt json response =>", interaktResponseJson);
        } catch (err: any) {
            return {
                success: false,
                message: "Failed to parse response from Interakt",
                responseText: rawText,
                error: err.message,
            };
        }


        if (!interaktRes.ok) {
            return {
                success: false,
                message: "Certificate uploaded but failed to send WhatsApp message.",
                error: interaktResponseJson,
            }
        }

        return { success: true, message: "Message is queued to send..." }

    } catch (error) {
        console.error("Error while sending message ==> ", error)
        return { success: false, error, message: "Error while sending message..." }
    }
}

// export const generateCertificateNumber = (userId: string, courseId: string): string => {}