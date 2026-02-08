import { CloudSchedulerClient } from "@google-cloud/scheduler";

export const schedulerClient = new CloudSchedulerClient({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    fallback: true, // Use HTTP/1.1 REST instead of gRPC to avoid "sync mutate calls" issues
});
