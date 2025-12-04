import path from "path";
import os from "os";
import fs from "fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Client } from "@/lib/s3Client";
import { registerUser, sendMessage } from "@/lib/helper";
import { createCertificateInDb } from "@/services/certificate.service";

export const createCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { Name: name, course, date: studentDate, phone } = req.body;
        const userId = req.user!.id;

        console.debug("\n\nStudent data ===> ", req.body)
        const date = studentDate ? studentDate : new Date().toISOString().split("T")[0]

        if (!name || !course) {
            return res.status(400).json({
                success: false, message: "Missing required student data (name, course)."
            });
        }

        console.debug(`\n\n Creating certificate of student with data :  `, { name, course, date, phone })

        const { renderToStaticMarkup } = await import("react-dom/server")
        const Certificate = (await import("@/lib/certificate")).default

        const certHtml = renderToStaticMarkup(
            Certificate({ name, course, date, mode: "server" })
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
        const tempPath = path.join(tempDir, `${name.replace(/ /g, "_")}_${Date.now()}.pdf`);

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
        const destination = `certificates/${name.replace(/ /g, '_')}_${timestamp}.pdf`;

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
        const certificateRecord = await createCertificateInDb({
            userId: userId,
            certificateNumber: destination,
            certificateUrl: publicUrl,
            metaData: {}
        });
        const registerRes = await registerUser(name, phone)
        console.debug("\n Register res ==> ", registerRes)

        if (!registerRes.success) {
            console.warn(registerRes.message)
        }

        // Send WhatsApp Message
        const msgRes = await sendMessage({ phoneNo: phone, course, date, name, publicUrl })

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
            name: name,
            publicUrl,
        });

    } catch (error) {
        next(error);
    }
}

