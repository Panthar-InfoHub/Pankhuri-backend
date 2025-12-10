import path from "path";
import os from "os";
import fs from "fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Client } from "@/lib/s3Client";
import { registerUser, sendMessage } from "@/lib/helper";
import { createCertificateInDb, getAllCertificateByUserId } from "@/services/certificate.service";
import { getCourseById } from "@/services/course.service";
import { getUserById } from "@/services/user.service";

export const createCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { course_id, date: studentDate, phone } = req.body;
        const userId = req.user!.id;

        if (!userId || !course_id || !phone) {
            return res.status(401).json({
                success: false,
                message: "Missing required fields for certificate generation.",
            });
        }
        const user = await getUserById(userId);

        if (!user || !user.displayName) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        console.debug("\n\nStudent data ===> ", req.body)
        const date = studentDate ? studentDate : new Date().toISOString().split("T")[0]


        console.debug(`\n\n Creating certificate of student with data :  `, { name: user.displayName, course_id, date, phone })
        const course = await getCourseById(course_id);


        if (!course) {
            console.warn("\n Course not found for certificate generation:", course_id)
            return res.status(404).json({
                success: false, message: "Course not found."
            });
        }

        const { renderToStaticMarkup } = await import("react-dom/server")
        const Certificate = (await import("@/lib/certificate")).default

        const certHtml = renderToStaticMarkup(
            Certificate({ name: user.displayName, course: course.title, date, mode: "server" })
        )

        const fullHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&display=swap" rel="stylesheet">
      <style>
        @page { 
          size: A4 landscape; 
          margin: 0; 
        }
        * {
          box-sizing: border-box;
        }
        html, body { 
          margin: 0; 
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: 'Georgia', serif;
          overflow: hidden;
        }
        #certificate-design {
          width: 297mm !important;
          height: 210mm !important;
        }
      </style>
    </head>
    <body>
      ${certHtml}
    </body>
  </html>
`;

        console.debug("\n Launching browser using puppeteer...")

        let puppeteer: any;
        let browser: any;

        if (process.platform === 'darwin') {
            // macOS local dev - use regular puppeteer with its bundled Chrome
            console.debug("Running on macOS - using bundled Puppeteer")
            puppeteer = (await import('puppeteer')).default;

            browser = await puppeteer.launch({
                headless: true,
                // Don't use chromium args/executablePath on Mac!
                // Puppeteer will use its own bundled Chrome
            });

        } else {
            // Linux (Cloud Run) - use puppeteer-core with sparticuz chromium
            console.debug("Running on Linux - using Sparticuz Chromium")
            const chromium: any = (await import('@sparticuz/chromium-min')).default;
            puppeteer = (await import('puppeteer-core')).default;


            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(
                    'https://github.com/Sparticuz/chromium/releases/download/v140.0.0/chromium-v140.0.0-pack.x64.tar'
                ),
                headless: chromium.headless,
                ignoreHTTPSErrors: true,
            });


        }

        console.debug("\n Browser launched successfully")

        const page = await browser.newPage();
        await page.setViewport({
            width: 1754,
            height: 1240,
            deviceScaleFactor: 1
        });

        await page.setContent(fullHtml, { waitUntil: "networkidle0" });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const tempDir = os.tmpdir();
        const tempPath = path.join(tempDir, `${user.displayName.replace(/ /g, "_")}_${Date.now()}.pdf`);

        await page.evaluateHandle('document.fonts.ready');
        const certificateElement = await page.$('#certificate-design');

        if (!certificateElement) {
            await browser.close();
            return res.status(500).json({
                success: false, message: "Certificate element not found."
            });
        }

        await page.emulateMediaType('screen');

        await page.pdf({
            path: tempPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            displayHeaderFooter: false,
            pageRanges: '1',
        });

        console.log("Saved certificate pdf at:", tempPath);
        await browser.close();
        console.debug("\n Browser closed")

        // Upload to DigitalOcean Spaces
        const fileBuffer = await fs.readFile(tempPath);
        const bucketName = 'pankhuri-v3';
        const timestamp = Date.now();
        const destination = `certificates/${user.displayName.replace(/ /g, '_')}_${timestamp}.pdf`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: destination,
            Body: fileBuffer,
            ContentType: 'application/pdf',
            ACL: 'public-read',
        });

        await s3Client.send(command);
        console.debug("\nUploaded certificate to DigitalOcean Spaces successfully.");

        await fs.unlink(tempPath);

        const publicUrl = `https://pankhuri-v3.blr1.cdn.digitaloceanspaces.com/${destination}`;
        console.debug("\n Public URL ==> ", publicUrl)

        // Register Student
        await createCertificateInDb({
            userId: userId,
            courseId: course_id,
            certificateNumber: `CERT-${timestamp}`,
            certificateUrl: publicUrl,
            metaData: {}
        });
        const registerRes = await registerUser(user.displayName, phone)
        console.debug("\n Register res ==> ", registerRes)

        if (!registerRes.success) {
            console.warn(registerRes.message)
        }

        // Send WhatsApp Message
        const msgRes = await sendMessage({ phoneNo: phone, course: course.title, date, name: user.displayName, publicUrl });

        if (!msgRes.success) {
            return res.status(500).json({
                success: false,
                message: msgRes.message,
                error: msgRes.error,
            });
        }

        return res.status(200).json({
            success: true,
            message: msgRes.message,
            name: user.displayName,
            publicUrl,
        });

    } catch (error) {
        next(error);
    }
}

export const getCertificatesByUser = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const userId = req.user!.id;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;

        const result = await getAllCertificateByUserId({ userId, page, limit });

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        next(error);
    }
}