import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateWithRetry, getFlashModel, parseJSONFromResponse } from "@/lib/gemini";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getCounsellingFieldValue } from "@/lib/counselling-profile";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { country, program, budget, gpa, testScore, mode } = body;

    // Fetch student profile from DB for context
    await dbConnect();
    const user = await User.findById(session.user.id).lean();
    const profile = user?.studentProfile || {};

    const profileCountries = getCounsellingFieldValue(profile, "targetCountries") || [];
    const profileCourse = getCounsellingFieldValue(profile, "courseInterest") || getCounsellingFieldValue(profile, "fieldOfStudy") || "";
    const profileBudget = getCounsellingFieldValue(profile, "budgetRange") || "";
    const profileGPA = getCounsellingFieldValue(profile, "gpaPercentage") || "";
    const profileTest = getCounsellingFieldValue(profile, "testScore") || getCounsellingFieldValue(profile, "englishTestStatus") || "";

    // Use explicit params or fall back to profile
    const targetCountry = country || profileCountries[0] || "UK";
    const targetProgram = program || profileCourse || "Computer Science";
    const targetBudget = budget || profileBudget || "₹20-30 Lakhs";
    const studentGPA = gpa || profileGPA || "";
    const studentTest = testScore || profileTest || "";

    const model = getFlashModel();

    if (mode === "admission") {
      // Admission probability prediction
      const admissionPrompt = `You are an expert education counsellor for Indian students. Given this student profile, predict admission probability for universities.

Student Profile:
- Target Country: ${targetCountry}
- Program: ${targetProgram}
- Budget: ${targetBudget}
- GPA/Percentage: ${studentGPA || "Not provided"}
- Test Score (IELTS/TOEFL/GRE): ${studentTest || "Not provided"}

Return a JSON object with this exact structure:
{
  "overallChance": <number 0-100>,
  "band": "High" | "Medium" | "Low",
  "factors": [
    { "name": "Academic Strength", "score": <0-100>, "insight": "<one line>" },
    { "name": "Test Readiness", "score": <0-100>, "insight": "<one line>" },
    { "name": "Financial Fit", "score": <0-100>, "insight": "<one line>" },
    { "name": "Program Competitiveness", "score": <0-100>, "insight": "<one line>" },
    { "name": "Profile Uniqueness", "score": <0-100>, "insight": "<one line>" }
  ],
  "tips": ["<actionable tip 1>", "<actionable tip 2>", "<actionable tip 3>"],
  "reachSchools": 2,
  "matchSchools": 4,
  "safeSchools": 3
}

Be realistic and calibrated for Indian student applications. Return ONLY valid JSON.`;

      const raw = await generateWithRetry(model, admissionPrompt, 3);
      const result = parseJSONFromResponse(raw);
      return NextResponse.json({ admission: result });
    }

    // Default: University exploration
    const prompt = `You are an expert education counsellor for Indian students aspiring to study abroad or pursue domestic postgrad.

Student Profile:
- Target Country: ${targetCountry}
- Desired Program: ${targetProgram}
- Budget: ${targetBudget}
- GPA/Percentage: ${studentGPA || "Not provided"}
- Test Score: ${studentTest || "Not provided"}

Generate a comprehensive university exploration result. Return a JSON object with this exact structure:
{
  "universities": [
    {
      "name": "<real university name>",
      "country": "${targetCountry}",
      "city": "<city>",
      "program": "<specific program name>",
      "ranking": "<QS/THE ranking or 'Top 100' etc>",
      "tuitionRange": "<annual tuition in INR like '₹15-20L'>",
      "acceptanceRate": "<percentage like '25%'>",
      "matchScore": <number 60-98>,
      "tier": "Reach" | "Match" | "Safe",
      "scholarships": "<brief scholarship info or 'Merit-based available'>",
      "highlights": ["<highlight 1>", "<highlight 2>"],
      "avgStartingSalary": "<e.g. '₹45-55L/yr'>",
      "reason": "<why this uni fits the student in 1-2 sentences>"
    }
  ],
  "countryInsights": {
    "avgTuition": "<e.g. '₹25-40L/yr'>",
    "avgLiving": "<e.g. '₹12-18L/yr'>",
    "postStudyVisa": "<e.g. '2 years PSW'>",
    "topCities": ["<city1>", "<city2>", "<city3>"],
    "jobMarket": "<one line about job market for this field>",
    "applicationDeadlines": "<e.g. 'Jan-Mar for Sept intake'>"
  },
  "careerPaths": [
    { "role": "<job title>", "avgSalary": "<INR>", "growth": "<e.g. 'High demand'>" }
  ],
  "timeline": [
    { "month": "<e.g. 'Jan 2025'>", "action": "<what to do>", "priority": "high" | "medium" | "low" }
  ]
}

Return 6-8 universities with a mix of Reach (2), Match (3-4), and Safe (2) schools.
Use REAL university names and realistic data. Return ONLY valid JSON.`;

    const raw = await generateWithRetry(model, prompt, 3);
    const result = parseJSONFromResponse(raw);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Explore API] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate exploration data" }, { status: 500 });
  }
}
