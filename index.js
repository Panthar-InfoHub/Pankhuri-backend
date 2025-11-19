import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import { spawn } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());


const s3Client = new S3Client({
    endpoint: `https://blr1.digitaloceanspaces.com`,
    region: "blr1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});

const OUTPUT_BUCKET = process.env.DO_PROCESSED_BUCKET;
const BACKEND_API_URL = process.env.BACKEND_API_URL; // Your main backend's update endpoint
const BACKEND_API_KEY = process.env.BACKEND_API_KEY; // A secret key to secure your backend endpoint

/**
 * This endpoint receives the event from Eventarc of Google cloud.
 * It expects a JSON body like: { "bucket": "my-raw-videos", "filename": "new-video.mp4" }
 */
app.post('/transcode', async (req, res) => {
    console.log('Received a dispatch request.');


    const message = req.body.message;
    console.log('Eventarc message received:', message);
    if (!message) {
        console.error('Invalid Eventarc request:', req.body);
        return res.status(400).send('Bad Request: Invalid message format.');
    }

    const payload = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
    const { filename, quality } = payload;

    if (!filename || !quality) {
        return res.status(400).send('Bad Request: Missing filename or quality.');
    }

    console.log(`Processing for transcode: ${filename} at ${quality}p`);
    const tempDir = `/tmp/${path.parse(filename).name}-${Date.now()}`;

    try {
        await fs.mkdir(tempDir, { recursive: true });

        const hlsPath = await processVideo(OUTPUT_BUCKET, filename, quality, tempDir); //Transcode video and get manifest URL

        await updateBackend(filename, hlsPath); //Update main backend with manifest URL

        res.status(200).send(`Successfully processed ${filename}`);

    } catch (error) {
        console.error(`[JOB_FAILED] for ${filename}:`, error.message);
        res.status(500).send('Job processing failed.');
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    }
});


//Health check endpoint
app.get('/health', (req, res) => {
    console.log("\n Transoding service is running...")
    res.status(200).send('Transcoding service is running...');
})

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    console.log(`Transcoding service listening on port ${PORT}`);
});

const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(async () => {
        console.log("HTTP server closed");
        process.exit(0);
    });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));




async function processVideo(bucket, filename, quality, tempDir) {
    const localInputPath = path.join(tempDir, filename);
    const outputDir = path.join(tempDir, 'transcoded');
    console.log(`\nInput dir ==> ${localInputPath}`);
    console.log(`Output dir ==> ${outputDir}\n`);

    await fs.mkdir(outputDir);
    await fs.mkdir(path.dirname(localInputPath), { recursive: true });

    // Download the video from DigitalOcean
    console.log(`Downloading s3://${bucket}/${filename}...`);
    const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: filename }));
    await fs.writeFile(localInputPath, Body);
    console.log('Download complete....');

    // Define transcoding profiles
    const profiles = [
        { resolution: '640x360', bitrate: '800k', quality: 360 },
        { resolution: '854x480', bitrate: '1400k', quality: 480 },
        { resolution: '1280x720', bitrate: '2800k', quality: 720 },
        { resolution: '1920x1080', bitrate: '5000k', quality: 1080 },
    ];

    const qualitiesToTranscode = profiles.filter(p => p.quality <= quality);
    if (qualitiesToTranscode.length === 0) {
        throw new Error(`No suitable transcoding profiles for source quality ${quality}p`);
    }

    // Build the FFmpeg command
    const ffmpegArgs = ['-i', localInputPath];
    let streamMap = '';
    const masterPlaylistEntries = [];

    let index = 0;
    for (const profile of qualitiesToTranscode) {
        // qualitiesToTranscode.forEach((profile, index) => {
        const outputSubDir = path.join(outputDir, `${profile.quality}p`);
        await fs.mkdir(outputSubDir);
        ffmpegArgs.push(
            '-map', '0:v:0', '-map', '0:a:0',
            `-vf`, `scale=${profile.resolution}`,
            `-c:a`, 'aac', '-ar', '48000', '-b:a', '128k',
            `-c:v`, 'libx264', '-profile:v', 'main', '-crf', '20', '-preset', 'medium',
            `-b:v`, profile.bitrate, `-maxrate`, profile.bitrate, `-bufsize`, `${parseInt(profile.bitrate) * 2}k`,
            '-f', 'hls',
            '-hls_time', '4',
            '-hls_playlist_type', 'vod',
            '-hls_segment_filename', `${outputSubDir}/segment%03d.ts`,
            // '-hls_header_url', `/${outputSubDir}/playlist.m3u8`
            `${outputSubDir}/playlist.m3u8` // Output file path
        );
        streamMap += `v:${index},a:${index} `;
        masterPlaylistEntries.push(`#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(profile.bitrate) * 1000},RESOLUTION=${profile.resolution}\n${profile.quality}p/playlist.m3u8`);
        index++;
    }

    // Creating master playlist file
    const masterPlaylistContent = `#EXTM3U\n#EXT-X-VERSION:3\n${masterPlaylistEntries.join('\n')}`;
    await fs.writeFile(path.join(outputDir, 'master.m3u8'), masterPlaylistContent);
    ffmpegArgs.push('-var_stream_map', streamMap.trim());

    // Run FFmpeg
    console.log(`Executing FFmpeg for qualities: ${qualitiesToTranscode.map(q => q.quality).join(', ')}p`);
    await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        ffmpeg.stdout.on('data', (data) => console.log(`ffmpeg: ${data}`));
        ffmpeg.stderr.on('data', (data) => console.error(`ffmpeg-err: ${data}`));
        ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });

    // Upload all generated files to DigitalOcean
    console.log('Uploading transcoded files to DigitalOcean...');
    const uploadDir = `transcoded/${path.parse(filename).name}`;
    async function uploadRecursive(dir) {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
                // Recursively process subdirectories
                await uploadRecursive(fullPath);
            } else {
                // Upload only if it's a file
                const relativePath = path.relative(outputDir, fullPath);
                const uploadKey = path.join(uploadDir, relativePath).split(path.sep).join('/');

                console.log(`Uploading: ${uploadKey}`);
                const uploader = new Upload({
                    client: s3Client,
                    params: {
                        Bucket: OUTPUT_BUCKET,
                        Key: uploadKey,
                        Body: createReadStream(fullPath),
                    },
                });
                await uploader.done();
            }
        }
    }

    await uploadRecursive(outputDir);
    console.log('Uploading complete....');

    // Clean up the original raw video file
    // await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: filename }));
    // console.log(`Deleted original file: s3://${bucket}/${filename}`);

    return `/${uploadDir}/master.m3u8`;
}

async function updateBackend(originalFilename, hlsPath) {
    console.log(`Updating backend for ${originalFilename}... to HLS path: ${hlsPath}`);
    try {
        await axios.post(BACKEND_API_URL,
            {
                playbackUrl: hlsPath,
                status: 'ready'
            },
            {
                headers: { 'Authorization': `Bearer ${BACKEND_API_KEY}` }
            }
        );
        console.log('Backend update successful.');
    } catch (error) {
        console.error('FATAL: Failed to update backend!', error.message);
        throw new Error('Could not update the backend application.');
    }
}
