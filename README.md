# StudyStack — AI-Native Student Engagement & Education Financing Platform
### Solution Deck | Hackathon Submission

---

## SLIDE 1 — IDEA TITLE & PROPOSED SOLUTION

**Platform Name:** StudyStack (powered by GradPilot)
**Tagline:** *"Your AI co-pilot from dream to degree — and the loan to get there."*

### What Is StudyStack?

StudyStack is a full-stack, AI-native engagement platform built for Indian students planning postgraduate education — both abroad (US, UK, Canada, Europe, Australia) and domestically (IIMs, ISB, top private universities). It functions as a unified ecosystem that guides a student from initial exploration all the way to an approved education loan application, with zero hand-holding required from human agents unless the student explicitly wants it.

The platform sits at the intersection of three underserved spaces:
1. **Discovery & Planning** — students don't know where to start
2. **Engagement & Trust** — students drop off without continuous value
3. **Financing** — loan awareness and application is fragmented, opaque, and intimidating

StudyStack addresses all three in a single product experience, powered by a constellation of AI models, voice agents, agentic workflows, and multichannel execution engines.

### How It Addresses the Problem

The problem statement calls for a platform that acts like SoFi for students — a sticky, AI-led ecosystem that drives **awareness → engagement → trust → conversion (loan)**.

StudyStack delivers this through five interlocking surfaces:

| Surface | What it does |
|---|---|
| **AI Voice Counsellor** | Conducts natural conversations to profile the student, recommend universities, and surface loan options |
| **Smart Dashboard** | Personalized analysis, 7-step journey tracker, readiness scores, university shortlist |
| **Loan Intelligence Layer** | Eligibility estimator, dynamic loan offers, EMI calculator, document checklist |
| **AI Campaign Engine** | Acquires and re-engages users via AI-generated email, social, and WhatsApp content |
| **Counsellor Operations Hub** | Backs the platform with real human counsellors for high-intent users |

### Innovation & Uniqueness

- **Voice-first profiling:** Unlike form-heavy competitors (Leverage Edu, Yocket), StudyStack profiles students through a live ElevenLabs voice agent — more human, more data, less drop-off
- **Agentic marketing:** AI autonomously generates and publishes outreach content across LinkedIn, Twitter/X, and email without human involvement
- **Loan-native UX:** Loan discovery is woven into the student journey rather than bolted on as an afterthought
- **Memory across sessions:** The platform remembers every conversation, every preference, every concern — creating a relationship, not a transaction

---

## SLIDE 2 — OUTLINE OF UNIQUE & INNOVATIVE SOLUTION

### The StudyStack Difference: 6 Core Pillars

---

**PILLAR 1 — AI Voice Counselling (ElevenLabs + Gemini)**
Most edtech platforms force students to fill long forms. StudyStack instead opens a live voice conversation. The ElevenLabs Conversational AI agent:
- Speaks naturally, asks contextual follow-ups
- Extracts 13 structured data points in real time (name, GPA, test scores, budget, countries, timeline, etc.)
- Injects the student's prior history into every new session (memory-persistent)
- Hands off a complete, scored lead profile to counsellors

**PILLAR 2 — AI-Powered Personalized Dashboard**
Gemini 2.5 Pro generates a fully personalized dashboard for each student:
- 4–8 real university recommendations with match scores, tuition ranges, scholarship info, and deadlines
- 7-step journey tracker (Profile → Test Prep → Shortlist → SOP → Application → Visa → Departure)
- Radar chart across 5 dimensions: Academics, Language, Finances, Clarity, Timeline
- Wellbeing scores (Focus, Confidence, Stress) based on profile and timeline pressure
- Specific action recommendations by urgency (Urgent / Important / Optional)

**PILLAR 3 — Loan Intelligence Layer** *(new module, extending existing platform)*
Built on top of the student profile already collected:
- **Loan Eligibility Estimator:** Based on GPA, target country, program, family income, co-applicant status
- **Dynamic Loan Offers:** Ranked NBFC/bank options (Auxilo, Avanse, HDFC Credila, ICICI Bank, Prodigy Finance) matched to student profile
- **ROI Calculator:** Expected post-degree salary vs total loan cost with payback period
- **EMI Planner:** Multiple repayment scenarios (moratorium, partial disbursement, interest-only)
- **AI-Assisted Application Flow:** Document checklist, auto-fill support, status tracker
- **Admission Probability Predictor:** Score-based likelihood estimate for target programs

