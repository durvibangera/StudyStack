import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const INCOMPLETE_TEST_PATTERNS = [
  /not\s*started/i,
  /not\s*taken/i,
  /preparing/i,
  /planning/i,
  /booked/i,
  /soon/i,
  /pending/i,
];

function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isTestIncomplete(testStatus) {
  if (isBlank(testStatus)) return true;
  return INCOMPLETE_TEST_PATTERNS.some((pattern) => pattern.test(String(testStatus)));
}

function detectMissingOrIncompleteFields(profileSummary) {
  const missing = [];

  if (isBlank(profileSummary.education)) missing.push("educationLevel");
  if (isBlank(profileSummary.field)) missing.push("fieldOfStudy");
  if (isBlank(profileSummary.course)) missing.push("courseInterest");
  if (isBlank(profileSummary.institution)) missing.push("institution");
  if (isBlank(profileSummary.gpa)) missing.push("gpaPercentage");
  if (isBlank(profileSummary.timeline)) missing.push("applicationTimeline");
  if (isBlank(profileSummary.budget)) missing.push("budgetRange");
  if (isBlank(profileSummary.targetCountries)) missing.push("targetCountries");
  if (isTestIncomplete(profileSummary.testStatus)) missing.push("englishTestStatus");

  return missing;
}

