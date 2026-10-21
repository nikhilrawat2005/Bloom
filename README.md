# 🌸 Bloom — Opportunity Intelligence & AI Career Acceleration Platform

> **Bloom** is a next-generation, clutter-free career and academic intelligence ecosystem. It connects ambitious students and builders with curated global scholarships, fellowships, internships, hackathons, and STEM programs — powered by unified AI career advisory, interactive career roadmaps, document wallet, and autonomous ingestion pipelines.

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.10-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase Firestore](https://img.shields.io/badge/Firebase-bloom--45af9-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Document_Wallet-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

---

## 🚀 Key Modules & Capabilities

### 1. 🧭 Opportunity Discovery & Intelligent Atlas
- **400+ Curated Listings**: Scholarships, Fellowships, Internships, Hackathons, Conferences, Research Grants, Workshops, and Global Exchange Programs.
- **Expiry Sweep Architecture**: Automated verification sweeps stale and expired listings every 12 hours so students never encounter dead links or closed deadlines.
- **Deep Domain Filtering**: Category-specific faceted filters (funded/unfunded, virtual/offline, merit/need, undergraduate/graduate).

### 2. 🤖 AI Career Hub & Unified Intelligence
- **Unified Chatbot Advisory**: Seamless blend of real-time AI career guidance and structured interview preparation in a responsive viewport chatbox.
- **14 Interactive Career Roadmaps**: Step-by-step career path trees (AI/ML Engineer, Full-Stack Developer, DevOps/Cloud, Cybersecurity, Data Science, etc.) with custom progress tracking synced to Firestore (`roadmap_progress`).
- **AI Opportunity Matcher**: Multi-factor matching engine analyzing candidate background, education, location, and skills with structured gap remediation.
- **Elite ATS Resume Analyzer**: In-depth scorecards, keyword gap audits, impact metric checks, and one-click PDF audit report generation.

### 3. 📂 Encrypted Document & Credential Wallet
- **Per-User Isolated Storage**: Secure file storage powered by Cloudinary with strict ownership verification.
- **Automated Document Categorization**: LLM-first document classifier with fallback heuristics for resumes, transcripts, recommendation letters, awards, and portfolios.
- **Security Guardrails**: Strict server-side MIME type filtering, sanitization, and quota tracking.

### 4. 📊 Dashboard, Calendar & Tracker
- **Smart Deadline Calendar**: Visualized timeline of approaching opportunity deadlines with automated urgency indicators (1, 3, 7, 14, 30 days).
- **In-App Automation Engine**: Zero-AI-cost event-driven notification trigger engine for milestone reminders and system updates.
- **Personalized Analytics**: AI activity digests, interview practice session analytics, and eligibility trends.

### 5. 🛡️ Robust Admin & Moderation Operations
- **Role Resolution & Approval Pipeline**: Manage user privileges, review scraped feeds, bulk-approve opportunities, and trigger AI descriptions cleanup.
- **Verified Admin Security**: Requires dual enforcement — verified email tokens + hardcoded security allow-list in Firestore rules and server auth.

---

## 🎨 Visual Identity & Design System

Bloom utilizes a **Cyber-Organic & Future-Calm** design aesthetic:
- **Typography**: `Space Grotesk` (headings & display) + `Plus Jakarta Sans` (high-legibility body) + `JetBrains Mono`.
- **Palette**:
  - **Electric Iris (`#4F46E5` / `#6366F1`)**: Primary action and brand accent.
  - **Luminous Mint (`#0D9488` / `#14B8A6`)**: Success, milestones, and high match percentages.
  - **Surfaces**: Crisp slate glassmorphism with fluid adaptive light and dark themes.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16.2.10 (App Router, Webpack Compiler, React 19) |
| **Language** | TypeScript 5 (Strict Mode, Zero Any) |
| **Styling** | TailwindCSS v4 with `@theme inline` design tokens & fluid clamp scales |
| **Animations** | Framer Motion (orchestrated staggers, smooth transitions) |
| **Authentication** | Firebase Authentication (Email/Password, Google OAuth, Email Verification) |
| **Database** | Google Cloud Firestore (Strict `firestore.rules` security) |
| **Storage** | Cloudinary API (Private per-user folders for wallet documents) |
| **AI Providers** | Groq (`llama-3.1-8b-instant`) + OpenRouter (`openrouter/free`) with failover |
| **Scheduled Tasks** | Vercel Cron (`/api/ingest`, `/api/scrape`, `/api/summarize-all`) |

---

## ⚙️ Environment Configuration (`.env.local`)

To run the application, create a `.env.local` file in the root directory:

```env
# ==============================================================================
# BLOOM ENVIRONMENT CONFIGURATION
# ==============================================================================

# 1. Firebase Web Client
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=bloom-45af9.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bloom-45af9
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bloom-45af9.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# 2. Firebase Admin SDK (Server-Side)
# In production (Vercel): Single-line JSON string of your service account
# In local development: Placed automatically in scripts/serviceAccountKey.json
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"bloom-45af9",...}
FIREBASE_PROJECT_ID=bloom-45af9

# 3. AI Providers (Multi-Key Rotation & Backup Pool)
GROQ_API_KEYS=gsk_your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant

OPENROUTER_API_KEYS=sk-or-v1-your_openrouter_key
OPENROUTER_MODEL=openrouter/free
OPENROUTER_ACTIVE_KEY_INDEX=1

# Optional provider
GEMINI_MODEL=gemini-1.5-flash

# 4. Cloudinary (Document Wallet)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=ovnspjoa
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=origin
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# 5. Admin & Security
ADMIN_EMAILS=nikhil2005114@gmail.com,bhatt.yogesh0814@gmail.com,ypranjalt@gmail.com,teamcipher.work@gmail.com
CRON_SECRET=your_secure_cron_secret_token

# Optional: GitHub API Token (for enriched developer stats in profile)
GITHUB_TOKEN=
```

---

## 🚀 Getting Started Locally

### 1. Clone & Navigate
```bash
git clone https://github.com/nikhilrawat2005/origin-v2v.git
cd origin-v2v
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Verify TypeScript & Security Rules
```bash
# Typecheck
npx tsc --noEmit

# Test Firestore Security Rules (requires Firebase Emulator)
npm run rules:verify
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 🛡️ Security & Defense Architecture

- **Default-Deny Firestore Rules**: Every collection has strict access control based on verified `request.auth.uid`.
- **SSRF Protection (`src/lib/urlGuard.ts`)**: Outbound requests validate IP targets against private ranges (RFC 1918, RFC 4193, loopbacks, DNS rebinding mitigation).
- **Prompt Injection Neutralization (`src/lib/promptGuard.ts`)**: All user-supplied inputs interpolated into LLM prompts pass through sanitization wrappers.
- **Strict Server Auth (`src/lib/serverAuth.ts`)**: Every state-changing API route enforces `requireUser()` or `requireAdmin()` token claims.
- **Fail-Closed Cron Authorization**: Vercel cron endpoints verify Bearer tokens with constant-time equality checks.

---

## 📦 Deployment & Firestore Rules

### Deploy Security Rules to Firebase
```bash
npm run deploy:rules
```
*Alternatively, paste the contents of `firestore.rules` into Firebase Console -> Project `bloom-45af9` -> Firestore Database -> Rules tab and click **Publish**.*

### Vercel Deployment
1. Import repository on [Vercel](https://vercel.com).
2. Configure all environment variables in **Project Settings -> Environment Variables**.
3. Deploy! Vercel Cron will automatically pick up schedules from `vercel.json`:
   - `/api/ingest` (Daily 03:00 UTC)
   - `/api/scrape?force=1` (Daily 04:00 UTC)
   - `/api/summarize-all` (Every 6 hours)

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).

<p align="center">
  <b>Bloom Platform</b> • Empowering the Next Generation of Builders & Scholars 🌸
</p>
