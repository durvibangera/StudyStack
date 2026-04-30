# GradPilot

GradPilot is an AI-native counselling and outreach platform for overseas education teams.
This repository contains the Next.js application that powers:

- Student onboarding and profile completion (form + voice agent)
- Live voice-driven profile extraction and counselling memory
- Counsellor lead operations (scoring, kanban, sessions, booking)
- AI campaign generation and execution across multiple agent nodes
- Multichannel publishing (email, LinkedIn, X/Twitter, WhatsApp)
- Audit logging and local agent observability
- Optional Merkle proof and prediction-log views

## Repository Layout

This repository is organized as:

```text
GradPilot/
  README.md
  documentation.html
  assets/
  GradPilot-Next-App/   <-- main product application
```

All application logic lives inside `GradPilot-Next-App`.

## Product Overview

GradPilot combines two major product surfaces in one codebase:

1. Student experience
- Account creation and login (credentials or Google)
- Guided onboarding profile flow
- Real-time voice counselling with live structured extraction
- AI-generated dashboard analysis, recommendations, and journey planning

2. Counsellor and growth operations
- Lead board and lead scoring
- Campaign brief enhancement and strategy generation
- Workflow graph generation and node-by-node execution
- Web research powered lead discovery
- Channel execution: email, LinkedIn, Twitter/X, video, image generation
- Session logging, summaries, and WhatsApp follow-ups

## Core Capabilities

### 1) Authentication and Access Control
- NextAuth with JWT sessions
- Providers: credentials and Google OAuth
- Role model: `student` and `counsellor`
- Route-level gating in middleware/proxy logic

### 2) Student Profile (KYC-style) Collection
- Structured profile schema stored in `User.studentProfile`
- Manual onboarding flow and incremental save support
- OCR-assisted extraction from PDF/image documents
- Voice-agent assisted extraction from live call transcripts
- Progress-aware completion logic (not just static required flags)

### 3) Voice Counselling Stack
- ElevenLabs conversational agent integration
- Signed session URL generation for client widget
- Memory endpoint that injects profile + prior conversation context
- Live extraction loop during active calls
- End-of-session extraction and profile merge
- Conversation persistence in `ConversationMemory`

### 4) Counsellor Operations
- Counsellor dashboard aggregation endpoint
- Lead CRUD + bulk import
- Computed lead scoring (intent, financial readiness, urgency)
- Counsellor session capture with transcript/raw event storage
- AI summary and follow-up question generation after session completion
- WhatsApp notification to student when summary is generated

### 5) AI Campaign Builder (Agentic Workflow)
- Campaign brief enhancement
- Strategy generation (HTML rationale)
- Workflow graph generation (nodes + semantic edges)
- Node execution context propagation over graph edges
- Node types include:
  - `strategy`, `copy`, `image`, `video`
  - `research`, `exa_research`
  - `timeline`, `distribution`
  - `email`, `linkedin`, `twitter`
- Workflow persistence in MongoDB and reload/delete support

### 6) Content and Channel Execution
- Image generation via Gemini image model with Cloudinary storage
- Video concept generation + Veo generation/polling pipeline
- Email generation + bulk send (Resend primary, Gmail fallback)
- LinkedIn posting flow with media upload support
- Twitter/X posting with multi-strategy fallback (OAuth2 + OAuth1)

### 7) WhatsApp Assistant and Scheduling
- Webhook and polling modes supported
- Stateful booking flow over chat (date/time/confirm)
- Booking persistence in MongoDB
- Context-aware general responses based on profile and history

### 8) Audit and Observability
- Structured audit logs in Mongo (`audit_logs` collection)
- Request metrics, status, user and category metadata
- Auto redaction of sensitive payload fields
- Dashboard UI for logs, stats, top endpoints, error trends
- Local JSONL observability files under `agent-logs/*`

## High-Level Architecture