function buildProfileFingerprint(profileSummary) {
  const canonical = {
    name: String(profileSummary.name || "").trim().toLowerCase(),
    education: String(profileSummary.education || "").trim().toLowerCase(),
    field: String(profileSummary.field || "").trim().toLowerCase(),
    institution: String(profileSummary.institution || "").trim().toLowerCase(),
    gpa: String(profileSummary.gpa || "").trim().toLowerCase(),
    targetCountries: [...(profileSummary.targetCountries || [])]
      .map((v) => String(v || "").trim().toLowerCase())
      .sort(),
    course: String(profileSummary.course || "").trim().toLowerCase(),
    testStatus: String(profileSummary.testStatus || "").trim().toLowerCase(),
    budget: String(profileSummary.budget || "").trim().toLowerCase(),
    timeline: String(profileSummary.timeline || "").trim().toLowerCase(),
    location: String(profileSummary.location || "").trim().toLowerCase(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function buildRuleBasedJourneySteps(profileSummary) {
  const countries = profileSummary.targetCountries?.length
    ? profileSummary.targetCountries
    : ["your target country"];
  const countryLabel = countries.join(" and ");
  const courseLabel = profileSummary.course || profileSummary.field || "your chosen program";
  const testIncomplete = isTestIncomplete(profileSummary.testStatus);

  const statuses = [
    "completed",
    testIncomplete ? "current" : "completed",
    testIncomplete ? "locked" : "current",
    "locked",
    "locked",
    "locked",
    "locked",
  ];

  return [
    {
      id: 1,
      status: statuses[0],
      description: `Profile details captured for ${courseLabel} with a focus on ${countryLabel}.`,
      actions: [
        "Review personal and academic details",
        "Confirm preferred countries and budget band",
        "Keep profile documents updated",
      ],
      goal: "Profile foundation is complete",
    },
    {
      id: 2,
      status: statuses[1],
      description: testIncomplete
        ? "Your language-test milestone is still open and should be completed first."
        : "Language-test readiness is complete and no longer a blocker.",
      actions: testIncomplete
        ? [
            "Finalize IELTS/TOEFL exam timeline",
            "Prioritize score-improvement practice",
            "Prepare required registration documents",
          ]
        : [
            "Keep score report accessible for applications",
            "Map score bands to target universities",
            "Use score in shortlist filtering",
          ],
      goal: testIncomplete ? "Lock a competitive language score" : "Use your test score strategically",
    },
    {
      id: 3,
      status: statuses[2],
      description: `Build a short, high-fit shortlist for ${courseLabel} in ${countryLabel}.`,
      actions: [
        "Create reach-match-safe university buckets",
        "Validate tuition against your budget",
        "Shortlist universities by intake timeline",
      ],
      goal: "Finalize a strong shortlist",
    },
    {
      id: 4,
      status: statuses[3],
      description: "Prepare persuasive SOP and strong LOR assets aligned to your goals.",
      actions: [
        "Draft SOP with career narrative",
        "Request recommendation letters early",
        "Create a document-review checklist",
      ],
      goal: "Complete SOP and LOR set",
    },
    {
      id: 5,
      status: statuses[4],
      description: "Submit complete applications with all required evidence before deadlines.",
      actions: [
        "Complete university portal entries",
        "Upload verified documents",
        "Track deadline-wise submissions",
      ],
      goal: "Submit all priority applications",
    },
    {
      id: 6,
      status: statuses[5],
      description: "Prepare visa paperwork and financial proofs after receiving admission outcomes.",
      actions: [
        "Compile visa documentation checklist",
        "Arrange financial statements",
        "Schedule visa appointment timeline",
      ],
      goal: "Complete visa file preparation",
    },
    {
      id: 7,
      status: statuses[6],
      description: "Complete final pre-departure readiness tasks for a smooth transition.",
      actions: [
        "Finalize accommodation and travel",
        "Arrange insurance and forex",
        "Complete orientation and packing checklist",
      ],
      goal: "Be departure ready",
    },
  ];
}

function buildRuleBasedRecommendations(profileSummary, missingFields) {
  const testIncomplete = isTestIncomplete(profileSummary.testStatus);
  const countries = profileSummary.targetCountries?.length
    ? profileSummary.targetCountries.join(" / ")
    : "your target countries";
  const recommendations = [];

  if (testIncomplete) {
    recommendations.push({
      title: "Close language-test gap",
      category: "test",
      urgency: "urgent",
      description: `Prioritize IELTS/TOEFL completion since it directly impacts shortlist quality for ${countries}.`,
    });
  }

  if (missingFields.includes("budgetRange")) {
    recommendations.push({
      title: "Finalize budget ceiling",
      category: "financial",
      urgency: "important",
      description: "Set a clear annual budget range so program, tuition, and scholarship planning can be narrowed with confidence.",
    });
  }

  if (missingFields.includes("applicationTimeline")) {
    recommendations.push({
      title: "Lock your intake timeline",
      category: "academic",
      urgency: "important",
      description: "Choose a realistic application window to avoid deadline compression and last-minute document risk.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Advance to shortlist execution",
      category: "documents",
      urgency: "important",
      description: "Your core profile is stable. Move into shortlist finalization and application-document refinement.",
    });
  }

  while (recommendations.length < 3) {
    recommendations.push({
      title: "Prepare application documents",
      category: "documents",
      urgency: "optional",
      description: "Keep SOP, LOR, and transcripts organized so application submission remains smooth.",
    });
  }

  return recommendations.slice(0, 3);
}

function buildRuleBasedAnalysis(profileSummary, missingFields) {
  const countries = profileSummary.targetCountries?.length
    ? profileSummary.targetCountries
    : ["UK"];
  const primaryCountry = countries[0];
  const course = profileSummary.course || profileSummary.field || "your chosen program";
  const testIncomplete = isTestIncomplete(profileSummary.testStatus);
  const recommendations = buildRuleBasedRecommendations(profileSummary, missingFields);

  return {
    aiInsight: {
      headline: `${profileSummary.name}'s dashboard is ready with a focused action plan.`,
      body: testIncomplete
        ? `Language-test readiness is still the main blocker for ${course}. Closing this gap will significantly improve options in ${primaryCountry}.`
        : `Your profile for ${course} in ${primaryCountry} is progressing well. Focus on shortlist quality and document readiness for better outcomes.`,
      matchCount: Math.min((countries.length || 1) * 4, 20),
      avgFit: `${testIncomplete ? 68 : 82}%`,
      urgentCount: recommendations.filter((r) => r.urgency === "urgent").length || 1,
      topPickLabel: `Prioritize the next milestone for ${primaryCountry} applications.`,
    },
    recommendations,
    sessions: [
      {
        topic: testIncomplete ? "Language Test Strategy" : "University Shortlisting Workshop",
        priority: "high",
        reason: "This session resolves the biggest current bottleneck in your journey.",
      },
      {
        topic: "SOP and LOR Planning",
        priority: "medium",
        reason: "Early document preparation prevents downstream application delays.",
      },
    ],
    journeySteps: buildRuleBasedJourneySteps(profileSummary),
  };
}

function mergeAnalysisWithRuleBase(baseAnalysis, aiAnalysis) {
  const merged = {
    ...baseAnalysis,
    ...(aiAnalysis || {}),
    aiInsight: {
      ...(baseAnalysis.aiInsight || {}),
      ...((aiAnalysis && aiAnalysis.aiInsight) || {}),
    },
  };

  if (!Array.isArray(merged.recommendations) || merged.recommendations.length === 0) {
    merged.recommendations = baseAnalysis.recommendations;
  }

  if (!Array.isArray(merged.sessions) || merged.sessions.length === 0) {
    merged.sessions = baseAnalysis.sessions;
  }

  if (!Array.isArray(merged.journeySteps) || merged.journeySteps.length !== 7) {
    merged.journeySteps = baseAnalysis.journeySteps;
  }

  return merged;
}

function buildPrompt(profileSummary, missingFields) {
  const targetCountries = profileSummary.targetCountries.length > 0 
    ? profileSummary.targetCountries.join(", ")
    : "Not yet specified";
  
  const courseContext = profileSummary.course || profileSummary.field || "their chosen field";
  const educationContext = profileSummary.education || "their current level";
  const budgetContext = profileSummary.budget || "their budget range";
  const timelineContext = profileSummary.timeline || "their preferred intake";
  
  return `You are a world-class overseas education counsellor with 15+ years of experience placing Indian students in top universities globally. Analyze this student's profile deeply and generate a highly personalized, actionable dashboard analysis.

STUDENT PROFILE:
- Name: ${profileSummary.name}
- Current Education: ${educationContext}
- Field of Study: ${profileSummary.field || "Not yet specified"}
- Institution: ${profileSummary.institution || "Not yet specified"}
- Academic Performance (GPA/Score): ${profileSummary.gpa || "Not yet specified"}
- Target Countries: ${targetCountries}
- Desired Course: ${courseContext}
- English Test Status: ${profileSummary.testStatus || "Not yet specified"}
- Annual Budget: ${budgetContext}
- Application Timeline: ${timelineContext}
- Current Location: ${profileSummary.location || "Not yet specified"}

INCOMPLETE PROFILE AREAS TO FOCUS ON:
${missingFields.length > 0 ? missingFields.map(f => `• ${f}`).join("\n") : "• Profile is nearly complete"}

CRITICAL INSTRUCTIONS:
1. For COMPLETE fields: Use the provided values as ground truth. Do NOT invent or contradict them.
2. For INCOMPLETE fields: Provide specific, actionable guidance based on the student's existing profile.
3. University Suggestions: Recommend 5-8 REAL universities that genuinely match this student's profile, budget, and timeline. Include:
   - Actual program names (not generic)
   - Realistic annual tuition in local currency
   - Specific scholarship opportunities (with names if known)
   - Actual application deadlines for upcoming intakes
   - Why each university is a strong fit for THIS student specifically
4. Wellbeing Assessment: Evaluate stress/confidence/focus based on:
   - Profile completeness vs. timeline urgency
   - Test readiness status
   - Budget clarity
   - Career clarity
5. Radar Scores: Rate the student's readiness across 5 dimensions:
   - Academics: GPA strength + institution reputation + field alignment
   - Language: Test status + score quality + timeline to retake if needed
   - Finances: Budget clarity + scholarship eligibility + cost-of-living awareness
   - Clarity: Career goal definition + country/course alignment + decision confidence
   - Timeline: Application deadline awareness + intake planning + document readiness
6. Journey Steps: Personalize each of the 7 steps based on what the student has ACTUALLY done vs. what they need to do next.

RESPOND WITH ONLY A VALID JSON OBJECT (no markdown, no code blocks, no explanation):

{
  "aiInsight": {
    "headline": "A specific, compelling insight about ${profileSummary.name}'s profile (e.g., 'Priya's strong CS background positions her well for UK MSc programs, but IELTS completion is critical before applying')",
    "body": "3-4 sentences of deep, personalized analysis. Reference their specific field, target countries, and timeline. Identify their key strengths and the ONE critical blocker holding them back. End with a concrete next step.",
    "matchCount": <realistic number 5-20 based on their profile specificity>,
    "avgFit": "<realistic percentage 65-95% based on profile completeness>",
    "urgentCount": <1-5 based on missing fields and timeline urgency>,
    "topPickLabel": "A specific sentence about their best opportunity (e.g., 'Imperial College London's MSc in AI is a strong fit given your CS background and 50L budget')"
  },
  "universities": [
    {
      "name": "Specific real university (e.g., University of Manchester, not just 'UK University')",
      "country": "Country",
      "program": "Exact program name (e.g., 'MSc Computer Science', not 'CS Program')",
      "matchScore": <60-98 based on GPA, test score, budget alignment>,
      "tuitionRange": "Annual tuition in INR or local currency (e.g., '₹25-30L per year' or '£20,000-25,000')",
      "scholarships": "Specific scholarships (e.g., 'Chevening Scholarship (up to 100% tuition)', 'Merit-based: 20-30% tuition waiver') or 'Limited scholarships - primarily self-funded'",
      "deadline": "Specific deadline (e.g., 'January 15, 2025 for Fall 2025 intake') or 'Rolling admissions'",
      "reason": "Why THIS university matches THIS student (e.g., 'Strong for your CS background, within your 50L budget, and offers merit scholarships for Indian students')"
    }
  ],
  "recommendations": [
    {
      "title": "Specific, actionable title (e.g., 'Retake IELTS by November to meet January deadlines', not just 'Improve test score')",
      "category": "academic|test|financial|documents|visa",
      "urgency": "urgent|important|optional",
      "description": "2-3 sentences with specific context. Reference their profile (e.g., 'Your current IELTS 6.5 is below the 7.0 requirement for most UK MSc programs. Retaking by November gives you 6-8 weeks to improve and still meet January deadlines.')"
    }
  ],
  "wellbeing": {
    "focus": <30-95 based on profile clarity and timeline pressure>,
    "confidence": <30-95 based on academic strength and test readiness>,
    "stress": <20-80 based on timeline urgency and missing critical fields>,
    "assessment": "2-3 sentences analyzing their readiness mindset. Reference specific profile gaps (e.g., 'Your strong academics boost confidence, but the pending IELTS retake and tight January timeline are creating stress. Focus on test prep first—everything else can follow.')"
  },
  "progressTrend": [
    {"month": "Jun", "score": <realistic starting score>},
    {"month": "Jul", "score": <realistic progression>},
    {"month": "Aug", "score": <realistic progression>},
    {"month": "Sep", "score": <realistic progression>},
    {"month": "Oct", "score": <realistic progression>},
    {"month": "Nov", "score": <realistic progression>},
    {"month": "Dec", "score": <realistic progression>},
    {"month": "Jan", "score": <realistic target score>}
  ],
  "sessions": [
    {
      "topic": "Specific session topic (e.g., 'IELTS Strategy & Timeline Planning', not just 'Test Prep')",
      "priority": "high|medium|low",
      "reason": "Why this matters NOW for this student (e.g., 'Your January deadline requires IELTS completion by November. A focused strategy session will optimize your prep timeline.')"
    }
  ],
  "budgetBreakdown": [
    {"name": "Tuition", "pct": <realistic % based on their budget and target countries>},
    {"name": "Living", "pct": <realistic % based on country cost-of-living>},
    {"name": "Travel", "pct": <realistic % based on origin and destination>},
    {"name": "Insurance", "pct": <realistic % based on duration>},
    {"name": "Misc", "pct": <realistic % for contingency>}
  ],
  "radarScores": {
    "academics": <20-100 based on GPA + institution reputation + field alignment>,
    "language": <20-100 based on test status + score + timeline to improve>,
    "finances": <20-100 based on budget clarity + scholarship awareness>,
    "clarity": <20-100 based on country/course/career alignment>,
    "timeline": <20-100 based on deadline awareness + intake planning + document readiness>
  },
  "journeySteps": [
    {
      "id": 1,
      "status": "completed|current|locked",
      "description": "Personalized for this student (e.g., 'Your profile for MSc CS in UK is captured. Now validate that your GPA 8.2 and CS background align with Imperial/Manchester requirements.')",
      "actions": ["Action 1 specific to them", "Action 2 specific to them", "Action 3 specific to them"],
      "goal": "Specific goal (e.g., 'Confirm profile aligns with top 5 target universities')"
    },
    {
      "id": 2,
      "status": "completed|current|locked",
      "description": "Personalized (e.g., 'IELTS is your critical blocker. Current status: Not taken. Target: 7.0+ by November for January deadlines.')",
      "actions": ["Specific action 1", "Specific action 2", "Specific action 3"],
      "goal": "Specific goal (e.g., 'Achieve IELTS 7.0+ by November 15')"
    },
    { "id": 3, "status": "...", "description": "Personalized for their countries/course", "actions": ["..."], "goal": "..." },
    { "id": 4, "status": "...", "description": "Personalized for their timeline", "actions": ["..."], "goal": "..." },
    { "id": 5, "status": "...", "description": "Personalized for their target universities", "actions": ["..."], "goal": "..." },
    { "id": 6, "status": "...", "description": "Personalized for their budget/timeline", "actions": ["..."], "goal": "..." },
    { "id": 7, "status": "...", "description": "Personalized for their intake month", "actions": ["..."], "goal": "..." }
  ]
}

CRITICAL REQUIREMENTS FOR HIGH-QUALITY OUTPUT:

UNIVERSITIES:
- Include 5-8 REAL, currently-accepting universities from their target countries
- Each must offer their specific course (e.g., 'MSc Computer Science', not generic 'CS')
- Tuition must be realistic and in local currency (e.g., '₹25-30L/year' or '£20,000-25,000')
- Scholarships must be specific (e.g., 'Chevening', 'Merit-based 20% waiver') not generic
- Deadlines must be real (e.g., 'January 15, 2025 for Fall 2025') not vague
- Match scores should reflect GPA + test score + budget alignment
- Reason field must explain why THIS university fits THIS student specifically

PERSONALIZATION:
- Use student's NAME in headline and throughout
- Reference their SPECIFIC field, countries, GPA, test status, budget, timeline
- Identify the ONE critical blocker (e.g., 'IELTS is your main blocker')
- Provide concrete next steps, not generic advice
- Radar scores must reflect their actual profile (not generic ranges)
- Wellbeing assessment must reference their specific gaps

JOURNEY STEPS (exactly 7, ids 1-7):
1. Profile Completion: Validate profile aligns with universities
2. IELTS/TOEFL Prep: Language test readiness (status based on testStatus field)
3. University Shortlisting: Build shortlist for their countries/course
4. SOP & LOR: Prepare application documents
5. Application Submission: Submit to target universities
6. Visa Process: Prepare visa documentation
7. Departure Ready: Final pre-departure tasks

For each step:
- Set status: "completed" if done, "current" if they should work on it now, "locked" if too early
- Only ONE step should be "current"
- Description must reference their profile (countries, course, timeline, budget)
- Actions must be specific to them, not generic
- Goal must be concrete and motivating

NUMBERS & CONSISTENCY:
- Radar scores: 20-100 range, realistic based on profile completeness
- Wellbeing: focus 30-95, confidence 30-95, stress 20-80
- Progress trend: 6-8 months showing realistic progression
- Budget breakdown: percentages must sum to 100 and reflect country costs
- Match count: 5-20 based on profile specificity
- Avg fit: 65-95% based on profile completeness

TONE:
- Expert, encouraging, specific
- Avoid generic phrases like "improve your profile" or "work on missing areas"
- Use concrete examples from their profile
- End recommendations with actionable next steps`;
}

function extractJSON(text) {
  let cleaned = text.trim();
  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in the text
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Could not extract JSON from response");
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = await request.json();
    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ error: "Profile data required" }, { status: 400 });
    }

    const profileSummary = {
      name: profile.studentName || profile.name || "Student",
      education: profile.educationLevel || "",
      field: profile.fieldOfStudy || "",
      institution: profile.institution || "",
      gpa: profile.gpaPercentage || "",
      targetCountries: Array.isArray(profile.targetCountries)
        ? profile.targetCountries
        : [],
      course: profile.courseInterest || profile.fieldOfStudy || "",
      testStatus: profile.englishTestStatus || "",
      budget: profile.budgetRange || "",
      timeline: profile.applicationTimeline || "",
      location: profile.currentLocation || "",
    };

    const missingFields = detectMissingOrIncompleteFields(profileSummary);
    const profileFingerprint = buildProfileFingerprint(profileSummary);

    await dbConnect();

    const user = await User.findById(session.user.id).select("dashboardAnalysis").lean();
    const cached = user?.dashboardAnalysis;

    if (
      cached?.analysis &&
      cached?.profileFingerprint &&
      cached.profileFingerprint === profileFingerprint
    ) {
      return NextResponse.json({
        analysis: cached.analysis,
        generatedAt: cached.generatedAt,
        cached: true,
        source: cached.source || "local",
        usedGemini: cached.source === "gemini",
        missingFields: cached.missingFields || missingFields,
      });
    }

    const baseAnalysis = buildRuleBasedAnalysis(profileSummary, missingFields);

    // If the profile is complete, skip Gemini to avoid unnecessary usage.
    if (missingFields.length === 0) {
      await User.findByIdAndUpdate(session.user.id, {
        dashboardAnalysis: {
          profileFingerprint,
          missingFields,
          source: "local",
          model: "local-rules",
          generatedAt: new Date(),
          analysis: baseAnalysis,
        },
      });

      return NextResponse.json({
        analysis: baseAnalysis,
        generatedAt: new Date().toISOString(),
        cached: false,
        source: "local",
        usedGemini: false,
        missingFields,
      });
    }

    const prompt = buildPrompt(profileSummary, missingFields);

    let analysis = baseAnalysis;
    let source = "local";
    let model = "local-rules";

    if (process.env.GEMINI_API_KEY) {
      let text;

      try {
        const result = await genAI.models.generateContent({
          model: "gemini-2.5-pro",
          contents: prompt,
          config: {
            temperature: 0.85,
            topP: 0.95,
            maxOutputTokens: 8192,
            tools: [{ googleSearch: {} }],
          },
        });
        text = result.text;
      } catch (groundingErr) {
        console.warn("[Dashboard Analyze] Grounding failed, falling back to plain generation:", groundingErr.message);
        const result = await genAI.models.generateContent({
          model: "gemini-2.5-pro",
          contents: prompt,
          config: {
            temperature: 0.85,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        });
        text = result.text;
      }

      const aiAnalysis = extractJSON(text);
      analysis = mergeAnalysisWithRuleBase(baseAnalysis, aiAnalysis);
      source = "gemini";
      model = "gemini-2.5-pro";
    }

    await User.findByIdAndUpdate(session.user.id, {
      dashboardAnalysis: {
        profileFingerprint,
        missingFields,
        source,
        model,
        generatedAt: new Date(),
        analysis,
      },
    });

    return NextResponse.json({
      analysis,
      generatedAt: new Date().toISOString(),
      cached: false,
      source,
      usedGemini: source === "gemini",
      missingFields,
    });
  } catch (err) {
    console.error("[Dashboard Analyze] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate analysis", details: err.message },
      { status: 500 }
    );
  }
}