**PILLAR 4 — AI Growth & Acquisition Engine**
The platform auto-generates and executes outreach campaigns:
- AI writes blogs, reels scripts, newsletters, and LinkedIn posts using Gemini
- Exa.ai powers web research to ground content in real university stats and market data
- Bulk email campaigns via Resend with personalized subject lines per segment
- Twitter/X and LinkedIn auto-posting with media (AI-generated images via Gemini Image)
- WhatsApp follow-up automation (session summaries, reminders, booking confirmations)

**PILLAR 5 — Engagement & Retention Loops**
- Streak-based profile completion incentive (unlock deeper analysis at each milestone)
- Smart nudges: WhatsApp/email triggered by journey stage (e.g., "You haven't updated your GRE score — deadlines for Cornell are in 6 weeks")
- Referral mechanic: Invite a friend, both get a premium counselling session credit
- Gamified readiness score that updates in real time as the student fills their profile

**PILLAR 6 — Counsellor Operations & Lead Intelligence**
- Kanban lead board with AI-computed scores (Hot ≥75, Warm 50–74, Cold <50)
- Live session capture with full transcript, AI summary, and follow-up questions
- Web-research-powered lead discovery (Exa.ai scrapes forums, Reddit, Quora for prospective students)
- Bulk lead import + automated WhatsApp outreach to imported leads

---

## SLIDE 3 — TECHNICAL APPROACH

### Technologies Used

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4 | App shell, SSR, routing |
| **UI Components** | Framer Motion, ReactFlow, Recharts, Three.js | Animations, DAG canvas, charts, 3D |
| **Backend** | Next.js API Routes (TypeScript) | All server-side logic |
| **Database** | MongoDB + Mongoose 9.0 | All persistent data |
| **Auth** | NextAuth 4.24 (JWT + Google OAuth) | Session management, RBAC |
| **Validation** | Zod 4 | Input schema enforcement |
| **AI — Reasoning** | Google Gemini 2.5 Pro / Flash | Dashboard, extraction, strategy, copy |
| **AI — Voice** | ElevenLabs Conversational AI | Live voice counselling agent |
| **AI — Images** | Gemini Image Model | Campaign creative generation |
| **AI — Video** | Google Veo (GenAI) | Video concept + generation |
| **AI — Research** | Exa.ai (neural web search) | Grounded content, lead discovery |
| **Email** | Resend (primary), Gmail SMTP (fallback) | Transactional + bulk email |
| **Social** | LinkedIn API, Twitter/X API v2 | Organic posting |
| **WhatsApp** | Whapi Cloud | Student follow-ups, booking |
| **Media Storage** | Cloudinary | Image hosting + CDN |
| **Observability** | MongoDB AuditLog + JSONL agent logs | Full API + agent audit trail |

