const { JobsClient } = require('@google-cloud/run').v2;
const client = new JobsClient();

exports.triggerTranscode = async (event) => {
    try {
        const pubsubData = event.data ? Buffer.from(event.data, 'base64').toString() : null;
        const payload = JSON.parse(pubsubData);

        const project = process.env.GCP_PROJECT_ID;
        const location = 'asia-south1';
        const jobId = 'transcode-job-spot';

        const request = {
            name: `projects/${project}/locations/${location}/jobs/${jobId}`,
            overrides: {
                containerOverrides: [
                    {
                        env: [
                            { name: 'INPUT_VIDEO_PATH', value: payload.filePath },
                            { name: 'INPUT_QUALITY', value: payload.quality.toString() },
                            { name: 'INPUT_VIDEO_ID', value: payload.videoId }
                        ]
                    }
                ]
            }
        };

        const [operation] = await client.runJob(request);
        console.log(`Execution started: ${operation.name}`);
    } catch (err) {
        console.error('Dispatcher Error:', err);
    }
};