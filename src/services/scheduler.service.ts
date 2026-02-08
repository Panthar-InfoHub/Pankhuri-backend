import { schedulerClient } from "@/config/scheduler";
import { google } from "@google-cloud/scheduler/build/protos/protos";

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || "asia-south1";
const backendUrl = process.env.BACKEND_URL;

/**
 * Create or Update a Google Cloud Scheduler job for a lesson
 */
export const scheduleLessonPublish = async (lessonId: string, scheduledDate: Date) => {
    try {
        if (!projectId || !backendUrl) {
            console.error("[SCHEDULER] Missing required environment variables (GOOGLE_CLOUD_PROJECT or BACKEND_URL)");
            return;
        }

        const parent = schedulerClient.locationPath(projectId, location);
        const jobName = `projects/${projectId}/locations/${location}/jobs/lesson-publish-${lessonId}`;
        const targetUrl = `${backendUrl}/api/lessons/${lessonId}/publish`;

        // GCP Scheduler expects a Cron string. Since we want an exact date, 
        // we convert the Date object into a one-time cron: "min hour day month *"
        const minutes = scheduledDate.getUTCMinutes();
        const hours = scheduledDate.getUTCHours();
        const day = scheduledDate.getUTCDate();
        const month = scheduledDate.getUTCMonth() + 1; // getUTCMonth is 0-indexed

        const schedule = `${minutes} ${hours} ${day} ${month} *`;

        const job: google.cloud.scheduler.v1.IJob = {
            name: jobName,
            httpTarget: {
                uri: targetUrl,
                httpMethod: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-scheduler-token": process.env.SCHEDULER_SECRET || "default_secret"
                },
            },
            schedule: schedule,
            timeZone: "UTC",
        };

        try {
            // Check if job exists
            await schedulerClient.getJob({ name: jobName });
            // If it exists, update it
            await schedulerClient.updateJob({ job });
            console.log(`[SCHEDULER] Updated job: ${jobName} for ${schedule}`);
        } catch (error: any) {
            if (error.code === 5) { // NOT_FOUND
                // If it doesn't exist, create it
                await schedulerClient.createJob({ parent, job });
                console.log(`[SCHEDULER] Created job: ${jobName} for ${schedule}`);
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        console.error(`[SCHEDULER] Failed to schedule lesson ${lessonId}:`, error.message);
    }
};

/**
 * Delete a Google Cloud Scheduler job
 */
export const deleteScheduledLessonJob = async (lessonId: string) => {
    try {
        if (!projectId) return;
        const jobName = `projects/${projectId}/locations/${location}/jobs/lesson-publish-${lessonId}`;

        await schedulerClient.deleteJob({ name: jobName });
        console.log(`[SCHEDULER] Deleted job: ${jobName}`);
    } catch (error: any) {
        if (error.code !== 5) { // Skip if already deleted
            console.error(`[SCHEDULER] Failed to delete job for lesson ${lessonId}:`, error.message);
        }
    }
};