---

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STUDYSTACK PLATFORM                            │
│                    (Next.js 16 — App Router)                            │
│                                                                         │
│  ┌────────────────────────┐    ┌──────────────────────────────────────┐ │
│  │   STUDENT SURFACE      │    │      COUNSELLOR / GROWTH SURFACE     │ │
│  │                        │    │                                      │ │
│  │  • Voice Onboarding    │    │  • Lead Kanban Board                 │ │
│  │  • Profile Dashboard   │    │  • Campaign Builder (DAG)            │ │
│  │  • Loan Intelligence   │    │  • Session Capture & Summary         │ │
│  │  • Journey Tracker     │    │  • WhatsApp Outreach                 │ │
│  │  • ROI / EMI Calc      │    │  • Audit & Observability             │ │
│  └──────────┬─────────────┘    └────────────┬─────────────────────────┘ │
│             │                               │                           │
│  ┌──────────▼───────────────────────────────▼─────────────────────────┐ │
│  │                    API ORCHESTRATION LAYER                          │ │
│  │  /api/voice-agent  /api/kyc  /api/campaign  /api/leads             │ │
│  │  /api/email  /api/linkedin  /api/twitter  /api/whatsapp            │ │
│  │  /api/loan  /api/audit  /api/user  /api/bookings                   │ │
│  └───────────────────────────┬────────────────────────────────────────┘ │
│                              │                                          │
│  ┌───────────────────────────▼────────────────────────────────────────┐ │
│  │                    AI SERVICE LAYER                                 │ │
│  │                                                                     │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐  │ │
│  │  │  Gemini 2.5  │ │  ElevenLabs  │ │   Exa.ai   │ │ Gemini Img │  │ │
│  │  │  Pro/Flash   │ │   Voice AI   │ │  Web Search│ │  + Veo     │  │ │
│  │  │              │ │              │ │            │ │            │  │ │
│  │  │ Reasoning    │ │ Live Voice   │ │ Research   │ │ Campaign   │  │ │
│  │  │ Extraction   │ │ Counselling  │ │ Lead Disc. │ │ Creatives  │  │ │
│  │  │ Strategy     │ │ Memory Inject│ │ Content    │ │ Video Gen  │  │ │
│  │  └──────────────┘ └──────────────┘ └────────────┘ └────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    DATA & INTEGRATION LAYER                         │ │
│  │                                                                     │ │
│  │  MongoDB        Cloudinary     Resend/Gmail   LinkedIn API          │ │
│  │  (Users,        (Images,       (Bulk Email,   Twitter/X API         │ │
│  │  Leads,         CDN)           Transactional) Whapi (WhatsApp)      │ │
│  │  Workflows,                                                         │ │
│  │  Sessions,                                                          │ │
│  │  AuditLogs)                                                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### AI Architecture Deep Dive

#### A. Voice Counselling Flow

```
Student Opens App
       │
       ▼
ElevenLabs Widget (WebSocket, <3s latency)
       │
       ├──── ElevenLabs System Prompt (university KB, loan KB, tone guidelines)
       │
       ├──── Memory Injection Endpoint (/api/voice-agent/memory)
       │     └── Pulls: student profile + 15 prior sessions + resume plan
       │
       ▼
Live Conversation (voice ↔ agent)
       │
       ├──── Live Extract Loop (/api/voice-agent/live-extract)
       │     └── Gemini Flash extracts structured fields every ~30s
       │     └── Updates MongoDB User.studentProfile in real time
       │     └── LiveKYCChecklist updates on student screen
       │
       ▼
Session End (/api/voice-agent/end-session)
       │
       ├──── Final extraction + profile merge
       ├──── Lead score computed (intent + financial + urgency → 0–100)
       ├──── AI summary + follow-up questions (Gemini Pro)
       ├──── WhatsApp summary sent to student
       └──── Counsellor notified with full session dossier
```

#### B. Dashboard Analysis Flow

```
Student Profile (complete ≥ 60%)
       │
       ▼
/api/user/dashboard-analysis
       │
       ├──── Fingerprint cache check (skip if <24h old, ~90% token savings)
       │
       ▼
Gemini 2.5 Pro (structured JSON prompt)
       │
       └── Output:
           ├── AI Insight headline + body
           ├── 4–8 University Recommendations (real institutions)
           ├── 3–5 Action Items (by urgency)
           ├── Wellbeing Scores (Focus / Confidence / Stress)
           ├── Radar Scores (5 axes)
           ├── 6-month Progress Trend
           └── 7-step Journey (personalized per student)
```

#### C. Loan Intelligence Flow *(new module)*

```
Student Profile (KYC complete)
       │
       ▼
Loan Eligibility Engine
       │
       ├──── Rule engine: maps profile fields → eligibility bands
       │     (GPA, target country, program tier, estimated family income)
       │
       ├──── Gemini Flash: generates personalized loan summary
       │     ("Based on your profile, you are likely eligible for ₹40–60L
       │      from Auxilo or Avanse. Here's why...")
       │
       ├──── Dynamic Offer Cards (ranked by match):
       │     HDFC Credila / Auxilo / Avanse / Prodigy Finance / ICICI Bank
       │
       ├──── ROI Calculator: expected salary (program/country/GPA) vs loan cost
       │
       └──── AI Application Assistant:
             ├── Document checklist (auto-generated per lender)
             ├── Auto-fill support from existing profile
             └── Application status tracker
```

