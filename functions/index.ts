import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * HTML Email Template for Welcome Email
 */
const getWelcomeEmailTemplate = (adminName: string, schoolName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to EduPak</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: -0.025em; }
    .hero { background-color: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; margin-bottom: 30px; }
    .hero-img { width: 100%; max-width: 400px; height: auto; border-radius: 16px; margin-bottom: 30px; }
    h1 { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 16px; letter-spacing: -0.025em; }
    p { font-size: 16px; color: #4b5563; margin-bottom: 24px; }
    .steps { text-align: left; background-color: #f3f4f6; border-radius: 16px; padding: 24px; margin-bottom: 30px; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .step-num { background-color: #7c3aed; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-right: 12px; flex-shrink: 0; }
    .step-text { font-size: 14px; font-weight: 600; color: #1f2937; }
    .cta { display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; transition: background-color 0.2s; }
    .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 40px; }
    .footer a { color: #7c3aed; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">EduPak</div>
    </div>
    <div class="hero">
      <img src="https://picsum.photos/seed/edupak/800/400" alt="Welcome to EduPak" class="hero-img">
      <h1>Welcome to the future of school management, ${adminName}! 🚀</h1>
      <p>We're thrilled to have <strong>${schoolName}</strong> on board. Your 14-day free trial has officially started, and we're here to help you transform your institution.</p>
      
      <div class="steps">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px;">Next Steps to Activation</div>
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text">Complete your School Profile (Upload Logo, Signature)</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text">Add your first Teacher</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text">Register your first Student</div>
        </div>
      </div>

      <a href="https://ais-pre-okiaxygchsuatkumovg4dv-411745313951.asia-east1.run.app" class="cta">Go to your Dashboard</a>
    </div>
    <div class="footer">
      <p>Need help? Contact us at <a href="mailto:support@edupak.io">support@edupak.io</a></p>
      <p><a href="#">Documentation</a> &bull; <a href="#">Tutorials</a></p>
      <p>&copy; 2026 EduPak. All rights reserved.<br>If you no longer wish to receive these emails, you can <a href="#">unsubscribe</a>.</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Triggered when a new school is registered.
 * Sends a welcome email to the school admin.
 */
export const sendWelcomeEmail = onDocumentCreated("schools/{schoolId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return;
  }

  const schoolData = snapshot.data();
  const { name: schoolName, adminEmail, adminName } = schoolData;

  console.log(`Processing welcome email for ${schoolName} (${adminEmail})`);

  // Initialize Resend with API Key from environment variables
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not set in environment variables.");
    return;
  }

  const resend = new Resend(resendApiKey);

  try {
    const html = getWelcomeEmailTemplate(adminName, schoolName);

    const { data, error } = await resend.emails.send({
      from: 'EduPak <welcome@edupak.io>',
      to: [adminEmail],
      subject: `Welcome to EduPak, ${adminName}! 🚀`,
      html: html,
    });

    if (error) {
      console.error("Error sending email via Resend:", error);
      return;
    }

    console.log("Welcome email sent successfully:", data?.id);

  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }
});

// This function runs every night at 2:00 AM to perform an automated backup
export const scheduledBackup = onSchedule('0 2 * * *', async (event) => {
  console.log('Starting automated daily backup...');
  
  try {
    // 1. Check if automated backups are enabled in global settings
    const settingsDoc = await admin.firestore().doc('settings/global').get();
    const settings = settingsDoc.data();
    
    if (!settings?.backupSettings?.automatedBackups) {
      console.log('Automated backups are disabled in settings. Skipping.');
      return;
    }

    // 2. Trigger the backup logic (similar to the manual backup API)
    const backupId = `auto-${Date.now()}`;
    const collections = ['schools', 'users', 'subscriptions', 'transactions', 'license_keys'];
    const backupData: any = {};

    for (const col of collections) {
      const snapshot = await admin.firestore().collection(col).get();
      backupData[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const bucket = admin.storage().bucket();
    const file = bucket.file(`backups/${backupId}.json`);
    
    await file.save(JSON.stringify(backupData), {
      metadata: { contentType: 'application/json' }
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });

    const size = (await file.getMetadata())[0].size;

    await admin.firestore().collection('backups_history').doc(backupId).set({
      timestamp: new Date().toISOString(),
      size: Number(size),
      type: 'automated',
      status: 'completed',
      fileUrl: url,
      createdBy: 'system'
    });

    console.log(`Automated backup ${backupId} completed successfully.`);
    
    // 3. Cleanup old backups based on retention policy
    const retentionDays = settings.backupSettings.retentionDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const oldBackups = await admin.firestore()
      .collection('backups_history')
      .where('type', '==', 'automated')
      .where('timestamp', '<', cutoffDate.toISOString())
      .get();
      
    for (const doc of oldBackups.docs) {
      const data = doc.data();
      const fileName = data.fileUrl.split('/').pop()?.split('?')[0];
      if (fileName) {
        await bucket.file(`backups/${fileName}`).delete().catch(e => console.error('Delete file error:', e));
      }
      await doc.ref.delete();
    }

  } catch (error) {
    console.error('Automated backup failed:', error);
  }
});
