# NURU — AI-Native Autonomous Retail & Financial Operating System

NURU is a B2C consumer electronics and gaming enterprise powered by Google Gemini 2.x, Vertex AI, and Google Cloud.

## 🚀 Overview

- **Front-of-House:** Multilingual Gemini 2.x Shopping Concierge (English, Swahili, Sheng) with neural voice synthesis, Ex-UK certified savings comparison, and Lipa Pole Pole (BNPL) financing.
- **Autonomous Support:** Autonomous warranty and return claims adjudication with direct double-entry General Ledger posting in PostgreSQL.
- **Enterprise ERP:** Cash-basis P&L engine with 1-click Google Sheets synchronization via the Google Sheets API.
- **Autonomous Treasury:** Capital Circle multi-agent loop with Circle Developer-Controlled Wallets on Polygon and database spend limits.

## 🛠️ Google Cloud Deployment (Cloud Run)

### Project Configuration
- **GCP Project ID:** `nuru-platform-2026`
- **GCP Project Name:** `nuru`
- **Region:** `us-central1`

### 1. Build and Deploy via Cloud Build
```bash
gcloud builds submit --config cloudbuild.yaml --project=nuru-platform-2026
```

### 2. Direct Deploy to Cloud Run
```bash
gcloud run deploy nuru-platform \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project=nuru-platform-2026
```

## 💻 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