#### D. Agentic Campaign Workflow (DAG Execution)

```
Counsellor inputs campaign brief
       │
       ▼
Brief Enhancement (Gemini Pro)
       │
       ▼
Strategy Generation (HTML rationale document)
       │
       ▼
Workflow Graph Generation (nodes + edges, ReactFlow canvas)
       │
       ▼
Node Execution (sequential or selective)
       │
       ├── strategy → copy → image → distribution
       ├── research (Exa.ai) → email → linkedin → twitter
       ├── timeline → video (Veo pipeline)
       └── Context propagation across edges (prior node output feeds next)
       │
       ▼
Multichannel Publishing:
  Email (Resend bulk) + LinkedIn (API post) + Twitter/X + WhatsApp
```

#### E. Lead Scoring Algorithm

```
Lead Score (0–100) =
  Intent Score (keyword match: "GRE", "IELTS", "SOP", "visa", "admit")
    + Contact Completeness (email, phone, name present)
    + Lead Type Bonus (student vs counsellor vs generic)

Thresholds:
  ≥75  →  HOT  (immediate counsellor action)
  50–74 → WARM (nurture sequence)
  <50  →  COLD (automated drip campaign)
```

---

### Methodology & Implementation Flow

**Phase 1 — Student Acquisition**
AI campaign engine (Exa research + Gemini copy + Cloudinary images) publishes content across LinkedIn, Twitter, and email targeting Indian UG students by segment (GRE takers, CAT aspirants, IELTS registered users).

**Phase 2 — Onboarding & Profiling**
New user signs in via Google OAuth or email. Opens voice agent. 13-field profile extracted in <10 minutes through natural conversation. Profile completion gates dashboard depth (streaks + unlock mechanic).

**Phase 3 — Continuous Engagement**
Gemini dashboard refreshes with new recommendations as profile improves. Smart WhatsApp/email nudges sent at journey-relevant moments. Counsellor books sessions for high-intent (Hot) leads.

**Phase 4 — Loan Conversion**
At 70%+ profile completion, the Loan Intelligence Layer activates. Student sees eligibility, offers, ROI, and EMI. AI application assistant walks them through document collection and submission.

**Phase 5 — Post-Conversion Nurture**
Journey tracker continues post-loan: visa steps, pre-departure checklist, alumni community hook.

---

## SLIDE 4 — FEASIBILITY & VIABILITY

### Feasibility Analysis

**Is the technology ready?**
Yes. StudyStack is built on production-grade, commercially available APIs:
- Gemini 2.5 Pro and Flash are live and stable with documented rate limits
- ElevenLabs Conversational AI is in production with sub-3s latency
- MongoDB Atlas scales to millions of records with no infrastructure changes
- All social/email APIs (LinkedIn, Twitter, Resend, Whapi) are live integrations, not mocks

**Is the team capable?**
The codebase already exists as a production-style Next.js monolith. The loan intelligence layer and gamification loop are extensions on top of an already-functional platform. Time-to-MVP for the new modules is estimated at 3–4 weeks.

**Is the market large enough?**
- ~1.3M Indian students study abroad annually (ICEF Monitor, 2024)
- Domestic PG aspirants: ~2.5M per year (IIT/IIM/private combined)
- Education loan disbursement in India: ₹1.2 lakh crore outstanding (RBI, 2024)
- Addressable market for this platform: ~3.8M students per cohort year

### Potential Challenges & Mitigation

| Challenge | Risk Level | Mitigation |
|---|---|---|
| ElevenLabs voice latency on mobile/low bandwidth | Medium | Fallback to text chat if WebSocket latency >5s |
| Gemini API cost at scale | Medium | Fingerprint caching (~90% call reduction), Flash for lightweight tasks, Pro only for dashboard |
| LinkedIn/Twitter API rate limits | Medium | Queue-based posting, retry logic, OAuth1 fallback for Twitter |
| Student data privacy (DPDP Act 2023) | High | All sensitive fields auto-redacted in audit logs, no PII in JSONL logs, data residency on Indian Atlas cluster |
| NBFC partnership for loan offers | High | Start with affiliate model (redirect with UTM), negotiate direct API integration post-MVP |
| WhatsApp Business compliance | Low | Whapi Cloud handles compliance; template messages pre-approved |
| User trust in AI voice counselling | Medium | Human escalation path always visible; counsellor handoff on demand |

