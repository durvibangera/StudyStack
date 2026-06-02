import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LenderPolicy from '@/lib/models/LenderPolicy';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/policies/upload
 *
 *  Full RAG pipeline:
 *  1. Text extraction (PDF/DOCX/TXT)
 *  2. AI Extraction pass  — Gemini extracts structured policy JSON
 *  3. Faithfulness verifier — second independent Gemini call cross-checks
 *     each extracted value against the raw source text (detects hallucinations)
 *  4. Completeness scoring — checks all critical fields are present
 *  5. Combined RAG score   — 60% faithfulness + 40% completeness
 *  6. Upsert              — if same lender+product exists, update in place
 *                           bumping version; else create new
 * ──────────────────────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Only counsellors can upload policies' }, { status: 403 });
    }

    await dbConnect();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOCX, or TXT files.' },
        { status: 400 }
      );
    }

    // ── STEP 1: Upload to Cloudinary ──────────────────────────────────
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const cloudinaryResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'studystack/loan-policies',
          public_id: `policy_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(fileBuffer);
    });

    // ── STEP 2: Text extraction ────────────────────────────────────────
    let extractedText = '';
    if (file.type === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text || '';
    } else if (file.type === 'text/plain') {
      extractedText = fileBuffer.toString('utf-8');
    } else {
      extractedText = fileBuffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract sufficient text from the document.' },
        { status: 400 }
      );
    }

    const maxChars = 30000;
    const truncatedText = extractedText.length > maxChars
      ? extractedText.substring(0, maxChars) + '\n\n[Document truncated for processing]'
      : extractedText;

    // ── STEP 3: AI Extraction pass ────────────────────────────────────
    const { GoogleGenAI } = await import('@google/genai');
    const { parseJSONFromResponse } = await import('@/lib/gemini');
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const extractionPrompt = `You are an expert education loan policy analyst. Analyze the following lender policy document and extract ALL relevant information into a structured JSON format.

## DOCUMENT TEXT
${truncatedText}

## INSTRUCTIONS
Extract the following information. If a piece of information is not found, use null or empty arrays.

Return ONLY valid JSON (no markdown code fences):
{
  "lenderName": "Name of the bank/NBFC/lender",
  "productName": "Name of the loan product",
  "aiConfidenceScore": 85,
  "aiExtractionNotes": "Brief notes about extraction quality and any ambiguities",
  "extractedPolicies": {
    "eligibility": {
      "minGPA": null,
      "minCoApplicantIncomeINR": null,
      "supportedCountries": ["USA", "UK"],
      "supportedDegrees": ["Masters", "MBA", "PhD"],
      "supportedCourseTypes": ["Full-time"],
      "minAge": null,
      "maxAge": null,
      "requiresCoApplicant": false,
      "workExperienceRequired": false,
      "minWorkExperienceYears": null,
      "additionalCriteria": []
    },
    "financial": {
      "interestRateMin": 8.5,
      "interestRateMax": 12.0,
      "maxLoanAmountINR": 10000000,
      "minLoanAmountINR": 100000,
      "collateralRequired": true,
      "collateralThresholdINR": null,
      "processingFeePercent": 1.0,
      "insuranceRequired": false,
      "marginMoneyPercent": null
    },
    "repayment": {
      "minTenureMonths": 12,
      "maxTenureMonths": 180,
      "moratoriumMonths": 6,
      "repaymentOptions": [],
      "prepaymentAllowed": true,
      "prepaymentPenaltyPercent": null,
      "emiStartCondition": ""
    },
    "documents": [
      { "name": "Document name", "required": true, "conditions": "", "category": "identity" }
    ],
    "restrictions": {
      "approvedUniversities": [],
      "excludedPrograms": [],
      "countrySpecificNotes": {},
      "maxCourseDurationYears": null,
      "onlyFullTime": false
    },
    "specialFeatures": [],
    "taxBenefits": "",
    "additionalNotes": ""
  }
}

