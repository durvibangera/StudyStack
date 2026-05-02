<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Gemini-2.5_Pro-4285F4?style=for-the-badge&logo=google" />
  <img src="https://img.shields.io/badge/ElevenLabs-Voice_AI-000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/MongoDB-9.0-47A248?style=for-the-badge&logo=mongodb" />
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss" />
</p>

<h1 align="center">📚 StudyStack</h1>
<h3 align="center"><em>Your AI Co-Pilot from Dream to Degree — and the Loan to Get There</em></h3>

<p align="center">
  An AI-native student engagement & education financing platform that replaces 10+ fragmented touchpoints with one intelligent ecosystem — from discovery to loan approval.
</p>

---

## 🧭 Table of Contents

- [Overview](#-overview)
- [Core Pillars](#-core-pillars)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [AI Architecture Deep Dive](#-ai-architecture-deep-dive)
- [User Journey](#-user-journey)
- [Data Models](#-data-models)
- [API Surface](#-api-surface)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Business Model](#-business-model)

---

## 🚀 Overview

StudyStack is a full-stack, AI-native platform built for Indian students planning postgraduate education — abroad (US, UK, Canada, Europe, Australia) or domestically (IIMs, ISB, top private universities).

It sits at the intersection of three underserved spaces:

```mermaid
graph LR
    A["🔍 Discovery & Planning"] -->|"Students don't know where to start"| D["📚 StudyStack"]
    B["🤝 Engagement & Trust"] -->|"Students drop off without value"| D
    C["💰 Financing"] -->|"Loans are opaque & intimidating"| D
    D -->|"Unified AI Experience"| E["🎓 Dream → Degree → Loan"]

    style D fill:#6366f1,stroke:#4f46e5,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
```

**Key differentiators:**
- **Voice-first profiling** via ElevenLabs — no forms, just conversation
- **Agentic marketing** — AI autonomously creates & publishes outreach content
- **Loan-native UX** — financing woven into the student journey, not bolted on
- **Memory across sessions** — the platform remembers every conversation & preference

---

## 🏛️ Core Pillars

```mermaid
mindmap
  root((StudyStack))
    🎤 AI Voice Counselling
      ElevenLabs + Gemini
      13-field profile extraction
      Memory-persistent sessions
      Real-time KYC checklist
    📊 Personalized Dashboard
      University recommendations
      7-step journey tracker
      Radar & wellbeing scores
      Action items by urgency
    💳 Loan Intelligence
      Eligibility estimator
      Dynamic NBFC offers
      ROI & EMI calculators
      AI application assistant
    📣 AI Campaign Engine
      Auto blog & social posts
      Exa.ai web research
      Multichannel publishing
      Bulk email via Resend
    👥 Counsellor Ops Hub
      Kanban lead board
      Session capture & AI summary
      Lead discovery via Exa.ai
      WhatsApp outreach
    🔄 Engagement Loops
      Streak-based completion
      Smart nudges
      Referral mechanics
      Gamified readiness score
```

---

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        S["Student Surface"]
        C["Counsellor Surface"]
    end

    subgraph API["⚡ API Orchestration — Next.js App Router"]
        VA["/api/voice-agent"]
        KYC["/api/kyc"]
        CAMP["/api/campaign"]
        LEAD["/api/leads"]
        EMAIL["/api/email"]
        LI["/api/linkedin"]
        TW["/api/twitter"]
        WA["/api/whatsapp"]
        LOAN["/api/loan"]
        AUDIT["/api/audit"]
        USER["/api/user"]
        BOOK["/api/bookings"]
    end

    subgraph AI["🧠 AI Service Layer"]
        G["Gemini 2.5 Pro/Flash"]
        EL["ElevenLabs Voice AI"]
        EXA["Exa.ai Neural Search"]
        IMG["Gemini Image + Veo"]
    end

    subgraph Data["💾 Data & Integration Layer"]
        DB[(MongoDB Atlas)]
        CLD["Cloudinary CDN"]
        RS["Resend / Gmail"]
        SOCIAL["LinkedIn & Twitter APIs"]
        WHAPI["Whapi Cloud"]
    end

    S --> API
    C --> API
    API --> AI
    API --> Data

    style Client fill:#1e1b4b,stroke:#6366f1,color:#fff
    style API fill:#0f172a,stroke:#38bdf8,color:#fff
    style AI fill:#4c1d95,stroke:#a78bfa,color:#fff
    style Data fill:#064e3b,stroke:#34d399,color:#fff
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4 | App shell, SSR, routing |
| **UI / UX** | Framer Motion, ReactFlow, Recharts, Three.js, GSAP | Animations, DAG canvas, charts, 3D, scroll effects |
| **State** | Zustand | Client-side state management |
| **Backend** | Next.js API Routes (TypeScript + JS) | All server-side logic |
| **Database** | MongoDB Atlas + Mongoose 9 | Persistent data |
| **Auth** | NextAuth 4.24 (JWT + Google OAuth) | Session management, RBAC |
| **Validation** | Zod 4 | Input schema enforcement |
| **AI — Reasoning** | Google Gemini 2.5 Pro / Flash | Dashboard, extraction, strategy, copy |
| **AI — Voice** | ElevenLabs Conversational AI | Live voice counselling |
| **AI — Images** | Gemini Image Model | Campaign creative generation |
| **AI — Video** | Google Veo (GenAI) | Video concept + generation |
| **AI — Research** | Exa.ai (Neural Web Search) | Grounded content, lead discovery |
| **Email** | Resend + Nodemailer (Gmail fallback) | Transactional + bulk email |
| **Social** | LinkedIn API, Twitter/X API v2 | Organic posting |
| **WhatsApp** | Whapi Cloud | Follow-ups, booking confirmations |
| **Media** | Cloudinary | Image hosting + CDN |
| **PDF** | jsPDF, pdf-parse, Tesseract.js | PDF generation, parsing, OCR |
| **Observability** | MongoDB AuditLog + JSONL agent logs | Full audit trail |

---

## 🧠 AI Architecture Deep Dive

### Voice Counselling Flow

```mermaid
sequenceDiagram
    participant Student
    participant ElevenLabs as ElevenLabs Voice AI
    participant Memory as Memory Endpoint
    participant Gemini as Gemini Flash
    participant DB as MongoDB
    participant WA as WhatsApp

    Student->>ElevenLabs: Opens voice session
    ElevenLabs->>Memory: Fetch student context
    Memory-->>ElevenLabs: Profile + 15 prior sessions

    loop Every ~30 seconds
        ElevenLabs->>Gemini: Live transcript chunk
        Gemini-->>DB: Extract & upsert KYC fields
        DB-->>Student: Live KYC checklist update
    end

    Student->>ElevenLabs: Ends session
    ElevenLabs->>Gemini: Full transcript
    Gemini-->>DB: Final extraction + lead score
    Gemini-->>DB: AI summary + follow-up Qs
    DB->>WA: Session summary to student
    DB->>DB: Notify counsellor with dossier
```

### Dashboard Analysis Flow

```mermaid
flowchart TD
    A["Student Profile ≥ 60% Complete"] --> B{"Cache fresh? < 24h"}
    B -->|Yes| C["Return cached analysis"]
    B -->|No| D["Gemini 2.5 Pro"]
    D --> E["Structured JSON Output"]
    E --> F["AI Insight Headline"]
    E --> G["4–8 University Recs"]
    E --> H["Action Items by Urgency"]
    E --> I["Wellbeing Scores"]
    E --> J["Radar Chart (5 axes)"]
    E --> K["6-Month Progress Trend"]
    E --> L["7-Step Journey Tracker"]

    style A fill:#6366f1,stroke:#4f46e5,color:#fff
    style D fill:#4285f4,stroke:#3367d6,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
```

### Agentic Campaign Workflow (DAG Execution)

```mermaid
flowchart LR
    A["📝 Campaign Brief"] --> B["✨ Brief Enhancement<br/>Gemini Pro"]
    B --> C["📋 Strategy Generation<br/>HTML Rationale"]
    C --> D["🔀 Workflow Graph<br/>Nodes + Edges"]
    D --> E["⚙️ Node Execution"]

    E --> F["📧 Email<br/>Resend Bulk"]
    E --> G["💼 LinkedIn<br/>API Post"]
    E --> H["🐦 Twitter/X<br/>API Post"]
    E --> I["💬 WhatsApp<br/>Whapi"]
    E --> J["🖼️ Image<br/>Gemini Image"]
    E --> K["🎬 Video<br/>Google Veo"]

    style A fill:#f59e0b,stroke:#d97706,color:#000
    style D fill:#6366f1,stroke:#4f46e5,color:#fff
    style E fill:#ec4899,stroke:#db2777,color:#fff
```

### AI Model Strategy

```mermaid
graph TD
    subgraph Pro["Gemini 2.5 PRO — High Reasoning"]
        P1["Dashboard analysis"]
        P2["Campaign strategy + workflow"]
        P3["Session summary + follow-ups"]
        P4["Loan eligibility narrative"]
    end

    subgraph Flash["Gemini 2.5 FLASH — Fast & Cheap"]
        F1["Live voice extraction (30s)"]
        F2["Brief enhancement"]
        F3["Node copy generation"]
        F4["Lead score computation"]
    end

    subgraph Media["Generative Media"]
        M1["Gemini Image → Campaign creatives"]
        M2["Google Veo → Video generation"]
    end

    subgraph External["External AI"]
        E1["ElevenLabs → Voice interactions"]
        E2["Exa.ai → Web research & leads"]
    end

    style Pro fill:#4c1d95,stroke:#7c3aed,color:#fff
    style Flash fill:#1e40af,stroke:#3b82f6,color:#fff
    style Media fill:#065f46,stroke:#10b981,color:#fff
    style External fill:#9a3412,stroke:#f97316,color:#fff
```

---

## 🗺️ User Journey

```mermaid
journey
    title Student Journey on StudyStack
    section Awareness
      See AI content on LinkedIn or Twitter: 3
    section Acquisition
      Landing page and Google OAuth signup: 5
    section Activation
      Voice Agent profile call: 5
      Dashboard unlocks: 4
    section Engagement
      Daily dashboard updates and nudges: 4
      Journey tracker progress: 4
    section Loan Discovery
      Loan intelligence activates at 70 pct: 5
      Eligibility check and personalized offers: 5
    section Conversion
      AI document checklist and lender app: 5
    section Retention
      Post-loan journey tracker and referral: 4
```

---

## 📦 Data Models

```mermaid
erDiagram
    User ||--o{ ConversationMemory : has
    User ||--o{ CounsellorSession : participates
    User ||--o| LoanApplication : applies
    User ||--o{ Booking : schedules
    Lead }o--|| User : "linked to"
    Campaign ||--|{ PastWorkflow : generates
    CounsellorSession ||--o{ ConversationMemory : references

    User {
        string name
        string email
        string role "student | counsellor"
        object studentProfile "13 KYC fields"
        object dashboardAnalysis "cached Gemini output"
        object socialTokens "LinkedIn, Twitter"
    }

    ConversationMemory {
        array transcriptSlices "up to 15 sessions"
        object extractedFacts "structured JSON"
        string summary
        string sentiment
    }

    Lead {
        string source "voice | form | import | web-research"
        number score "0–100"
        string stage "new | contacted | qualified | converted"
        boolean loanInterest
    }

    LoanApplication {
        number eligibilityScore
        array matchedOffers "NBFC + terms"
        object roiProjection
        array documentChecklist "per lender"
        string applicationStatus
    }

    CounsellorSession {
        string transcript
        string aiSummary
        array followUpQuestions
        boolean whatsappNotified
    }

    Campaign {
        string name
        string strategy
        array channels
    }

    PastWorkflow {
        array nodes "11 types"
        array edges
        object executionStatus
    }

    Booking {
        date scheduledAt
        string status
        string counsellorId
    }
```

---

## 🔌 API Surface

The platform exposes **22 API route groups** under `/api/`:

| Route Group | Key Endpoints | Purpose |
|:------------|:-------------|:--------|
| `voice-agent` | `memory`, `live-extract`, `end-session`, `anam-session` | Voice counselling lifecycle |
| `kyc` | Profile extraction & validation | Student KYC management |
| `user` | `dashboard-analysis`, profile CRUD | User data & AI dashboard |
| `loan` | Eligibility, offers, ROI, EMI, application | Loan intelligence layer |
| `campaign` | Brief, strategy, workflow execution | Agentic campaign engine |
| `leads` | Scoring, import, Kanban management | Lead management |
| `email` | Single & bulk send via Resend | Email outreach |
| `linkedin` | OAuth, post creation | LinkedIn integration |
| `twitter` | OAuth, tweet posting | Twitter/X integration |
| `whatsapp` | Send, poll, schedule | WhatsApp automation |
| `counsellor` | Session mgmt, assignment | Counsellor operations |
| `counsellor-sessions` | Capture, transcript, summary | Session intelligence |
| `bookings` | Schedule, manage | Appointment scheduling |
| `audit` | Logs, agent observability | Audit trail & monitoring |
| `workflows` | DAG save, load, execute | Campaign workflow persistence |
| `video-studio` | Veo generation pipeline | AI video creation |
| `cloudinary` | Upload, transform | Media management |
| `students` | Student listing & search | Student directory |

---

## 📁 Project Structure

```
StudyStack/
├── app/
│   ├── api/                    # 22 API route groups
│   │   ├── voice-agent/        # ElevenLabs + memory + extraction
│   │   ├── loan/               # Loan intelligence endpoints
│   │   ├── campaign/           # Agentic campaign engine
│   │   ├── leads/              # Lead scoring & management
│   │   ├── email/              # Resend integration
│   │   ├── linkedin/           # LinkedIn API
│   │   ├── twitter/            # Twitter/X API
│   │   ├── whatsapp/           # Whapi Cloud
│   │   └── ...                 # audit, bookings, user, etc.
│   ├── dashboard/              # Student & counsellor dashboards
│   │   ├── complete/           # Full analysis view
│   │   ├── counsellor/         # Counsellor operations hub
│   │   └── loan/               # Loan intelligence UI
│   ├── campaign/               # Campaign builder (DAG canvas)
│   ├── onboarding/             # Voice onboarding flow
│   ├── profile/                # User profile management
│   ├── merkle/                 # Merkle tree visualization
│   ├── audit/                  # Audit log viewer
│   ├── login/                  # Auth pages
│   └── page.js                 # Landing page (28KB of premium UI)
├── components/
│   ├── AnamVoiceAgent.jsx      # Voice agent component
│   ├── ElevenLabsVoiceAgent.jsx # ElevenLabs integration
│   ├── AICounsellingDashboard.jsx # 53KB dashboard component
│   ├── JourneyPath.jsx         # 7-step journey visualization
│   ├── LiveKYCChecklist.jsx    # Real-time KYC tracker
│   ├── StudentProfileCard.jsx  # Profile card with scores
│   ├── LiquidEther.jsx         # 3D background (Three.js)
│   ├── LaserFlow.jsx           # Animated flow visualization
│   ├── StaggeredMenu.jsx       # Animated navigation
│   ├── MerkleTreeVisualization.jsx # Data integrity viz
│   ├── campaign/               # Campaign-specific components
│   └── ui/                     # Radix UI primitives
├── lib/
│   ├── models/                 # 15 Mongoose models
│   ├── loan/                   # Loan calculation engine
│   ├── validations/            # Zod schemas
│   ├── whatsapp/               # WhatsApp helpers
│   ├── gemini.ts               # Gemini API client
│   ├── cloudinary.ts           # Cloudinary integration
│   ├── execution-engine.ts     # Campaign DAG executor
│   ├── audit-logger.ts         # Audit logging system
│   ├── agent-observability.ts  # AI agent monitoring
│   └── store.ts                # Zustand state store
└── public/                     # Static assets
```

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **MongoDB Atlas** cluster (or local MongoDB)
- API keys: Google Gemini, ElevenLabs, Exa.ai, Resend, Cloudinary

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/StudyStack.git
cd StudyStack/StudyStack

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your API keys (see Environment Variables section)

# Run the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 🔐 Environment Variables

Create a `.env` file in the `StudyStack/` directory:

```env
# Database
MONGODB_URI=mongodb+srv://...

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# AI Services
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
EXA_API_KEY=...

# Email
RESEND_API_KEY=...

# Social
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
TWITTER_API_KEY=...
TWITTER_API_SECRET=...

# WhatsApp
WHAPI_TOKEN=...

# Media
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 💼 Business Model

```mermaid
pie title Revenue Streams (Month 12 Projection)
    "Loan Commissions ₹2.5Cr" : 45
    "B2B SaaS Licenses ₹1.5Cr" : 27
    "Premium Subscriptions ₹50L" : 9
    "Other" : 19
```

| Stream | Model | Month 12 Target |
|:-------|:------|:----------------|
| **Loan Referral** | 0.5–1.5% of loan value per NBFC referral | ₹2.5 Cr/mo |
| **B2B SaaS** | ₹15K–50K/mo per agency seat | ₹1.5 Cr/mo |
| **Premium Sub** | ₹999/mo or ₹4,999 one-time | ₹50L/mo |

**Growth Trajectory:**

| Metric | Month 6 | Month 12 | Month 24 |
|:-------|:--------|:---------|:---------|
| Registered Users | 50K | 200K | 800K |
| Monthly Active Users | 15K | 80K | 300K |
| Loan Referrals/mo | 50 | 500 | 3,000 |
| **Total MRR** | **₹50L** | **₹4.5 Cr** | **₹28 Cr** |

---

<p align="center">
  <strong>StudyStack</strong> · Next.js 16 · React 19 · Gemini 2.5 · ElevenLabs · Exa.ai · MongoDB
  <br/>
  <em>Built with ❤️ for Indian students chasing their dreams</em>
</p>
