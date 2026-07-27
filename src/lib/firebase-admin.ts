import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

// Reuses the same service account already granted Vertex AI User / Sheets access — just needs
// the Cloud Datastore User IAM role added, and a Firestore database (Native mode) created in the
// project. No new credentials to manage.
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const storageBucketName = process.env.FIREBASE_STORAGE_BUCKET;

export const isFirestoreConfigured = Boolean(serviceAccountEmail && serviceAccountPrivateKey && projectId);
export const isFirebaseStorageConfigured = Boolean(
  serviceAccountEmail && serviceAccountPrivateKey && projectId && storageBucketName,
);

let firestore: Firestore | null = null;
let storageBucket: Bucket | null = null;

function getFirebaseApp() {
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: serviceAccountEmail,
        privateKey: serviceAccountPrivateKey,
      }),
      projectId,
    })
  );
}

export function getFirestoreClient(): Firestore {
  if (!isFirestoreConfigured) {
    throw new Error(
      "Firestore isn't configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, GOOGLE_CLOUD_PROJECT.",
    );
  }
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());
  }
  return firestore;
}

/** Bucket for delivery-verification photos etc. (see src/lib/logistics/verify-delivery-photo.ts) — same service account/project as Firestore, just needs a Cloud Storage bucket created and FIREBASE_STORAGE_BUCKET set. */
export function getStorageBucket(): Bucket {
  if (!isFirebaseStorageConfigured) {
    throw new Error(
      "Firebase Storage isn't configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, GOOGLE_CLOUD_PROJECT, FIREBASE_STORAGE_BUCKET.",
    );
  }
  if (!storageBucket) {
    storageBucket = getStorage(getFirebaseApp()).bucket(storageBucketName);
  }
  return storageBucket;
}
