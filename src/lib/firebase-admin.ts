import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Reuses the same service account already granted Vertex AI User / Sheets access — just needs
// the Cloud Datastore User IAM role added, and a Firestore database (Native mode) created in the
// project. No new credentials to manage.
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const projectId = process.env.GOOGLE_CLOUD_PROJECT;

export const isFirestoreConfigured = Boolean(serviceAccountEmail && serviceAccountPrivateKey && projectId);

let firestore: Firestore | null = null;

export function getFirestoreClient(): Firestore {
  if (!isFirestoreConfigured) {
    throw new Error(
      "Firestore isn't configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, GOOGLE_CLOUD_PROJECT.",
    );
  }
  if (!firestore) {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId,
          clientEmail: serviceAccountEmail,
          privateKey: serviceAccountPrivateKey,
        }),
        projectId,
      });
    firestore = getFirestore(app);
  }
  return firestore;
}
