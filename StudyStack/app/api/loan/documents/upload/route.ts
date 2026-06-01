import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LoanApplication from '@/lib/models/LoanApplication';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/documents/upload
 *
 *  Accepts a student document upload, stores in Cloudinary, optionally
 *  performs OCR (for images via Tesseract.js), and uses Gemini AI to
 *  validate the document against expected requirements.
 *
 *  Updates both uploadedDocuments array and documentChecklist status.
 * ──────────────────────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentName = formData.get('documentName') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!documentName) {
      return NextResponse.json({ error: 'documentName is required' }, { status: 400 });
    }

    // ── 1. Upload to Cloudinary ────────────────────────────────────────
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: isImage ? 'image' : 'raw',
          folder: 'studystack/loan-documents',
          public_id: `doc_${session.user.id}_${Date.now()}_${documentName.replace(/[^a-zA-Z0-9]/g, '_')}`,
        },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(fileBuffer);
    });

    // ── 2. Extract text for validation ─────────────────────────────────
    let extractedText = '';

    if (isPDF) {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(fileBuffer);
        extractedText = pdfData.text || '';
      } catch (e) {
        console.warn('[doc-upload] PDF parse failed:', (e as Error).message);
      }
    } else if (isImage) {
      // Use Tesseract.js for OCR on images
      try {
        const Tesseract = await import('tesseract.js');
        const result = await Tesseract.recognize(fileBuffer, 'eng');
        extractedText = result.data.text || '';
      } catch (e) {
        console.warn('[doc-upload] OCR failed:', (e as Error).message);
      }
    }

    // ── 3. AI Validation via Gemini ────────────────────────────────────
    let validation: any = {
      status: 'pending',
      extractedData: {},
      issues: [],
      confidenceScore: 0,
    };

    if (extractedText && extractedText.length > 20) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const { parseJSONFromResponse } = await import('@/lib/gemini');
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        // Fetch student profile for cross-validation
        const loanApp = await LoanApplication.findOne({ userId: session.user.id }).lean();
        const profileSnapshot = (loanApp as any)?.profileSnapshot || {};

        const validationPrompt = `You are a document verification AI for education loan applications. Analyze the following extracted text from a "${documentName}" document.

## EXTRACTED TEXT
${extractedText.substring(0, 5000)}

## STUDENT PROFILE (for cross-validation)
- Name: ${profileSnapshot.studentName || 'Not available'}
- Country: ${profileSnapshot.targetCountry || 'Not available'}

## INSTRUCTIONS
Validate this document and return ONLY valid JSON:
{
  "status": "valid|issues_found|unreadable",
  "extractedData": {
    "documentType": "What type of document this appears to be",
    "nameFound": "Name found in document if any",
    "dateFound": "Any relevant date found",
    "amountFound": "Any monetary amount found",
    "keyInformation": "Most important info extracted"
  },
  "issues": ["List of issues found, e.g., 'Name mismatch', 'Document appears expired', 'Quality too low to read'"],
  "confidenceScore": 75,
  "suggestions": "Brief suggestion for the student if issues found"
}

RULES:
- If the text is too garbled or short, set status to "unreadable"
- Cross-validate names with the student profile if available
- Check for common issues: expired documents, missing signatures, incorrect formats
- confidenceScore (0-100) reflects how confident you are in the document's validity`;

        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: validationPrompt,
          config: { temperature: 0.2, maxOutputTokens: 1500 },
        });

        const responseText = (result.text ?? '').trim();
        try {
          validation = parseJSONFromResponse(responseText);
        } catch {
          validation.status = 'pending';
          validation.issues = ['AI validation could not parse the document'];
        }
      } catch (e) {
        console.warn('[doc-upload] AI validation failed:', (e as Error).message);
        validation.status = 'pending';
      }
    } else {
      validation.status = extractedText.length > 0 ? 'pending' : 'unreadable';
      if (!extractedText) {
        validation.issues = ['Could not extract text from the document. The file may be a scanned image.'];
      }
    }

    // ── 4. Update LoanApplication ──────────────────────────────────────
    const uploadedDoc = {
      documentName,
      cloudinaryUrl: uploadResult.secure_url,
      uploadedAt: new Date(),
      aiValidation: validation,
    };

    const docStatus = validation.status === 'valid' ? 'verified'
      : validation.status === 'issues_found' ? 'uploaded'
      : 'uploaded';

    const existingApp = await LoanApplication.findOne({ userId: session.user.id });
    if (existingApp) {
      // Add to uploadedDocuments
      existingApp.uploadedDocuments = existingApp.uploadedDocuments || [];
      (existingApp.uploadedDocuments as any[]).push(uploadedDoc);
      existingApp.markModified('uploadedDocuments');

      // Update document checklist status
      const checklist = (existingApp.documentChecklist || []) as any[];
      const docIdx = checklist.findIndex((d: any) =>
        d.name.toLowerCase() === documentName.toLowerCase()
      );
      if (docIdx !== -1) {
        checklist[docIdx].status = docStatus;
        existingApp.documentChecklist = checklist;
        existingApp.markModified('documentChecklist');
      }

      // Auto-transition application status to docs_pending if not_started
      if (existingApp.applicationStatus === 'not_started') {
        existingApp.applicationStatus = 'docs_pending';
      }

      await existingApp.save();
    } else {
      try {
        await LoanApplication.create({
          userId: session.user.id,
          uploadedDocuments: [uploadedDoc],
          applicationStatus: 'docs_pending',
        });
      } catch (err: any) {
        if (err.code === 11000) {
          const concurrentApp = await LoanApplication.findOne({ userId: session.user.id });
          if (concurrentApp) {
            concurrentApp.uploadedDocuments = concurrentApp.uploadedDocuments || [];
            (concurrentApp.uploadedDocuments as any[]).push(uploadedDoc);
            concurrentApp.markModified('uploadedDocuments');

            const checklist = (concurrentApp.documentChecklist || []) as any[];
            const docIdx = checklist.findIndex((d: any) =>
              d.name.toLowerCase() === documentName.toLowerCase()
            );
            if (docIdx !== -1) {
              checklist[docIdx].status = docStatus;
              concurrentApp.documentChecklist = checklist;
              concurrentApp.markModified('documentChecklist');
            }

            if (concurrentApp.applicationStatus === 'not_started') {
              concurrentApp.applicationStatus = 'docs_pending';
            }
            await concurrentApp.save();
          }
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      success: true,
      document: {
        documentName,
        cloudinaryUrl: uploadResult.secure_url,
        validation,
      },
    });
  } catch (error) {
    console.error('[doc-upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', details: (error as Error).message },
      { status: 500 }
    );
  }
}
