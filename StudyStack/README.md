# 📚 StudyStack — AI-Powered Study Abroad Platform

> **An end-to-end AI counselling platform for overseas education**, combining real-time voice AI avatars, automated KYC extraction, intelligent loan matching, WhatsApp integration, and a full counsellor CRM — built on Next.js 16, MongoDB, Anam AI, Google Gemini, and ElevenLabs.

---

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph Client["🖥️ Client (Next.js App Router)"]
        LP[Landing Page]
        OB[Onboarding Flow]
        SD[Student Dashboard]
        CD[Complete Dashboard]
        CL[Counsellor Dashboard]
        LA[Loan Assistant]
    end

    subgraph VoiceAI["🎙️ Voice AI Layer"]
        ANAM[Anam AI SDK<br/>Live Avatar]
        EL[ElevenLabs<br/>Fallback Agent]
        FC[Floating Counsellor<br/>On-Demand Buddy]
    end

    subgraph APIs["⚙️ API Routes (Next.js)"]
        AS[anam-session]
        LE[live-extract]
        EK[extract-kyc]
        CV[conversations]
        MM[memory]
        KYC[kyc]
        WA[whatsapp/poll]
        LN[loan/*]
        DA[dashboard/analyze]
        COS[counsellor-sessions]
    end

    subgraph AI["🧠 AI Services"]
        GEM[Google Gemini 2.5<br/>Flash / Pro]
        ANAM_API[Anam AI API<br/>Avatar + LLM]
        EL_API[ElevenLabs API]
    end

    subgraph Storage["💾 Data Layer"]
        MONGO[(MongoDB Atlas)]
        CLOUD[Cloudinary<br/>Media Storage]
    end

    subgraph External["🌐 External Services"]
        GAUTH[Google OAuth 2.0]
        WHAPI[WhatsApp Business<br/>via WHAPI]
        MAIL[Email via Resend]
    end

    LP --> OB
    OB --> SD
    SD --> CD
    SD --> ANAM
    SD --> EL
    CD --> FC
    CD --> LA

    ANAM --> AS
    ANAM --> LE
    ANAM --> EK
    ANAM --> CV
    FC --> AS

    AS --> ANAM_API
    AS --> GEM
    LE --> GEM
    EK --> GEM
    DA --> GEM
    MM --> GEM

    KYC --> MONGO
    CV --> MONGO
    COS --> MONGO
    LN --> MONGO
    WA --> WHAPI

    CV --> CLOUD
    GAUTH --> SD
```

---

## 🧩 System Flow — Student Journey

```mermaid
sequenceDiagram
    participant S as Student
    participant App as StudyStack App
    participant Anam as Anam AI Avatar
    participant Gemini as Google Gemini
    participant DB as MongoDB

    S->>App: Sign in (Google OAuth)
    App->>DB: Check KYC status

    alt New Student
        App->>S: Show Avatar Picker + Method Selection
        S->>App: Choose "Talk to Aria" (Voice)
        App->>Anam: Create session (system prompt + tools)
        Anam->>S: "Hey! I'm Aria. What's your name?"
        
        loop Every 8-12 seconds
            Anam-->>App: Transcript chunk
            App->>Gemini: Extract KYC fields
            Gemini-->>App: Extracted fields JSON
            App->>DB: Merge into studentProfile
        end

        S->>App: Click "End Session"
        App->>Gemini: Final KYC extraction
        App->>DB: Save ConversationMemory
        App->>S: Show Student Dashboard
    end

    alt Returning Student (Partial KYC)
        App->>DB: Load profile + conversations
        App->>Gemini: Build resume plan
        App->>Anam: Session with resume context
        Anam->>S: "Welcome back! I just need your budget and timeline..."
    end

    alt KYC Complete
        App->>S: Show Complete Dashboard
        App->>Gemini: AI analysis (readiness, universities)
        S->>App: Click Floating Counsellor (FAB)
        App->>Anam: Buddy mode session
        Anam->>S: "Ask me anything about your applications!"
    end
```

---

## 📋 Feature Matrix

### 👨‍🎓 Student Features

| Feature | Description | Tech |
|---------|-------------|------|
| **Google OAuth Login** | One-click sign-in via Google | NextAuth.js + Google Provider |
| **Avatar Picker** | Choose a superhero avatar guide (Hulk, Iron Man, Thor, Spider-Man) | Custom React component |
| **AI Voice Onboarding** | Aria (AI avatar) conducts a natural voice conversation to collect 13 KYC fields | Anam AI SDK + Gemini |
| **Multilingual Support** | Automatically detects Hindi, Marathi, Tamil, Kannada, Urdu and switches | Anam `change_language` tool |
| **Live KYC Extraction** | Fields are extracted in real-time every 8–12 seconds during conversation | Gemini 2.5 Flash |
| **Session Resume** | If interrupted, the AI picks up exactly where you left off, no re-asking | ConversationMemory + Gemini resume planner |
| **Periodic Auto-Save** | Conversation messages saved every 30 seconds automatically | Auto-save interval + sendBeacon |
| **Complete Dashboard** | Rich analytics: readiness score, radar chart, budget breakdown, AI wellbeing | Recharts + Gemini Pro analysis |
| **University Matching** | AI-powered university recommendations with match scores | Gemini web search + grounding |
| **Journey Path** | Visual step-by-step path: Test → Apply → Visa → Travel | Dynamic steps from Gemini |
| **Floating Counsellor** | Always-available "Talk to Aria" FAB for on-demand counselling | FloatingCounsellor + buddy mode |
| **Loan Assistant** | Education loan eligibility, EMI calculator, offer comparison, document checklist | Custom loan engine |
| **WhatsApp Booking** | Schedule 1:1 counselling sessions via WhatsApp | WHAPI integration |
| **Session Recording** | Voice sessions are recorded and stored for playback | MediaRecorder + Cloudinary |

### 👩‍💼 Counsellor Features

| Feature | Description | Tech |
|---------|-------------|------|
| **Counsellor Dashboard** | Full CRM view of all student leads | Custom React dashboard |
| **Student Analytics** | Profile completeness, readiness scores, conversation history | Gemini analysis API |
| **Session Logs** | Browse all past voice conversations with transcripts | ConversationMemory model |
| **Lead Management** | Track, filter, and prioritize student leads | Lead model + API |
| **Campaign Manager** | Create and manage outreach campaigns | Campaign model + workflows |
| **Booking Calendar** | View and manage 1:1 session bookings | Booking model |
| **WhatsApp Integration** | Receive and respond to student messages | WHAPI polling |

### 🛡️ Platform Features

| Feature | Description | Tech |
|---------|-------------|------|
| **Audit Logging** | Every significant action is logged with timestamps | AuditLog model |
| **Agent Observability** | Track AI agent performance, latency, token usage | Custom observability lib |
| **Role-Based Access** | Student vs Counsellor views with proper authorization | NextAuth roles |
| **Dark/Light Mode** | Full theme support with system preference detection | next-themes |
| **Responsive Design** | Mobile-first, works on all screen sizes | Tailwind CSS v4 |
| **3D Landing Page** | Immersive landing with Three.js + GSAP animations | React Three Fiber |

---

## 🗄️ Database Schema

```mermaid
erDiagram
    User ||--o{ ConversationMemory : has
    User ||--o| LoanApplication : applies
    User ||--o{ Booking : books
    User ||--o{ Lead : generates
    User {
        ObjectId _id
        string name
        string email
        string role
        boolean hasCompletedKYC
        object studentProfile
        date createdAt
    }
    ConversationMemory {
        ObjectId _id
        string userId
        string conversationId
        string mode
        string summary
        Map extractedFacts
        array messages
        number callDurationSecs
        date createdAt
    }
    LoanApplication {
        ObjectId _id
        string userId
        string status
        object personalInfo
        object academicInfo
        object loanDetails
        array documents
        date createdAt
    }
    CounsellorSession {
        ObjectId _id
        string counsellorId
        string studentId
        string status
        string notes
        date scheduledAt
    }
    Booking {
        ObjectId _id
        string userId
        string counsellorId
        string type
        date scheduledAt
        string status
    }
    Lead {
        ObjectId _id
        string source
        string studentId
        string status
        object data
    }
    Campaign {
        ObjectId _id
        string name
        string type
        string status
        array targets
        object metrics
    }
    AuditLog {
        ObjectId _id
        string userId
        string action
        object metadata
        date timestamp
    }
```

---

## 🎙️ Voice AI Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI[AnamVoiceAgent<br/>Component]
        VID[Video Element<br/>Avatar Stream]
        MIC[Microphone<br/>Audio Input]
        REC[MediaRecorder<br/>Session Recording]
    end

    subgraph Server["Next.js API Routes"]
        SESS["/api/voice-agent/anam-session"<br/>Creates session token + prompt]
        LIVE["/api/voice-agent/live-extract"<br/>Real-time field extraction]
        CONV["/api/voice-agent/conversations"<br/>Save conversation memory]
        EKYC["/api/voice-agent/extract-kyc"<br/>Final KYC extraction]
        MEM["/api/voice-agent/memory"<br/>Build resume context]
    end

    subgraph External
        ANAM_SVC["Anam AI<br/>Avatar + WebRTC"]
        GEMINI["Gemini 2.5 Flash<br/>NLP Extraction"]
    end

    UI -->|"POST (mode, resumeContext)"| SESS
    SESS -->|"session token"| ANAM_SVC
    ANAM_SVC -->|"WebRTC stream"| VID
    MIC -->|"audio"| ANAM_SVC

    UI -->|"transcript (every 8-12s)"| LIVE
    LIVE -->|"extract fields"| GEMINI
    LIVE -->|"merge profile"| DB[(MongoDB)]

    UI -->|"on close / auto-save"| CONV
    UI -->|"final extraction"| EKYC
    EKYC -->|"extract all fields"| GEMINI

    UI -->|"resume call"| MEM
    MEM -->|"build plan"| GEMINI

    VID --> REC
    REC -->|"upload"| CLD[Cloudinary]
```

### Voice Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Loading: Component mounts
    Loading --> Connecting: Session token received
    Connecting --> Connected: WebRTC established
    Connected --> Connected: Live extraction loop (8-12s)
    Connected --> Connected: Auto-save (30s)
    Connected --> Extracting: User clicks End Session
    Extracting --> Disconnected: KYC saved
    Connected --> Disconnected: Connection closed
    Connected --> Error: WebRTC failure
    Disconnected --> [*]: onComplete callback
    Error --> Loading: User clicks Retry
    Error --> [*]: User closes
```

---

## 📁 Project Structure

```
StudyStack/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # Google OAuth handler
│   │   ├── kyc/                     # KYC CRUD (GET/POST/PUT)
│   │   ├── voice-agent/
│   │   │   ├── anam-session/        # Create Anam session + build prompt
│   │   │   ├── live-extract/        # Real-time transcript → field extraction
│   │   │   ├── extract-kyc/         # Final KYC extraction on session end
│   │   │   ├── conversations/       # Save/load conversation memories
│   │   │   ├── memory/              # Build context + resume plan
│   │   │   ├── recordings/          # Upload session recordings
│   │   │   ├── end-session/         # Graceful session teardown
│   │   │   ├── elevenlabs-token/    # ElevenLabs signed URL (fallback)
│   │   │   └── submit-kyc-elevenlabs/ # Legacy ElevenLabs KYC endpoint
│   │   ├── dashboard/analyze/       # Gemini-powered dashboard analysis
│   │   ├── loan/                    # Loan eligibility, EMI, offers, documents
│   │   ├── counsellor/              # Counsellor management APIs
│   │   ├── counsellor-sessions/     # Session scheduling & management
│   │   ├── bookings/                # Booking CRUD
│   │   ├── leads/                   # Lead management
│   │   ├── campaign/                # Campaign CRUD + analytics
│   │   ├── whatsapp/poll/           # WhatsApp message polling
│   │   ├── email/                   # Email sending via Resend
│   │   ├── students/                # Student management APIs
│   │   ├── audit/                   # Audit log APIs
│   │   └── cloudinary/              # Media upload/management
│   ├── dashboard/
│   │   ├── page.js                  # Student dashboard (KYC in-progress)
│   │   ├── layout.js                # Dashboard layout + nav + poller
│   │   ├── complete/
│   │   │   ├── page.js              # Complete dashboard (post-KYC analytics)
│   │   │   └── counsellor-session/  # Full-screen counsellor session page
│   │   ├── counsellor/
│   │   │   ├── page.js              # Counsellor CRM dashboard
│   │   │   ├── logs/                # Conversation logs viewer
│   │   │   └── components/          # Counsellor-specific components
│   │   └── loan/                    # Loan application pages
│   ├── onboarding/                  # Manual onboarding form (alternative)
│   ├── login/                       # Login page
│   ├── auth/                        # Auth pages
│   ├── campaign/                    # Campaign pages
│   ├── merkle/                      # Merkle tree visualization (data integrity)
│   ├── audit/                       # Audit log viewer
│   ├── profile/                     # User profile page
│   ├── page.js                      # Landing page (3D + animations)
│   └── layout.js                    # Root layout
├── components/
│   ├── AnamVoiceAgent.jsx           # Core voice agent (Anam AI integration)
│   ├── ElevenLabsVoiceAgent.jsx     # Fallback voice agent (ElevenLabs)
│   ├── FloatingCounsellor.jsx       # On-demand FAB counsellor button
│   ├── LiveKYCChecklist.jsx         # Real-time KYC progress checklist
│   ├── AICounsellingDashboard.jsx   # Counsellor analytics dashboard
│   ├── StudentProfileCard.jsx       # Student profile display card
│   ├── CounsellingSidebarCard.jsx   # Counselling progress sidebar
│   ├── JourneyPath.jsx              # Visual study abroad journey path
│   ├── WhatsAppPoller.jsx           # Background WhatsApp message poller
│   ├── WhatsAppScheduleCard.jsx     # WhatsApp 1:1 booking card
│   ├── StaggeredMenu.jsx            # Animated sidebar navigation
│   ├── ModelViewer.jsx              # 3D model viewer (Three.js)
│   ├── LiquidEther.jsx              # Liquid animation effects
│   ├── LaserFlow.jsx                # Laser particle effects
│   ├── MerkleTreeVisualization.jsx  # Merkle tree data integrity UI
│   └── ui/                          # Reusable UI primitives (shadcn)
├── lib/
│   ├── counselling-profile.js       # Field definitions, normalization, merging
│   ├── mongodb.js                   # MongoDB connection singleton
│   ├── models/                      # Mongoose schema definitions
│   │   ├── User.js
│   │   ├── ConversationMemory.js
│   │   ├── LoanApplication.ts
│   │   ├── CounsellorSession.js
│   │   ├── Booking.js
│   │   ├── Lead.js
│   │   ├── Campaign.js
│   │   ├── AuditLog.js
│   │   └── ...
│   ├── gemini.ts                    # Gemini AI client wrapper
│   ├── cloudinary.ts                # Cloudinary upload utilities
│   ├── agent-observability.ts       # AI agent performance tracking
│   ├── audit-logger.ts              # Audit logging utilities
│   ├── execution-engine.ts          # Workflow execution engine
│   ├── loan/                        # Loan calculation logic
│   ├── whatsapp/                    # WhatsApp message handling
│   └── validations/                 # Zod validation schemas
└── public/                          # Static assets (avatars, images)
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `NEXTAUTH_SECRET` | ✅ | NextAuth.js session encryption key |
| `NEXTAUTH_URL` | ✅ | Application URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `ANAM_AI_API_KEY` | ✅ | Anam AI API key for avatar sessions |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for NLP |
| `ELEVENLABS_API_KEY` | ⚠️ | ElevenLabs API key (fallback voice agent) |
| `ELEVENLABS_AGENT_ID` | ⚠️ | ElevenLabs agent ID (fallback) |
| `WHAPI_TOKEN` | ⬡ | WHAPI token for WhatsApp integration |
| `CLOUDINARY_CLOUD_NAME` | ⬡ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ⬡ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ⬡ | Cloudinary API secret |
| `RESEND_API_KEY` | ⬡ | Resend API key for emails |

> ✅ = Required | ⚠️ = Recommended | ⬡ = Optional

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (free tier works)
- Google Cloud Console project with OAuth 2.0 credentials
- Anam AI account and API key
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/StudyStack.git
cd StudyStack

# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### First-Time Setup

1. **MongoDB Atlas**: Create a cluster, whitelist your IP, create a database user
2. **Google OAuth**: Create credentials in Google Cloud Console, add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI
3. **Anam AI**: Sign up at [anam.ai](https://anam.ai), get your API key
4. **Gemini**: Get API key from [Google AI Studio](https://aistudio.google.com)

---

## 🎯 Key Technical Decisions

### Why Anam AI over ElevenLabs?
- **Visual Avatar**: Anam provides a real-time rendered avatar that speaks, creating a more engaging counselling experience
- **WebRTC Streaming**: Lower latency than REST-based TTS/STT
- **System Tools**: Built-in language switching (`change_language`) for multilingual students
- **Custom LLM Routing**: Supports injecting system prompts with full student context

### Why Gemini for Extraction?
- **Structured Output**: Gemini 2.5 Flash excels at extracting structured data (JSON) from conversational text
- **Speed**: Flash variant processes transcripts in 1-3 seconds, suitable for live extraction
- **Multilingual**: Handles Hindi, Marathi, Hinglish natively without translation
- **Web Grounding**: Gemini Pro with search for university recommendations

### Session Persistence Strategy
```mermaid
flowchart TD
    A[Conversation Started] --> B{Every 8-12s}
    B --> C[Live Extract API]
    C --> D[Gemini extracts fields]
    D --> E[Merge into studentProfile]
    E --> F[Save ConversationMemory snapshot]
    
    A --> G{Every 30s}
    G --> H[Auto-save messages to DB]
    
    A --> I{On Close / Unload}
    I --> J[sendBeacon to save]
    
    A --> K{Connection Dropped}
    K --> L[Guard prevents double-save]
    L --> M[Save once, mark saved]
    
    N[Resume Call] --> O[Load ConversationMemory]
    O --> P[Gemini builds resume plan]
    P --> Q[Inject context into system prompt]
    Q --> R["Aria: Welcome back! I just need..."]
```

---

## 🏛️ Counsellor CRM Architecture

```mermaid
flowchart TB
    subgraph CRM["Counsellor Dashboard"]
        LV[Lead View<br/>All Students]
        SA[Student Analytics<br/>Profile + Readiness]
        CL[Conversation Logs<br/>Full Transcripts]
        BK[Booking Manager<br/>1:1 Sessions]
        CP[Campaign Manager<br/>Outreach]
    end

    subgraph Data
        LD[(Leads)]
        UM[(Users)]
        CM[(Conversations)]
        BM[(Bookings)]
        CA[(Campaigns)]
    end

    LV --> LD
    LV --> UM
    SA --> UM
    SA --> CM
    CL --> CM
    BK --> BM
    CP --> CA
```

---

## 💰 Loan Assistant Architecture

```mermaid
flowchart LR
    subgraph Input["Student Input"]
        PROFILE[Student Profile<br/>from KYC]
        LOAN_REQ[Loan Requirements<br/>Amount + Country]
    end

    subgraph Engine["Loan Engine"]
        ELIG[Eligibility Check<br/>Credit + Collateral]
        EMI[EMI Calculator<br/>Rate + Tenure]
        MATCH[Offer Matcher<br/>Bank Database]
        DOC[Document Checklist<br/>Per Bank]
    end

    subgraph Output
        OFFERS[Matched Offers<br/>with Comparison]
        STATUS[Application Status<br/>Tracker]
        DOCS[Required Documents<br/>Checklist]
    end

    PROFILE --> ELIG
    LOAN_REQ --> ELIG
    ELIG --> EMI
    ELIG --> MATCH
    MATCH --> OFFERS
    MATCH --> DOC
    DOC --> DOCS
    OFFERS --> STATUS
```

### Loan API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/loan/eligibility` | POST | Check loan eligibility based on profile |
| `/api/loan/emi` | POST | Calculate EMI for given loan parameters |
| `/api/loan/offers` | GET | Get matched loan offers |
| `/api/loan/search-offers` | POST | Search and filter loan offers |
| `/api/loan/document-checklist` | GET | Get required documents per lender |
| `/api/loan/application-status` | GET/PUT | Track application progress |
| `/api/loan/roi` | POST | Calculate return on investment |

---

## 🔄 WhatsApp Integration Flow

```mermaid
sequenceDiagram
    participant S as Student
    participant WA as WhatsApp
    participant WHAPI as WHAPI Server
    participant App as StudyStack
    participant DB as MongoDB

    Note over App: WhatsAppPoller runs in background

    loop Every 5s (with exponential backoff)
        App->>WHAPI: GET /api/whatsapp/poll
        WHAPI-->>App: New messages (if any)
        App->>DB: Process & store messages
    end

    S->>WA: "I want to book a session"
    WA->>WHAPI: Webhook/poll
    WHAPI-->>App: Message received
    App->>DB: Create booking request
    App->>WHAPI: Send confirmation
    WHAPI->>WA: "Your session is booked for..."
    WA->>S: Confirmation message
```

---

## 📊 Dashboard Analytics (Gemini-Powered)

The complete dashboard uses **Gemini 2.5 Pro** to generate personalized analysis:

| Analysis | Description |
|----------|-------------|
| **Readiness Score** | Weighted composite score (0-100) across academics, language, finances, clarity, timeline |
| **Radar Chart** | 5-axis profile strength visualization |
| **University Matches** | Real universities found via Gemini web search with match % |
| **Wellbeing Scores** | AI-assessed focus, confidence, and stress levels |
| **Budget Breakdown** | Estimated tuition, living, travel, misc allocation |
| **Progress Trend** | Month-over-month readiness improvement chart |
| **Personalized Recommendations** | Categorized action items (academic, test, financial, documents, visa) |
| **Journey Steps** | Dynamic study abroad roadmap based on missing profile gaps |
| **Session Suggestions** | Recommended follow-up counselling topics |

---

## 🛡️ Security & Data Integrity

- **Authentication**: Google OAuth 2.0 via NextAuth.js with JWT sessions
- **Authorization**: Role-based access (student / counsellor) enforced server-side
- **Data Validation**: Zod schemas for all API inputs
- **Audit Trail**: Every significant action logged with userId, timestamp, and metadata
- **Merkle Tree**: Data integrity verification for critical records
- **Session Tokens**: Anam AI session tokens are short-lived and server-generated
- **CORS**: API routes are same-origin only
- **Environment Isolation**: All secrets stored in `.env`, never exposed to client

---

## 🧪 KYC Field Extraction Pipeline

The 13 counselling fields extracted through voice conversation:

| # | Field | Key | Example |
|---|-------|-----|---------|
| 1 | Student Name | `studentName` | "Priya Sharma" |
| 2 | Phone Number | `phoneNumber` | "+91 98765 43210" |
| 3 | Email | `contactEmail` | "priya@gmail.com" |
| 4 | Location | `currentLocation` | "Mumbai, Maharashtra" |
| 5 | Education Level | `educationLevel` | "Bachelor's" |
| 6 | Field of Study | `fieldOfStudy` | "Computer Science" |
| 7 | Institution | `institution` | "Mumbai University" |
| 8 | GPA / Percentage | `gpaPercentage` | "8.1 CGPA" |
| 9 | Target Countries | `targetCountries` | ["UK", "Ireland"] |
| 10 | Course Interest | `courseInterest` | "MSc Data Science" |
| 11 | English Test Status | `englishTestStatus` | "IELTS preparing" |
| 12 | Budget Range | `budgetRange` | "₹20-30 Lakhs" |
| 13 | Application Timeline | `applicationTimeline` | "Within 3 months" |

### Extraction Rules
- **Phone numbers**: Supports Hindi word-to-digit conversion ("double nine" → "99", "paanch" → "5")
- **Email**: Validated with regex, lowercased
- **Arrays**: Target countries split on commas/semicolons and deduplicated
- **Merge Logic**: New values only replace old values if they're more specific (calculated via specificity score)
- **Placeholder Detection**: Values like "not sure", "N/A", "pending" are treated as empty

---

## 🏃 Development

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint
```

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| UI | React + Tailwind CSS | 19.x / 4.x |
| Database | MongoDB + Mongoose | Atlas / 9.x |
| Auth | NextAuth.js | 4.x |
| Voice AI | Anam AI JS SDK | 4.13+ |
| Fallback Voice | ElevenLabs React | 1.x |
| NLP / LLM | Google Gemini | 2.5 Flash/Pro |
| 3D Graphics | Three.js + React Three Fiber | 0.180 |
| Animations | Framer Motion + GSAP | 12.x / 3.x |
| Charts | Recharts | 2.x |
| Media | Cloudinary | 2.x |
| Email | Resend | 4.x |
| WhatsApp | WHAPI | REST API |
| State | Zustand | 5.x |
| Validation | Zod | 4.x |

---

## 📝 License

This project is private and proprietary. All rights reserved.

---

<p align="center">
  Built with ❤️ by the StudyStack team
</p>
