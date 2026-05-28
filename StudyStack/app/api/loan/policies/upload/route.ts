import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LenderPolicy from '@/lib/models/LenderPolicy';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/policies/upload
 *
 *  Accepts a PDF file upload from a counsellor, extracts text using pdf-parse,
 *  then uses Gemini AI to extract structured lender policy information.
 *  Saves the policy with status='review' for counsellor verification.
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

    // ── 1. Upload to Cloudinary ────────────────────────────────────────
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult: any = await new Promise((resolve, reject) => {
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

    // ── 2. Extract text from document ──────────────────────────────────
    let extractedText = '';

    if (file.type === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text || '';
    } else if (file.type === 'text/plain') {
      extractedText = fileBuffer.toString('utf-8');
    } else {
      // For DOCX, extract raw text (basic approach)
      extractedText = fileBuffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract sufficient text from the document. Please ensure the document is readable.' },
        { status: 400 }
      );
    }

    // Truncate very long documents for AI processing
    const maxChars = 30000;
    const truncatedText = extractedText.length > maxChars
      ? extractedText.substring(0, maxChars) + '\n\n[Document truncated for processing — full text preserved in database]'
      : extractedText;

    // ── 3. Use Gemini to extract structured policy data ────────────────
    const { GoogleGenAI } = await import('@google/genai');
    const { parseJSONFromResponse } = await import('@/lib/gemini');
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const extractionPrompt = `You are an expert education loan policy analyst. Analyze the following lender policy document and extract ALL relevant information into a structured JSON format.

## DOCUMENT TEXT
${truncatedText}

## INSTRUCTIONS
Extract the following information from the document. If a piece of information is not found, use null or empty arrays. Be thorough and precise.

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
      "additionalCriteria": ["Any other criteria found"]
    },
    "financial": {
      "interestRateMin": 8.5,
      "interestRateMax": 12.0,
      "maxLoanAmountINR": 10000000,
      "minLoanAmountINR": 100000,
      "collateralRequired": true,
      "collateralThresholdINR": 4000000,
      "processingFeePercent": 1.0,
      "insuranceRequired": false,
      "marginMoneyPercent": null
    },
    "repayment": {
      "minTenureMonths": 12,
      "maxTenureMonths": 180,
      "moratoriumMonths": 6,
      "repaymentOptions": ["Standard EMI", "Interest-only during study"],
      "prepaymentAllowed": true,
      "prepaymentPenaltyPercent": null,
      "emiStartCondition": "After moratorium period"
    },
    "documents": [
      {
        "name": "Document name",
        "required": true,
        "conditions": "When this document is needed",
        "category": "identity|academic|financial|property|admission|other"
      }
    ],
    "restrictions": {
      "approvedUniversities": [],
      "excludedPrograms": [],
      "countrySpecificNotes": {},
      "maxCourseDurationYears": null,
      "onlyFullTime": false
    },
    "specialFeatures": ["Feature 1", "Feature 2"],
    "taxBenefits": "Section 80E details if mentioned",
    "additionalNotes": "Any other relevant policy information"
  }
}

CRITICAL RULES:
- Extract ONLY what is explicitly stated or clearly implied in the document.
- Convert all monetary amounts to INR. If in lakhs, multiply by 100000. If in crores, multiply by 10000000.
- Interest rates should be in percentage (e.g., 8.5 not 0.085).
- aiConfidenceScore (0-100) should reflect how much useful data you could extract.
- If the document is unclear or partial, note this in aiExtractionNotes.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: extractionPrompt,
      config: { temperature: 0.2, maxOutputTokens: 8000 },
    });

    const responseText = (result.text ?? '').trim();
    let extracted;
    try {
      extracted = parseJSONFromResponse(responseText);
    } catch {
      console.error('[policy-upload] Gemini returned invalid JSON:', responseText.substring(0, 500));
      return NextResponse.json(
        { error: 'AI could not parse the document. Please try a different format.' },
        { status: 500 }
      );
    }

    // ── 4. Save to database ────────────────────────────────────────────
    const policy = await LenderPolicy.create({
      lenderName: extracted.lenderName || 'Unknown Lender',
      productName: extracted.productName || 'Education Loan',
      uploadedBy: session.user.id,
      sourceDocumentUrl: uploadResult.secure_url,
      sourceDocumentName: file.name,
      rawExtractedText: extractedText,
      extractedPolicies: extracted.extractedPolicies || {},
      status: 'review',
      aiConfidenceScore: extracted.aiConfidenceScore || 50,
      aiExtractionNotes: extracted.aiExtractionNotes || '',
    });

    return NextResponse.json({
      success: true,
      policy: {
        _id: policy._id,
        lenderName: policy.lenderName,
        productName: policy.productName,
        status: policy.status,
        aiConfidenceScore: policy.aiConfidenceScore,
        aiExtractionNotes: policy.aiExtractionNotes,
        extractedPolicies: policy.extractedPolicies,
        sourceDocumentName: policy.sourceDocumentName,
        createdAt: policy.createdAt,
      },
    });
  } catch (error) {
    console.error('[policy-upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process policy document', details: (error as Error).message },
      { status: 500 }
    );
  }
}
