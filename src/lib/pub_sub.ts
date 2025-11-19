import { PubSub } from "@google-cloud/pubsub";

const pubSubClient = new PubSub();

export const publishMessage = async (filePath: string , quality : number) => {
    try {

        const topicName = process.env.PUBSUB_TOPIC_NAME || "video-transcoding-jobs-asia-001";
        const messageData = JSON.stringify({
            filePath,
            quality: "1080p"
        });

        const dataBuffer = Buffer.from(messageData);

        const messageId = await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
        console.log(`Message ${messageId} published to topic ${topicName}.`);

        return { success: true, messageId };

    } catch (error) {
        console.error(`Failed to publish message: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}