### Strategies for Overcoming Challenges

1. **Cost management:** Tiered AI usage — Gemini Flash for extraction, Gemini Pro for analysis. Dashboard cache with 24-hour TTL cuts 90% of repeat calls.
2. **Regulatory compliance:** DPDP-ready data architecture from day one. Explicit consent screens before voice recording. Data deletion on request.
3. **Loan partner onboarding:** Phase 1 = affiliate links (revenue day 1). Phase 2 = API integration with Auxilo/Avanse (3–6 months). Phase 3 = co-branded product with NBFC (12 months).
4. **Trust building:** Show voice transcript to student after every session. Let them edit extracted data. Transparency = trust.

---

## SLIDE 5 — IMPACT & BENEFITS

### Impact on Target Audience

**For Students:**
- Replaces 10+ fragmented touchpoints (college fairs, coaching centres, loan DSAs, visa consultants) with one intelligent platform
- Saves 80–120 hours of research time through AI-powered shortlisting
- Democratizes access: a student in Tier 2/3 India gets the same quality of guidance as someone in Delhi or Mumbai
- Makes education financing less intimidating: personalized eligibility + clear EMI math = confident decision-making

**For NBFCs / Lenders:**
- Pre-qualified, intent-verified leads (not cold form fills)
- Complete student dossier (GPA, program, country, financial situation) reduces underwriting time
- Estimated loan conversion rate 3–5x higher than cold leads (profile-matched offers)

**For Counsellors / Overseas Education Agencies:**
- Eliminates repetitive intake calls — AI handles profiling
- Hot lead alerts with complete context = more productive sessions
- Campaign engine replaces a full marketing team

### Benefits

**Social Impact:**
- Equalizes access to quality study-abroad guidance across income segments
- Reduces student vulnerability to predatory agents and fraudulent consultants
- Builds financial literacy around education loans in a population with low credit awareness

**Economic Impact:**
- ₹40–80L average loan per international student → significant NBFC disbursement volume
- Platform can process 10,000+ students simultaneously vs 1 human counsellor per 50 students
- Reduces cost of student acquisition for NBFCs from ₹15,000–₹25,000 per loan to <₹2,000

**Environmental Impact:**
- Eliminates the need for physical counselling centres, travel, and printed materials
- All-digital document collection and verification

---

## SLIDE 6 — BUSINESS MODEL

### Business Model Overview

StudyStack operates a **multi-sided marketplace** with three revenue streams that activate at different stages of platform maturity:

---

**STREAM 1 — Loan Referral Commission (Core Revenue, Day 1)**
- For every approved education loan originated through the platform, StudyStack earns a referral fee from the NBFC/bank
- Industry standard: 0.5%–1.5% of loan value
- Average loan: ₹30–60L → Revenue per loan: ₹15,000–₹90,000
- Target: 500 loan referrals/month by Month 12 → ₹1.5–4.5 Cr/month

**STREAM 2 — B2C Premium Subscription**
- Free Tier: Voice onboarding, basic dashboard, 1 counsellor session
- StudyStack Pro (₹999/month or ₹4,999 one-time): Full dashboard, unlimited voice sessions, loan intelligence, document auto-fill, visa checklist, priority counsellor access
- Target: 5,000 paying subscribers by Month 12 → ₹50L+/month

**STREAM 3 — B2B SaaS (Counsellor/Agency License)**
- White-label the counsellor operations hub (lead scoring, campaign engine, session management) for overseas education agencies
- Pricing: ₹15,000–₹50,000/month per agency seat
- Target: 50 agency clients by Month 12 → ₹75L–2.5 Cr/month

**STREAM 4 — Data & Insights (Year 2+)**
- Anonymized, aggregated demand signal data sold to universities for recruitment planning
- Universities pay to list as "Featured" in student recommendations with placement accuracy data

---

### Target Market & Size

| Segment | Size | Our Addressable |
|---|---|---|
| Indian students studying abroad (annual) | 1.3M | 500K (top-of-funnel) |
| Domestic PG aspirants (annual) | 2.5M | 1M (top-of-funnel) |
| Education loan applicants (annual) | 600K | 200K (conversion target) |
| Overseas education agencies in India | ~8,000 | 500 (B2B target) |

