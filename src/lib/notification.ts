import admin from "firebase-admin";
import FirebaseAdmin from "@/config/firebase";

interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

interface NotificationOptions {
  priority?: "high" | "normal";
  timeToLive?: number; // in seconds
  badge?: number;
  sound?: string;
  clickAction?: string;
}

/**
 * Send push notification to a single device
 * @param fcmToken - The FCM token of the device
 * @param payload - Notification content
 * @param options - Additional notification options
 * @returns Message ID if successful
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: NotificationPayload,
  options?: NotificationOptions
): Promise<string> {
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data,
      android: {
        priority: options?.priority || "high",
        ttl: options?.timeToLive ? options.timeToLive * 1000 : 86400000, // 24 hours default
        notification: {
          ...(options?.sound && { sound: options.sound }),
          ...(options?.clickAction && { clickAction: options.clickAction }),
        },
      },
      apns: {
        payload: {
          aps: {
            badge: options?.badge,
            sound: options?.sound || "default",
          },
        },
      },
    };

    const messageId = await FirebaseAdmin.messaging().send(message);
    console.log("Successfully sent notification:", messageId);
    return messageId;
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

/**
 * Send push notification to multiple devices
 * @param fcmTokens - Array of FCM tokens
 * @param payload - Notification content
 * @param options - Additional notification options
 * @returns BatchResponse with success and failure counts
 */
export async function sendBatchPushNotifications(
  fcmTokens: string[],
  payload: NotificationPayload,
  options?: NotificationOptions
): Promise<admin.messaging.BatchResponse> {
  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data,
      android: {
        priority: options?.priority || "high",
        ttl: options?.timeToLive ? options.timeToLive * 1000 : 86400000,
        notification: {
          ...(options?.sound && { sound: options.sound }),
          ...(options?.clickAction && { clickAction: options.clickAction }),
        },
      },
      apns: {
        payload: {
          aps: {
            badge: options?.badge,
            sound: options?.sound || "default",
          },
        },
      },
    };

    const response = await FirebaseAdmin.messaging().sendEachForMulticast(message);
    console.log(
      `Successfully sent ${response.successCount} notifications, ${response.failureCount} failed`
    );

    // Log failed tokens for cleanup
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(fcmTokens[idx]);
          console.error(`Failed to send to token ${fcmTokens[idx]}:`, resp.error);
        }
      });
    }

    return response;
  } catch (error: any) {
    console.error("Error sending batch push notifications:", error);
    throw new Error(`Failed to send batch push notifications: ${error.message}`);
  }
}

/**
 * Send notification to a topic
 * @param topic - The topic name
 * @param payload - Notification content
 * @param options - Additional notification options
 * @returns Message ID if successful
 */
export async function sendTopicNotification(
  topic: string,
  payload: NotificationPayload,
  options?: NotificationOptions
): Promise<string> {
  try {
    const message: admin.messaging.Message = {
      topic: topic,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data,
      android: {
        priority: options?.priority || "high",
        ttl: options?.timeToLive ? options.timeToLive * 1000 : 86400000,
        notification: {
          ...(options?.sound && { sound: options.sound }),
          ...(options?.clickAction && { clickAction: options.clickAction }),
        },
      },
      apns: {
        payload: {
          aps: {
            badge: options?.badge,
            sound: options?.sound || "default",
          },
        },
      },
    };

    const messageId = await FirebaseAdmin.messaging().send(message);
    console.log("Successfully sent topic notification:", messageId);
    return messageId;
  } catch (error: any) {
    console.error("Error sending topic notification:", error);
    throw new Error(`Failed to send topic notification: ${error.message}`);
  }
}

/**
 * Subscribe tokens to a topic
 * @param fcmTokens - Array of FCM tokens
 * @param topic - The topic name
 */
export async function subscribeToTopic(
  fcmTokens: string[],
  topic: string
): Promise<admin.messaging.MessagingTopicManagementResponse> {
  try {
    const response = await FirebaseAdmin.messaging().subscribeToTopic(fcmTokens, topic);
    console.log(`Successfully subscribed ${response.successCount} devices to topic: ${topic}`);
    return response;
  } catch (error: any) {
    console.error("Error subscribing to topic:", error);
    throw new Error(`Failed to subscribe to topic: ${error.message}`);
  }
}

/**
 * Unsubscribe tokens from a topic
 * @param fcmTokens - Array of FCM tokens
 * @param topic - The topic name
 */
export async function unsubscribeFromTopic(
  fcmTokens: string[],
  topic: string
): Promise<admin.messaging.MessagingTopicManagementResponse> {
  try {
    const response = await FirebaseAdmin.messaging().unsubscribeFromTopic(fcmTokens, topic);
    console.log(`Successfully unsubscribed ${response.successCount} devices from topic: ${topic}`);
    return response;
  } catch (error: any) {
    console.error("Error unsubscribing from topic:", error);
    throw new Error(`Failed to unsubscribe from topic: ${error.message}`);
  }
}

/**
 * Validate if an FCM token is still valid
 * @param fcmToken - The FCM token to validate
 * @returns true if valid, false otherwise
 */
export async function validateFcmToken(fcmToken: string): Promise<boolean> {
  try {
    await FirebaseAdmin.messaging().send(
      {
        token: fcmToken,
        data: { test: "validation" },
      },
      true // dry run
    );
    return true;
  } catch (error: any) {
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      return false;
    }
    throw error;
  }
}
