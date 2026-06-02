import { NextResponse } from 'next/server';
import { getFlashModel, generateWithRetry, parseJSONFromResponse } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { brief } = await request.json();

    if (!brief || typeof brief !== 'string' || brief.trim().length === 0) {
      return NextResponse.json(
        { isValid: false, reason: 'Campaign brief is required.' },
        { status: 200 }
      );
    }

    const model = getFlashModel();

    const systemPrompt = `You are a campaign validation assistant for StudyStack, an overseas education consultancy.
Your task is to analyze the user's campaign brief/prompt and determine if it represents a valid, real, and coherent campaign concept, idea, or request.

An input is INVALID (isValid: false) if it is:
1. Gibberish or random character sequences (e.g., "ABC XYZ", "asdfasdf", "qwerty").
2. Extremely low effort, incomplete, placeholder-heavy, or non-sensical (e.g., "country or whatever", "do something random", "input abc", "xyz abc university country or whatever", "some random stuff").
3. Placeholder names like "XYZ University", "ABC Country" without real substance or specific details.
4. Completely unrelated to student outreach, education, counseling, university programs, study abroad, IELTS preparation, or student marketing.
5. Spam, offensive, or containing inappropriate content.

An input is VALID (isValid: true) if it is:
1. A real or meaningful concept, idea, target destination, or outreach strategy (e.g., "UK intake campaign for engineering graduates", "IELTS coaching webinar outreach", "Help students targeting Ireland colleges", even if simple or brief). It must refer to real countries or real study concepts, not placeholder/dummy names like "ABC country" or "XYZ university".

Respond with ONLY a valid JSON object in this format:
{
  "isValid": false or true,
  "reason": "If invalid, a short and helpful message advising the user to enter a valid campaign concept or idea. If valid, a brief explanation of why."
}

User's Campaign Brief:
"${brief.replace(/"/g, '\\"')}"

Respond with ONLY the JSON object:`;

    const responseText = await generateWithRetry(model, systemPrompt);
    const parsedResponse = parseJSONFromResponse(responseText);

    const isValid = parsedResponse.isValid === true;
    const reason = parsedResponse.reason || 'Please enter a valid real workflow concept or idea.';

    return NextResponse.json({
      isValid,
      reason
    });

  } catch (error) {
    console.error('Error validating campaign brief:', error);
    // Fail-open for API issues to ensure app continues to work if Gemini has a temporary issue
    return NextResponse.json({
      isValid: true,
      reason: 'Validation bypassed due to system error.'
    });
  }
}