```text
Next.js App Router (UI + API routes)
  |
  +-- Auth and session layer (NextAuth)
  +-- API orchestration layer (campaign, voice, social, email, whatsapp)
  +-- Dashboard and campaign UIs
  |
  +-- MongoDB (users, leads, sessions, workflows, logs, bookings, videos)
  +-- Gemini (reasoning, text, extraction, generation)
  +-- ElevenLabs (voice conversations)
  +-- Exa (web research)
  +-- Cloudinary (image asset storage)
  +-- Resend/Gmail (email delivery)
  +-- LinkedIn + X APIs (social posting)
  +-- Whapi (WhatsApp transport)
  +-- Veo via Google GenAI (video generation)
```

## Technology Stack

### Frontend
- Next.js 16
- React 19
- Tailwind CSS 4
- Framer Motion
- React Flow
- Recharts
- Three.js / react-three-fiber

### Backend (inside Next.js API routes)
- Next.js App Router API handlers
- NextAuth
- Mongoose / MongoDB
- Zod

### AI and Integrations
- Google Gemini (`@google/generative-ai`, `@google/genai`)
- ElevenLabs voice agent
- Exa web search
- Cloudinary
- Resend / Nodemailer
- LinkedIn API
- X/Twitter API
- Whapi Cloud

## Key Data Models

Main MongoDB models in `GradPilot-Next-App/lib/models`:

- `User`
  - identity, auth provider, role
  - embedded `studentProfile`
  - social tokens (LinkedIn/Twitter)
  - cached dashboard analysis
- `ConversationMemory`
  - voice/chat transcript slices
  - summary and extracted facts
- `CounsellorSession`
  - counsellor interaction transcripts and raw events
- `Lead`
  - counsellor lead pipeline records
- `Booking`
  - 1:1 session scheduling state
- `PastWorkflow`
  - saved campaign node/edge graphs
- `ScriptWorkflow`
  - workflow structure for video mappings
- `GeneratedVideo`
  - completed generated video metadata and paths
- `AuditLog`
  - full API/activity audit trail
- `AnalyticsData`
  - timeseries transaction-like analytics collection
- `WhatsAppState` and `WhatsAppPollState`
  - ephemeral chat and poll cursors

## API Surface (by Domain)

Representative route groups under `GradPilot-Next-App/app/api`:

### Auth and user
- `/api/auth/[...nextauth]`
- `/api/user/profile`
- `/api/user/social-status`

### Onboarding and profile extraction
- `/api/kyc`
- `/api/kyc/extract-document`

### Voice agent
- `/api/voice-agent/elevenlabs-token`
- `/api/voice-agent/live-extract`
- `/api/voice-agent/extract-kyc`
- `/api/voice-agent/memory`
- `/api/voice-agent/conversations`
- `/api/voice-agent/conversations/sync-latest`
- `/api/voice-agent/end-session`

### Counsellor and student ops
- `/api/counsellor/dashboard`
- `/api/counsellor-sessions`
- `/api/counsellor-sessions/[sessionId]`
- `/api/counsellor-sessions/context`
- `/api/leads`
- `/api/leads/import`
- `/api/students/scored`
- `/api/students/[id]`
- `/api/bookings`

### Campaign and workflows
- `/api/campaign/enhance-brief`
- `/api/campaign/generate-strategy`
- `/api/campaign/generate-workflow`
- `/api/campaign/execute-node`
- `/api/campaign/exa-research`
- `/api/workflows/save`
- `/api/workflows/list`
- `/api/workflows/[id]`

### Channel and media
- `/api/email/parse-csv`
- `/api/email/send-bulk`
- `/api/linkedin/auth`, `/api/linkedin/post`
- `/api/twitter/auth`, `/api/twitter/post`
- `/api/cloudinary/upload`, `/api/cloudinary/delete`
- `/api/video-studio/generate-video`
- `/api/video-studio/generated-videos`

