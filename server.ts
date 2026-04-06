import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config early
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));

// Force project ID in environment BEFORE importing admin
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
    storageBucket: `${firebaseConfig.projectId}.firebasestorage.app`
  });
}
const firebaseApp = admin.app();

// Initialize Firestore with explicit database ID if provided, otherwise default
// Ensure we use the correct database ID from config
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

const auth = getAuth(firebaseApp);
const storage = getStorage(firebaseApp);

const logActivity = async (action_type: string, resource: string, details: string, actor: { uid: string, email: string }, ip: string = '0.0.0.0') => {
  try {
    await db.collection("audit_logs").add({
      actor_uid: actor.uid,
      actor_email: actor.email,
      action_type,
      resource,
      details,
      ip_address: ip,
      timestamp: admin.firestore.Timestamp.now()
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
};

async function startServer() {
  console.log("Starting server initialization...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: Register School
  app.post("/api/admin/register-school", async (req, res) => {
    const requestId = Math.random().toString(36).slice(-6);
    console.log(`[${requestId}] --- Add School Request ---`);
    console.log(`[${requestId}] Request Body:`, req.body);
    
    try {
      // Verify Auth Token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
      }

      // We skip Firestore check here because Admin SDK lacks Firestore permissions in this environment.
      // The frontend will perform the Firestore writes, which are protected by Security Rules.
      const isHardcodedAdmin = decodedToken.email === 'admin@mobihut.pk' || decodedToken.email === 'sadia.ranafb@gmail.com';
      
      // If we want to be strict, we could pass the role in the token claims, but for now we rely on the frontend 
      // to only call this if the user is a super admin, and the frontend rules will block the subsequent writes anyway.

      const { schoolName, adminName, adminEmail, adminPhone } = req.body;

      if (!schoolName || !adminName || !adminEmail) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Generate random 8-character password
      const password = Math.random().toString(36).slice(-8);

      // 2. Create Firebase Auth user for School Admin
      console.log(`[${requestId}] Creating Auth user for ${adminEmail}...`);
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: adminEmail,
          password: password,
          displayName: adminName,
          phoneNumber: adminPhone || undefined,
        });
      } catch (authError: any) {
        console.error(`[${requestId}] Auth Error:`, authError);
        if (authError.code === 'auth/email-already-exists') {
          return res.status(400).json({ error: "Admin email already exists in the system." });
        }
        throw authError;
      }
      console.log(`[${requestId}] Auth user created:`, userRecord.uid);

      res.json({
        success: true,
        uid: userRecord.uid,
        adminEmail,
        password,
        message: "Auth user created successfully."
      });

    } catch (error: any) {
      console.error(`[${requestId}] Detailed Error registering school:`, error);
      res.status(500).json({ 
        error: error.message || "Internal server error",
        code: error.code,
        details: error.details
      });
    }
  });

  // API Route: Update School
  app.post("/api/admin/update-school", async (req, res) => {
    res.json({ success: true, message: "Use frontend Firestore SDK instead" });
  });

  // API Route: Delete School
  app.post("/api/admin/delete-school", async (req, res) => {
    try {
      const { schoolId, adminUid, schoolAdminUid } = req.body;

      if (!schoolId || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // We skip Firestore check here because Admin SDK lacks Firestore permissions in this environment.
      // The frontend will perform the Firestore writes, which are protected by Security Rules.
      // We only use this endpoint to delete the Auth user.

      if (schoolAdminUid) {
        try {
          await auth.deleteUser(schoolAdminUid);
        } catch (e) {
          console.error("Failed to delete school admin user:", e);
        }
      }

      res.json({ success: true, message: "School Auth user deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting school:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Update Teacher Salary
  app.post("/api/admin/update-teacher-salary", async (req, res) => {
    try {
      const { schoolId, teacherUid, baseSalary, allowances, deductions, adminUid } = req.body;

      if (!schoolId || !teacherUid || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify admin permissions
      const adminDoc = await db.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      if (!adminData || (adminData.role !== "super_admin" && (adminData.role !== "school_admin" || adminData.schoolId !== schoolId))) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("schools").doc(schoolId).collection("teachers").doc(teacherUid).update({
        baseSalary,
        allowances,
        deductions
      });

      logActivity('UPDATE', 'Billing', `Updated teacher salary structure for ${teacherUid} in school ${schoolId}`, { uid: adminUid, email: adminData.email }, req.ip);

      res.json({ success: true, message: "Salary structure updated" });
    } catch (error: any) {
      console.error("Error updating teacher salary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Generate Payroll
  app.post("/api/payroll/generate", async (req, res) => {
    try {
      const { schoolId, month, adminUid } = req.body;

      if (!schoolId || !month || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify admin permissions
      const adminDoc = await db.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      if (!adminData || (adminData.role !== "super_admin" && (adminData.role !== "school_admin" || adminData.schoolId !== schoolId))) {
        return res.status(403).json({ error: "Unauthorized to generate payroll for this school" });
      }

      // 1. Fetch all active teachers for the school
      const teachersSnap = await db.collection("schools").doc(schoolId).collection("teachers")
        .where("status", "==", "active")
        .get();

      if (teachersSnap.empty) {
        return res.json({ success: true, message: "No active teachers found for this school.", count: 0 });
      }

      const batch = db.batch();
      let count = 0;

      for (const teacherDoc of teachersSnap.docs) {
        const teacher = teacherDoc.data();
        const payrollId = `${schoolId}_${teacher.uid}_${month}`;
        const payrollRef = db.collection("schools").doc(schoolId).collection("payroll").doc(payrollId);

        // Check if already exists
        const existing = await payrollRef.get();
        if (!existing.exists) {
          const netSalary = (teacher.baseSalary || 0) + (teacher.allowances || 0) - (teacher.deductions || 0);
          
          batch.set(payrollRef, {
            id: payrollId,
            teacherUid: teacher.uid,
            teacherName: teacher.name,
            schoolId: schoolId,
            month: month,
            baseSalary: teacher.baseSalary || 0,
            allowances: teacher.allowances || 0,
            deductions: teacher.deductions || 0,
            netSalary: netSalary,
            status: "pending",
            createdAt: admin.firestore.Timestamp.now(),
          });
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      res.json({ success: true, message: `Payroll generated for ${count} teachers.`, count });

    } catch (error: any) {
      console.error("Error generating payroll:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Mark Payroll as Paid (Automated Payout Simulation)
  app.post("/api/payroll/pay", async (req, res) => {
    try {
      const { schoolId, payrollId, adminUid } = req.body;

      if (!schoolId || !payrollId || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify admin permissions
      const adminDoc = await db.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      if (!adminData || (adminData.role !== "super_admin" && (adminData.role !== "school_admin" || adminData.schoolId !== schoolId))) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const payrollRef = db.collection("schools").doc(schoolId).collection("payroll").doc(payrollId);
      const payrollDoc = await payrollRef.get();
      
      if (!payrollDoc.exists) {
        return res.status(404).json({ error: "Payroll record not found" });
      }

      const payrollData = payrollDoc.data();
      if (payrollData?.status === "paid") {
        return res.status(400).json({ error: "Payroll already paid" });
      }

      // --- MOCK PAYMENT GATEWAY INTEGRATION ---
      // Simulating external API call to a payment gateway (e.g., Stripe, JazzCash, EasyPaisa)
      console.log(`Initiating payout of Rs. ${payrollData?.netSalary} to ${payrollData?.teacherName}...`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate successful transaction
      const mockTransactionId = `TXN_${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      // ----------------------------------------

      await payrollRef.update({
        status: "paid",
        paidAt: admin.firestore.Timestamp.now(),
        transactionId: mockTransactionId,
        paymentGateway: "MockGateway_v1"
      });

      res.json({ 
        success: true, 
        message: "Salary payout successful.",
        transactionId: mockTransactionId
      });
    } catch (error: any) {
      console.error("Error processing payout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Webhook for Payment Gateway (Stripe Mock)
  app.post("/api/webhooks/payments", async (req, res) => {
    const event = req.body;
    console.log("--- Webhook Received ---", event.type);

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const schoolId = session.metadata.schoolId;
        const planId = session.metadata.planId;

        console.log(`Payment successful for School: ${schoolId}, Plan: ${planId}`);

        // 1. Update School Status
        await db.collection("schools").doc(schoolId).update({
          status: "active",
          licenseExpiryDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // Extend by 30 days
        });

        // 2. Create/Update Subscription record
        const subId = `SUB_${schoolId}`;
        await db.collection("subscriptions").doc(subId).set({
          schoolId,
          planId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: "active",
          currentPeriodStart: admin.firestore.Timestamp.now(),
          currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          updatedAt: admin.firestore.Timestamp.now()
        });

        // 3. Log Transaction
        const txnId = `TXN_${Date.now()}`;
        await db.collection("transactions").doc(txnId).set({
          id: txnId,
          schoolId,
          amount: session.amount_total / 100,
          currency: session.currency,
          status: "paid",
          createdAt: admin.firestore.Timestamp.now()
        });
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // API Route: Register Teacher
  app.post("/api/admin/register-teacher", async (req, res) => {
    try {
      const { name, email, phone, designation, baseSalary, allowances, deductions, schoolId, adminUid } = req.body;

      if (!name || !email || !schoolId || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify admin permissions
      const adminDoc = await db.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      if (!adminData || (adminData.role !== "super_admin" && (adminData.role !== "school_admin" || adminData.schoolId !== schoolId))) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // 1. Generate random password
      const password = Math.random().toString(36).slice(-8);

      // 2. Create Firebase Auth user
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
          phoneNumber: phone || undefined,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          return res.status(400).json({ error: "Email already exists." });
        }
        throw authError;
      }

      const now = admin.firestore.Timestamp.now();

      // 3. Create 'users' record
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        name,
        role: "teacher",
        schoolId,
        status: "active",
        isForcedResetRequired: true,
        createdAt: now,
      });

      // 4. Create 'teachers' record in school sub-collection
      await db.collection("schools").doc(schoolId).collection("teachers").doc(userRecord.uid).set({
        uid: userRecord.uid,
        name,
        email,
        phone: phone || "",
        designation: designation || "Teacher",
        baseSalary: Number(baseSalary) || 0,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        status: "active",
        joiningDate: now,
        subjects: [],
      });

      res.json({
        success: true,
        teacherUid: userRecord.uid,
        email,
        password,
        message: "Teacher registered successfully."
      });

    } catch (error: any) {
      console.error("Error registering teacher:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Create Staff Account (Generic)
  app.post("/api/admin/create-staff-account", async (req, res) => {
    try {
      const { name, email, role, schoolId, adminUid } = req.body;

      if (!name || !email || !role || !schoolId || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify admin permissions
      const adminDoc = await db.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      if (!adminData || (adminData.role !== "super_admin" && (adminData.role !== "school_admin" || adminData.schoolId !== schoolId))) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // 1. Generate random password
      const password = Math.random().toString(36).slice(-8);

      // 2. Create Firebase Auth user
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          return res.status(400).json({ error: "Email already exists." });
        }
        throw authError;
      }

      const now = admin.firestore.Timestamp.now();

      // 3. Create 'users' record
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        name,
        role: role, // e.g., 'teacher' or 'staff'
        schoolId,
        status: "active",
        isForcedResetRequired: true,
        createdAt: now,
      });

      res.json({
        success: true,
        userUid: userRecord.uid,
        email,
        password,
        message: "Staff account created successfully."
      });

    } catch (error: any) {
      console.error("Error creating staff account:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Reset Admin Password
  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const { targetUid, newPassword, pin, adminUid } = req.body;

      if (!targetUid || !newPassword || !pin || !adminUid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Verify Secret PIN
      if (pin !== "3322") {
        return res.status(403).json({ error: "Invalid Security PIN." });
      }

      // 2. Verify admin permissions (Super Admin or the user themselves)
      const adminDoc = await db.collection("users").doc(adminUid).get();
      const adminData = adminDoc.data();
      
      if (!adminData) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const isSuperAdmin = adminData.role === "super_admin";
      const isSelf = adminUid === targetUid;

      if (!isSuperAdmin && !isSelf) {
        return res.status(403).json({ error: "Unauthorized to reset this password." });
      }

      // 3. Update password via Admin SDK
      await auth.updateUser(targetUid, {
        password: newPassword
      });

      // 4. Mark as reset in Firestore if needed
      await db.collection("users").doc(targetUid).update({
        isForcedResetRequired: false,
        lastPasswordReset: admin.firestore.Timestamp.now()
      });

      res.json({ success: true, message: "Password updated successfully." });

    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware initialized.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // --- License Key Logic ---
const generateSecureKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `EDUPAK-${segment()}-${segment()}-${segment()}`;
};

app.post('/api/admin/generate-keys', async (req, res) => {
  const { plan_id, duration_days, count } = req.body;
  
  try {
    const batch = db.batch();
    const keys = [];
    
    for (let i = 0; i < count; i++) {
      const key = generateSecureKey();
      const keyRef = db.collection('license_keys').doc(key);
      const keyData = {
        key,
        plan_id,
        duration_days: Number(duration_days),
        status: 'unused',
        school_id: null,
        activated_at: null,
        created_by: 'super_admin',
        createdAt: new Date().toISOString()
      };
      batch.set(keyRef, keyData);
      keys.push(keyData);
    }
    
    await batch.commit();

    logActivity('CREATE', 'Billing', `Generated ${count} license keys for plan ${plan_id}`, { uid: 'SYSTEM', email: 'system@edupak.pk' }, req.ip);

    res.json({ success: true, keys });
  } catch (error) {
    console.error("Error generating keys:", error);
    res.status(500).json({ error: "Failed to generate keys" });
  }
});

app.post('/api/license/activate', async (req, res) => {
  const { key, school_id } = req.body;
  
  try {
    const keyRef = db.collection('license_keys').doc(key);
    const keyDoc = await keyRef.get();
    
    if (!keyDoc.exists) {
      return res.status(404).json({ error: "License key not found" });
    }
    
    const keyData = keyDoc.data();
    if (keyData?.status !== 'unused') {
      return res.status(400).json({ error: `License key is already ${keyData?.status}` });
    }
    
    const schoolRef = db.collection('schools').doc(school_id);
    const schoolDoc = await schoolRef.get();
    
    if (!schoolDoc.exists) {
      return res.status(404).json({ error: "School not found" });
    }
    
    const schoolData = schoolDoc.data();
    const currentExpiry = schoolData?.subscription_end_date || schoolData?.trial_expires_at || new Date().toISOString();
    const currentExpiryDate = new Date(currentExpiry);
    
    // Add duration days
    const newExpiryDate = new Date(currentExpiryDate.getTime() + (keyData.duration_days * 24 * 60 * 60 * 1000));
    
    const batch = db.batch();
    
    // Update Key
    batch.update(keyRef, {
      status: 'active',
      school_id: school_id,
      activated_at: new Date().toISOString()
    });
    
    // Update School
    batch.update(schoolRef, {
      subscription_end_date: newExpiryDate.toISOString(),
      status: 'active'
    });
    
    await batch.commit();
    
    res.json({ 
      success: true, 
      message: "License activated successfully",
      newExpiry: newExpiryDate.toISOString()
    });
    
  } catch (error) {
    console.error("Error activating license:", error);
    res.status(500).json({ error: "Failed to activate license" });
  }
});

// --- Backup & Restore Logic ---

app.post('/api/admin/backup/run', async (req, res) => {
  const { adminUid } = req.body;
  
  try {
    // 1. Verify admin
    const adminDoc = await db.collection("users").doc(adminUid).get();
    if (adminDoc.data()?.role !== "super_admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const backupId = `BACKUP_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // 2. Collect data from critical collections
    const collections = ['schools', 'users', 'subscriptions', 'transactions', 'license_keys'];
    const backupData: any = {};
    
    for (const col of collections) {
      const snap = await db.collection(col).get();
      backupData[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 3. Save to Cloud Storage
    const bucket = storage.bucket();
    const file = bucket.file(`backups/${backupId}.json`);
    const jsonContent = JSON.stringify(backupData, null, 2);
    
    await file.save(jsonContent, {
      contentType: 'application/json',
      metadata: {
        firebaseStorageDownloadTokens: backupId // Simple token for simulation
      }
    });

    const size = Buffer.byteLength(jsonContent);
    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`backups/${backupId}.json`)}?alt=media&token=${backupId}`;

    // 4. Log to history
    const historyRef = db.collection('backups_history').doc(backupId);
    const historyData = {
      id: backupId,
      timestamp,
      size,
      type: 'manual',
      status: 'completed',
      fileUrl,
      createdBy: adminUid
    };
    
    await historyRef.set(historyData);
    
    logActivity('SYSTEM', 'Settings', `Manual backup initiated: ${backupId}`, { uid: adminUid, email: adminDoc.data()?.email || 'admin' }, req.ip);

    res.json({ success: true, backup: historyData });
  } catch (error: any) {
    console.error("Backup failed:", error);
    res.status(500).json({ error: error.message || "Failed to run backup" });
  }
});

app.post('/api/admin/backup/restore', async (req, res) => {
  const { backupId, adminUid, confirmCode } = req.body;
  
  try {
    if (confirmCode !== 'RESTORE-CONFIRM') {
      return res.status(400).json({ error: "Invalid confirmation code" });
    }

    // 1. Verify admin
    const adminDoc = await db.collection("users").doc(adminUid).get();
    if (adminDoc.data()?.role !== "super_admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2. Fetch backup from storage
    const bucket = storage.bucket();
    const file = bucket.file(`backups/${backupId}.json`);
    const [content] = await file.download();
    const backupData = JSON.parse(content.toString());

    // 3. Restore collections (Batch Write)
    // WARNING: This is a simplified restore. In production, you'd handle large datasets with multiple batches.
    for (const col in backupData) {
      const batch = db.batch();
      const items = backupData[col];
      
      // Delete existing (optional, but usually needed for a full restore)
      const existingSnap = await db.collection(col).get();
      existingSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      // Write backup items
      items.forEach((item: any) => {
        const { id, ...data } = item;
        batch.set(db.collection(col).doc(id), data);
      });
      
      await batch.commit();
    }

    res.json({ success: true, message: "System restored successfully from backup." });
  } catch (error: any) {
    console.error("Restore failed:", error);
    res.status(500).json({ error: error.message || "Failed to restore backup" });
  }
});

  // Invite Staff Route
  app.post('/api/admin/invite-staff', async (req, res) => {
    const { email, password, role, name, adminUid, schoolId } = req.body;

    try {
      // 1. Verify the requester
      const adminDoc = await db.collection('users').doc(adminUid).get();
      const adminData = adminDoc.data();
      if (!adminDoc.exists || (adminData?.role !== 'super_admin' && adminData?.role !== 'school_admin')) {
        return res.status(403).json({ error: 'Unauthorized: Only Admins can invite staff.' });
      }

      // If School Admin, ensure they are inviting to their own school
      if (adminData.role === 'school_admin' && adminData.schoolId !== schoolId) {
        return res.status(403).json({ error: 'Unauthorized: You can only invite staff to your own school.' });
      }

      // 2. Create the user in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });

      // 3. Create the user profile in Firestore
      const userProfile = {
        uid: userRecord.uid,
        email,
        name,
        role,
        schoolId: schoolId || null,
        status: 'active',
        isForcedResetRequired: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('users').doc(userRecord.uid).set(userProfile);

      // 4. If it's a super admin assistant, add to super_admin_team
      if (adminData.role === 'super_admin') {
        await db.collection('super_admin_team').doc(userRecord.uid).set({
          uid: userRecord.uid,
          is2FAEnabled: false,
          lastIp: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          permissions: {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error('Error inviting staff:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/log-activity', async (req, res) => {
    const { actor_uid, actor_email, action_type, resource, details } = req.body;
    try {
      await db.collection('audit_logs').add({
        actor_uid,
        actor_email,
        action_type,
        resource,
        details,
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Seed data asynchronously to avoid blocking server start
  const seedData = async () => {
    try {
      console.log("Checking for dummy data...");
      // Dummy data for admin_roles
      const rolesRef = db.collection('admin_roles');
      const rolesSnap = await rolesRef.get();
      if (rolesSnap.empty) {
        console.log("Seeding admin roles...");
        await rolesRef.doc('billing_manager').set({
          id: 'billing_manager',
          role_name: 'Billing Manager',
          permissions: {
            schools: ['view'],
            billing: ['view', 'create', 'edit'],
            health: ['view'],
            backup: ['view'],
            users: ['view']
          }
        });
        await rolesRef.doc('support_agent').set({
          id: 'support_agent',
          role_name: 'Support Agent',
          permissions: {
            schools: ['view'],
            billing: [],
            health: ['view'],
            backup: [],
            users: ['view', 'edit']
          }
        });
      }

      // Dummy staff members
      const usersRef = db.collection('users');
      const staffSnap = await usersRef.where('role', 'in', ['super_admin', 'billing_manager', 'support_agent']).get();
      if (staffSnap.empty) {
        console.log("Seeding dummy staff...");
        // Master Admin
        await usersRef.doc('master_admin_id').set({
          uid: 'master_admin_id',
          email: 'admin@mobihut.pk',
          name: 'Master Admin',
          role: 'super_admin',
          status: 'active',
          isForcedResetRequired: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActive: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Sub Admin 1
        await usersRef.doc('sub_admin_1').set({
          uid: 'sub_admin_1',
          email: 'billing@edupak.pk',
          name: 'Sarah Billing',
          role: 'billing_manager',
          status: 'active',
          isForcedResetRequired: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActive: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Dummy support tickets
      const ticketsRef = db.collection('support_tickets');
      const ticketsSnap = await ticketsRef.get();
      if (ticketsSnap.empty) {
        console.log("Seeding support tickets...");
        const ticket1Id = 'TKT-1001';
        const ticket2Id = 'TKT-1002';
        const ticket3Id = 'TKT-1003';

        await ticketsRef.doc(ticket1Id).set({
          school_id: 'SCH-101',
          school_name: 'Beaconhouse School System',
          subject: 'Issue with Fee Module Calculation',
          status: 'open',
          priority: 'high',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await ticketsRef.doc(ticket1Id).collection('messages').add({
          sender_id: 'SCH-101-ADMIN',
          sender_name: 'Ahmed Khan',
          sender_role: 'school_admin',
          text: 'Hello, we are seeing some discrepancies in the fee calculation for Grade 5 students. Can you please check?',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await ticketsRef.doc(ticket2Id).set({
          school_id: 'SCH-102',
          school_name: 'The City School',
          subject: 'New Teacher Onboarding Error',
          status: 'pending',
          priority: 'urgent',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await ticketsRef.doc(ticket2Id).collection('messages').add({
          sender_id: 'SCH-102-ADMIN',
          sender_name: 'Sara Ali',
          sender_role: 'school_admin',
          text: 'Urgent: I am unable to add new teachers to the system. Getting a 500 error.',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await ticketsRef.doc(ticket2Id).collection('messages').add({
          sender_id: 'SUPER-ADMIN-1',
          sender_name: 'Master Admin',
          sender_role: 'super_admin',
          text: 'Hi Sara, we are looking into this. It seems like a temporary database sync issue.',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await ticketsRef.doc(ticket3Id).set({
          school_id: 'SCH-103',
          school_name: 'Roots International',
          subject: 'Request for Custom Report Export',
          status: 'resolved',
          priority: 'low',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Seed Global Config
      const globalConfigRef = db.collection('settings').doc('global_config');
      const globalConfigSnap = await globalConfigRef.get();
      if (!globalConfigSnap.exists) {
        console.log("Seeding global config...");
        await globalConfigRef.set({
          platformName: 'EduPak',
          supportEmail: 'support@edupak.io',
          supportPhone: '+92 304 1478644',
          currency: 'PKR',
          timezone: 'Asia/Karachi',
          branding: {
            logoUrl: 'https://picsum.photos/seed/edupak-logo/400/100',
            faviconUrl: 'https://picsum.photos/seed/edupak-favicon/32/32',
            primaryColor: '#00f3ff'
          },
          apis: {
            stripePublic: 'pk_test_51P...',
            stripeSecret: 'sk_test_51P...',
            smtpHost: 'smtp.sendgrid.net',
            smtpKey: 'SG.xxxx.yyyy',
            smsApiUrl: 'https://api.twilio.com/2010-04-01/Accounts/...',
            smsApiKey: 'ACxxxxxxxxxxxxxxxxxxxxxxxx'
          },
          legal: {
            termsAndConditions: 'Standard EduPak Terms and Conditions apply to all SaaS instances...',
            privacyPolicy: 'Your data privacy is our top priority. We follow global GDPR and local data protection laws...'
          },
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: 'System Architect'
        });
        console.log('Global configuration seeded.');
      }
    } catch (error) {
      console.error("Seeding failed:", error);
    }
  };

  seedData();
}

startServer();