**Total Addressable Market (TAM):** ₹12,000 Cr+ (education loan facilitation + counselling services)
**Serviceable Addressable Market (SAM):** ₹800–1,200 Cr (AI-led platform capture in 3 years)

---

### Growth Strategy

**Phase 1 — Seed Growth (Months 1–3): Content-Led Acquisition**
- AI campaign engine publishes 50+ pieces of content/week across LinkedIn, Instagram, and Twitter targeting Indian UG students
- SEO-optimized AI-generated blogs (GRE tips, university rankings, visa guides, EMI calculators)
- WhatsApp community seeding in engineering college groups via micro-influencers
- Goal: 10,000 registered users

**Phase 2 — Viral Growth (Months 4–6): Referral + Gamification**
- "Invite a friend, both get a free premium month" — loan application is a shared journey
- Leaderboard of readiness scores within friend groups ("Your GRE score ranks you higher than 73% of your peers applying to Canada")
- Partner with IELTS/GRE prep platforms (IDP, Magoosh) for co-promotion
- Goal: 50,000 registered users, 5,000 active loan inquiries

**Phase 3 — Scale (Months 7–12): NBFC Integration + B2B**
- Direct API integration with 2–3 NBFCs for real-time loan eligibility
- Onboard 20+ overseas education agencies on B2B SaaS license
- Launch referral program targeting study-abroad bloggers and YouTube creators
- Goal: 200,000 registered users, 500+ monthly loan conversions

---

### Monetization & Business Impact Summary

| Metric | Month 6 | Month 12 | Month 24 |
|---|---|---|---|
| Registered Users | 50,000 | 200,000 | 800,000 |
| Monthly Active Users | 15,000 | 80,000 | 300,000 |
| Loan Referrals / Month | 50 | 500 | 3,000 |
| Revenue (Loan Commissions) | ₹25L | ₹2.5Cr | ₹15Cr |
| Revenue (Subscriptions) | ₹10L | ₹50L | ₹3Cr |
| Revenue (B2B SaaS) | ₹15L | ₹1.5Cr | ₹10Cr |
| **Total MRR** | **₹50L** | **₹4.5Cr** | **₹28Cr** |

---

### Commercialization Path & Key Partnerships

**Immediate (0–3 months):**
- NBFC affiliate agreements: Auxilo Financials, Avanse Financial Services, HDFC Credila
- University data partnership: QS, Times Higher Education rankings data licensing
- Voice infra: ElevenLabs enterprise plan

**Medium-term (3–12 months):**
- Bank co-brand: ICICI/Axis "StudyStack Loan" product
- Test prep integration: Magoosh, IDP, British Council referral partnerships
- Visa services: VFS Global affiliate for visa appointment booking

**Long-term (12–36 months):**
- Insurance cross-sell: Student travel and health insurance (Bajaj Allianz, HDFC Ergo)
- Accommodation: University-approved housing booking (partnership with Amber, UniAcco)
- Alumni network monetization: Job placement, mentorship premium

---

## APPENDIX — DIAGRAMS

### A. User Journey Map

```
AWARENESS
  │   └── AI Blog / Reel / LinkedIn Post / WhatsApp Forward
  │
ACQUISITION
  │   └── Click → Landing Page → Google OAuth sign-up (10 seconds)
  │
ACTIVATION
  │   └── Voice Agent opens → 10-min profile call → Dashboard unlocks
  │
ENGAGEMENT
  │   └── Daily: Dashboard updates, nudges, journey tracker
  │   └── Weekly: New university recommendations, AI email digest
  │   └── Event-triggered: "Cornell deadline in 3 weeks" WhatsApp alert
  │
LOAN DISCOVERY
  │   └── Profile 70% complete → Loan banner appears
  │   └── Eligibility check → Personalized offers → ROI shown
  │
CONVERSION
  │   └── "Apply for Loan" → AI document checklist → Lender redirect
  │   └── Counsellor assigned for high-value leads
  │
RETENTION & REFERRAL
      └── Journey tracker continues post-loan
      └── "Refer a friend" nudge → Viral loop
```