CRITICAL RULES:
- Extract ONLY what is explicitly stated. Do NOT invent or infer values not in the document.
- Convert all monetary amounts to INR (lakhs x100000, crores x10000000).
- Interest rates as percentage numbers (e.g. 8.5, not 0.085).
- aiConfidenceScore (0-100) reflects how much useful data you could extract.`;

    const extractionResult = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: extractionPrompt,
      config: { temperature: 0.1, maxOutputTokens: 8000 },
    });

    let extracted: any;
    try {
      extracted = parseJSONFromResponse((extractionResult.text ?? '').trim());
    } catch {
      return NextResponse.json(
        { error: 'AI could not parse the document. Please try a different format.' },
        { status: 500 }
      );
    }

    const pol = extracted.extractedPolicies || {};

    // Sanitize document categories — Gemini sometimes returns values outside the enum.
    // Coerce any invalid value to 'other' to prevent Mongoose validation errors.
    const validCategories = new Set(['identity', 'academic', 'financial', 'property', 'admission', 'other']);
    if (Array.isArray(pol.documents)) {
      pol.documents = pol.documents.map((doc: any) => ({
        ...doc,
        category: validCategories.has(doc.category) ? doc.category : 'other',
      }));
    }

    // ── STEP 4: Faithfulness Verifier pass ────────────────────────────
    // An independent Gemini call verifies each extracted value against
    // the raw source text. This is the core RAG evaluation metric —
    // it catches hallucinated numbers and wrong values.
    type VerifierFlag = {
      field: string;
      extractedValue: string;
      verified: boolean;
      evidence: string;
    };

    const fieldsToVerify = [
      { field: 'Lender Name', value: extracted.lenderName },
      { field: 'Product Name', value: extracted.productName },
      { field: 'Interest Rate Min (%)', value: pol.financial?.interestRateMin },
      { field: 'Interest Rate Max (%)', value: pol.financial?.interestRateMax },
      { field: 'Max Loan Amount (INR)', value: pol.financial?.maxLoanAmountINR },
      { field: 'Processing Fee (%)', value: pol.financial?.processingFeePercent },
      { field: 'Collateral Required', value: pol.financial?.collateralRequired },
      { field: 'Min GPA', value: pol.eligibility?.minGPA },
      { field: 'Co-Applicant Required', value: pol.eligibility?.requiresCoApplicant },
      { field: 'Min Co-Applicant Income (INR)', value: pol.eligibility?.minCoApplicantIncomeINR },
      { field: 'Max Tenure (months)', value: pol.repayment?.maxTenureMonths },
      { field: 'Moratorium (months)', value: pol.repayment?.moratoriumMonths },
      { field: 'Prepayment Allowed', value: pol.repayment?.prepaymentAllowed },
      { field: 'Supported Countries', value: pol.eligibility?.supportedCountries?.join(', ') },
      { field: 'Supported Degrees', value: pol.eligibility?.supportedDegrees?.join(', ') },
    ].filter(f => f.value !== null && f.value !== undefined && f.value !== '');

    let faithfulnessFlags: VerifierFlag[] = [];
    try {
      const verifierPrompt = `You are a strict fact-checker for an AI extraction pipeline. Verify whether each extracted value is actually supported by the source document text.

## SOURCE DOCUMENT TEXT
${truncatedText}

## EXTRACTED VALUES TO VERIFY
${JSON.stringify(fieldsToVerify.map(f => ({ field: f.field, extractedValue: String(f.value) })), null, 2)}

Return ONLY valid JSON (no markdown):
{
  "verifications": [
    {
      "field": "field name exactly as given",
      "extractedValue": "the value that was extracted",
      "verified": true,
      "evidence": "exact quote from document (max 80 chars) or NOT FOUND IN DOCUMENT"
    }
  ]
}

