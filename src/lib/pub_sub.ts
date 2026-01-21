import { PubSub } from "@google-cloud/pubsub";
import { GoogleAuth } from "google-auth-library";

const pubSubClient = new PubSub({
    projectId: process.env.GOOGLE_CLOUD_PROJECT
});

export const publishMessage = async (filePath: string, quality: number, videoId: string) => {
    try {

        const topicName = process.env.PUBSUB_TOPIC_NAME || "video-transcoding-jobs-asia-001";
        const messageData = JSON.stringify({
            filePath,
            quality,
            videoId
        });

        const dataBuffer = Buffer.from(messageData);

        const messageId = await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
        console.log(`Message ${messageId} published to topic ${topicName}.`);

        return { success: true, messageId };

    } catch (error) {
        console.error(`Failed to publish message: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
};

export const google_auth = new GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});