### WhatsApp
- `/api/whatsapp/webhook`
- `/api/whatsapp/poll`

### Audit
- `/api/audit/log`
- `/api/audit/logs`
- `/api/audit/stats`

### Prediction/Merkle views (optional legacy integration)
- `/api/user/predictions`
- `/api/user/prediction/[predictionId]`
- UI route: `/merkle/[predictionId]`

## Local Development Setup

## Prerequisites
- Node.js 18.18+ (Node 20 recommended)
- npm
- MongoDB instance (Atlas or local)

## Install

```bash
cd GradPilot-Next-App
npm install
```

## Environment Configuration

Create `GradPilot-Next-App/.env.local`.

Minimum baseline for app boot and core features:

```env
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_long_random_secret
GEMINI_API_KEY=your_gemini_api_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Recommended full-feature environment matrix:

```env
# Core
MONGODB_URI=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
NODE_ENV=development

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Gemini
GEMINI_API_KEY=

# ElevenLabs voice
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=

# Exa research
EXA_API_KEY=

# Cloudinary (image persistence)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email providers
RESEND_API_KEY=
EMAIL_FROM=
GMAIL_USER=
GMAIL_APP_PASSWORD=
EMAIL_USER=
EMAIL_APP_PASSWORD=
ENABLE_TEST_COPY=false

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_ACCESS_TOKEN=
NEXT_PUBLIC_LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/auth/callback

# Twitter/X
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
NEXT_PUBLIC_TWITTER_REDIRECT_URI=http://localhost:3000/api/twitter/auth/callback
TWITTER_TOKEN_REDIRECT_URI=http://localhost:3000/get-tokens/twitter/callback
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_TOKEN_SECRET=

# WhatsApp (Whapi)
WHAPI_TOKEN=
WHAPI_WEBHOOK_SECRET=
COUNSELLOR_WHATSAPP_NUMBER=
NEXT_PUBLIC_COUNSELLOR_WHATSAPP_NUMBER=
```

## Run

```bash
npm run dev
```

Open:
- `http://localhost:3000`

## Typical End-to-End Flows

### Student onboarding flow
1. Sign in or create account
2. Open student dashboard
3. Start voice onboarding or complete form fields
4. Live extraction updates profile and progress
5. Complete profile to unlock full dashboard

### Campaign execution flow
1. Open campaign page and describe brief
2. Enhance brief (optional)
3. Generate strategy then workflow graph
4. Execute nodes in order or selectively
5. Persist workflow, export outcomes, and publish content

### Counsellor lead operations flow
1. Open counsellor dashboard
2. Review scored students and lead board
3. Import generated leads into kanban
4. Run sessions and capture transcript logs
5. Trigger WhatsApp follow-ups and bookings

## Logging and Observability

### Mongo audit logs
- Use `/audit` page for operational analytics
- Logs are TTL-pruned (90 days)

### Local filesystem logs
Generated under `GradPilot-Next-App/agent-logs/`:
- `agents/`
- `ai-provider/`
- `ai-sdk-executor/`
- `api/`
- `errors/`
- `unified-executor/`
- `workflows/`
- `workflows/web-research-cache/`

## Additional Documentation in Repo

Inside `GradPilot-Next-App`:
- `AUDIT_LOGGING_DOCUMENTATION.md`
- `KYC_OCR_FEATURE.md`
- `EMAIL_CAMPAIGN_GUIDE.md`
- `QUICK_START_EMAIL.md`
- `MERKLE_TREE_FIX.md`
- `SETUP_CHECKLIST.md`

## Notes on Legacy and Optional Modules

- The repository still contains prediction-log and Merkle visualization routes/components used with external forecasting/blockchain pipelines.
- If you are only using the counselling + campaign stack, those modules can remain unused.

## Current Status

This is a production-style integrated codebase with student counselling, counsellor operations, campaign automation, and observability already implemented in one Next.js application.