RULES:
- verified=true ONLY if the value is clearly supported by the document text.
- For numbers: a 5% tolerance is acceptable for rounding.
- For INR conversions: verify the original amount in the doc (e.g. 4500000 from "INR 45 Lakhs").
- evidence must be a direct quote from the document, or "NOT FOUND IN DOCUMENT".
- Be strict. If unsure, set verified=false.`;

      const verifierResult = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: verifierPrompt,
        config: { temperature: 0.0, maxOutputTokens: 4000 },
      });
      const verifierParsed = parseJSONFromResponse((verifierResult.text ?? '').trim());
      faithfulnessFlags = verifierParsed.verifications || [];
    } catch {
      faithfulnessFlags = fieldsToVerify.map(f => ({
        field: f.field,
        extractedValue: String(f.value),
        verified: false,
        evidence: 'Verifier pass failed — treating as unverified',
      }));
    }

    const verifiedCount = faithfulnessFlags.filter(f => f.verified).length;
    const faithfulnessScore = Math.round((verifiedCount / Math.max(faithfulnessFlags.length, 1)) * 100);

    // ── STEP 5: Completeness scoring ──────────────────────────────────
    const criticalFields: [string, any][] = [
      ['Interest Rate Min', pol.financial?.interestRateMin],
      ['Interest Rate Max', pol.financial?.interestRateMax],
      ['Max Loan Amount', pol.financial?.maxLoanAmountINR],
      ['Supported Countries', pol.eligibility?.supportedCountries?.length],
      ['Supported Degrees', pol.eligibility?.supportedDegrees?.length],
      ['Required Documents', pol.documents?.length],
    ];
    const missingCriticalFields = criticalFields.filter(([, v]) => !v).map(([name]) => name);
    const completenessScore = Math.round(
      ((criticalFields.length - missingCriticalFields.length) / criticalFields.length) * 100
    );

    // ── STEP 6: Combined RAG score ─────────────────────────────────────
    // Faithfulness weighted more heavily (60%) because an inaccurate extraction
    // is worse than a missing one — it causes active mismatches
    const overallScore = Math.round(faithfulnessScore * 0.6 + completenessScore * 0.4);
    const verdict: 'excellent' | 'good' | 'partial' | 'poor' =
      overallScore >= 85 ? 'excellent' :
      overallScore >= 70 ? 'good' :
      overallScore >= 50 ? 'partial' : 'poor';

    const ragEvaluation = {
      faithfulnessScore,
      faithfulnessFlags,
      completenessScore,
      missingCriticalFields,
      overallScore,
      verdict,
      evaluatedAt: new Date().toISOString(),
    };

    // ── STEP 7: Upsert — update if same lender+product exists ─────────
    // Same lender + same product = a policy update (new version), not a duplicate.
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingPolicy = await LenderPolicy.findOne({
      lenderName: { $regex: new RegExp(`^${escapeRegex(extracted.lenderName || '')}$`, 'i') },
      productName: { $regex: new RegExp(`^${escapeRegex(extracted.productName || '')}$`, 'i') },
    }).sort({ version: -1 });

    let policy: any;
    let isUpdate = false;
    let changeDetection: { changes: { field: string; old: any; new: any }[] } = { changes: [] };

    if (existingPolicy) {
      isUpdate = true;

      // Build diff before overwriting
      const oldPol = (existingPolicy.extractedPolicies as any) || {};
      const diffChecks: [string, any, any][] = [
        ['Interest Rate Min (%)', oldPol.financial?.interestRateMin, pol.financial?.interestRateMin],
        ['Interest Rate Max (%)', oldPol.financial?.interestRateMax, pol.financial?.interestRateMax],
        ['Max Loan Amount (INR)', oldPol.financial?.maxLoanAmountINR, pol.financial?.maxLoanAmountINR],
        ['Processing Fee (%)', oldPol.financial?.processingFeePercent, pol.financial?.processingFeePercent],
        ['Collateral Required', oldPol.financial?.collateralRequired, pol.financial?.collateralRequired],
        ['Min GPA', oldPol.eligibility?.minGPA, pol.eligibility?.minGPA],
        ['Co-Applicant Income (INR)', oldPol.eligibility?.minCoApplicantIncomeINR, pol.eligibility?.minCoApplicantIncomeINR],
        ['Max Tenure (months)', oldPol.repayment?.maxTenureMonths, pol.repayment?.maxTenureMonths],
        ['Moratorium (months)', oldPol.repayment?.moratoriumMonths, pol.repayment?.moratoriumMonths],
        ['Prepayment Allowed', oldPol.repayment?.prepaymentAllowed, pol.repayment?.prepaymentAllowed],
      ];
      changeDetection.changes = diffChecks
        .filter(([, o, n]) => o !== undefined && n !== undefined && String(o) !== String(n))
        .map(([field, o, n]) => ({ field, old: o, new: n }));

      // Update in-place, bump version, reset to 'review' for counsellor re-approval
      existingPolicy.sourceDocumentUrl = cloudinaryResult.secure_url;
      existingPolicy.sourceDocumentName = file.name;
      existingPolicy.rawExtractedText = extractedText;
      existingPolicy.extractedPolicies = pol;
      existingPolicy.aiConfidenceScore = extracted.aiConfidenceScore || 50;
      existingPolicy.aiExtractionNotes = extracted.aiExtractionNotes || '';
      existingPolicy.ragEvaluation = ragEvaluation;
      existingPolicy.version = (existingPolicy.version || 1) + 1;
      existingPolicy.status = 'review';
      existingPolicy.uploadedBy = session.user.id;
      await existingPolicy.save();
      policy = existingPolicy;
    } else {
      policy = await LenderPolicy.create({
        lenderName: extracted.lenderName || 'Unknown Lender',
        productName: extracted.productName || 'Education Loan',
        uploadedBy: session.user.id,
        sourceDocumentUrl: cloudinaryResult.secure_url,
        sourceDocumentName: file.name,
        rawExtractedText: extractedText,
        extractedPolicies: pol,
        status: 'review',
        aiConfidenceScore: extracted.aiConfidenceScore || 50,
        aiExtractionNotes: extracted.aiExtractionNotes || '',
        ragEvaluation,
        version: 1,
      });
    }

    return NextResponse.json({
      success: true,
      isUpdate,
      policy: {
        _id: policy._id,
        lenderName: policy.lenderName,
        productName: policy.productName,
        status: policy.status,
        version: policy.version,
        aiConfidenceScore: policy.aiConfidenceScore,
        aiExtractionNotes: policy.aiExtractionNotes,
        sourceDocumentName: policy.sourceDocumentName,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      },
      ragEvaluation,
      changeDetection: isUpdate ? changeDetection : null,
    });
  } catch (error) {
    console.error('[policy-upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process policy document', details: (error as Error).message },
      { status: 500 }
    );
  }
}