---

### B. AI Model Allocation

```
┌──────────────────────────────────────────────────────────┐
│                    AI MODEL STRATEGY                      │
│                                                          │
│  Gemini 2.5 PRO (High reasoning, higher cost)           │
│    ├── Dashboard analysis generation                    │
│    ├── Campaign strategy + workflow graph               │
│    ├── Session summary + follow-up questions            │
│    └── Loan eligibility narrative                       │
│                                                          │
│  Gemini 2.5 FLASH (Faster, cheaper)                     │
│    ├── Live voice extraction (every 30s)                │
│    ├── Brief enhancement                                │
│    ├── Node copy generation                             │
│    └── Lead score computation                           │
│                                                          │
│  Gemini IMAGE MODEL                                     │
│    └── Campaign creative generation                     │
│                                                          │
│  Google VEO                                             │
│    └── Video concept + generation pipeline              │
│                                                          │
│  ElevenLabs Conversational AI                           │
│    └── All real-time voice interactions                 │
│                                                          │
│  Exa.ai (Neural Web Search)                             │
│    ├── Web research for campaign content                │
│    └── Lead discovery (forums, social, news)            │
└──────────────────────────────────────────────────────────┘
```

---

### C. Platform Data Model (Key Entities)

```
User
  ├── identity (name, email, role: student|counsellor)
  ├── studentProfile (13 KYC fields + loan profile)
  ├── dashboardAnalysis (cached Gemini output)
  └── socialTokens (LinkedIn, Twitter)

ConversationMemory
  ├── transcript slices (up to 15 sessions)
  ├── extractedFacts (structured JSON)
  └── summary + sentiment

Lead
  ├── source (voice | form | import | web-research)
  ├── score (0–100) + breakdown
  ├── stage (new | contacted | qualified | converted)
  └── loanInterest flag

LoanApplication ← NEW
  ├── eligibilityScore
  ├── matchedOffers (NBFC + terms)
  ├── roiProjection
  ├── documentChecklist (per lender)
  └── applicationStatus

CounsellorSession
  ├── transcript + rawEvents
  ├── aiSummary + followUpQuestions
  └── whatsappNotified flag

PastWorkflow (Campaign)
  ├── nodes (11 types) + edges
  ├── executionStatus per node
  └── publishedChannels
```

---

### D. Bonus: Zero Human Intervention AI Growth Loop

```
┌──────────────────────────────────────────────────────────┐
│            AUTONOMOUS AI GROWTH LOOP                     │
│                                                          │
│  1. DISCOVER                                            │
│     Exa.ai searches Reddit/Quora/LinkedIn for           │
│     "studying in US 2025 India" discussions             │
│     → Extracts prospective student signals              │
│                                                          │
│  2. CREATE CONTENT                                       │
│     Gemini generates SEO blog + LinkedIn post +         │
│     email sequence based on trending questions          │
│                                                          │
│  3. PUBLISH                                             │
│     Auto-published to LinkedIn, Twitter, bulk email     │
│     (zero human approval needed)                        │
│                                                          │
│  4. ACQUIRE                                             │
│     UTM-tracked clicks → signup page                   │
│     → Google OAuth → profile created                   │
│                                                          │
│  5. PROFILE                                             │
│     ElevenLabs voice agent auto-triggered               │
│     → 13 fields extracted → Lead scored                 │
│                                                          │
│  6. NURTURE                                             │
│     Gemini dashboard + WhatsApp nudges                  │
│     + smart email sequences (stage-triggered)           │
│                                                          │
│  7. CONVERT                                             │
│     Loan intelligence layer surfaces offers             │
│     → AI application assistant → NBFC referral         │
│                                                          │
│  8. LOOP                                               │
│     Converted student's profile data improves           │
│     recommendation engine → better content →           │
│     more accurate targeting → back to step 1           │
│                                                          │
│  Human involvement: 0 (until student explicitly         │
│  requests a live counsellor)                            │
└──────────────────────────────────────────────────────────┘
```

---

*StudyStack — Built on GradPilot | Next.js 16 · React 19 · Gemini 2.5 · ElevenLabs · Exa.ai · MongoDB*
*Submission: April 2026*
