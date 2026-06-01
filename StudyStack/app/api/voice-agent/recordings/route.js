import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import ConversationMemory from '@/lib/models/ConversationMemory';

// Register a process-wide unhandled rejection listener to catch and silence any internal Cloudinary SDK timeouts
if (typeof window === 'undefined' && !global.unhandledRejectionHandlerRegistered) {
  process.on('unhandledRejection', (reason) => {
    console.warn('[Process] Caught unhandled rejection (likely from Cloudinary SDK timeout):', reason);
  });
  global.unhandledRejectionHandlerRegistered = true;
}

/**
 * POST /api/voice-agent/recordings
 * Accepts a video recording blob (WebM) and uploads it to Cloudinary,
 * then saves the URL to the ConversationMemory document.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const recordingFile = formData.get('recording');
    const sessionId = formData.get('sessionId') || '';

    if (!recordingFile || !(recordingFile instanceof Blob)) {
      return NextResponse.json({ error: 'No recording file provided' }, { status: 400 });
    }

    // Convert the blob to a buffer for Cloudinary upload
    const arrayBuffer = await recordingFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const cloudinaryUrl = await uploadToCloudinary(buffer, session.user.id, sessionId);

    if (!cloudinaryUrl) {
      console.warn('[recordings] Recording upload failed — continuing onboarding gracefully');
      return NextResponse.json({
        success: false,
        warning: 'Failed to upload recording to Cloudinary',
        recordingUrl: null,
      });
    }

    // Update the ConversationMemory document with the recording URL
    if (sessionId) {
      await dbConnect();
      await ConversationMemory.findOneAndUpdate(
        {
          $or: [
            { conversationId: sessionId },
            { anamSessionId: sessionId },
          ],
          userId: session.user.id,
        },
        {
          recordingUrl: cloudinaryUrl,
        },
        { sort: { createdAt: -1 } }
      );
    }

    return NextResponse.json({
      success: true,
      recordingUrl: cloudinaryUrl,
    });
  } catch (error) {
    console.error('[recordings] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save recording (graceful fallback)',
        details: error.message
      },
      { status: 200 }
    );
  }
}

async function uploadToCloudinary(buffer, userId, sessionId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[recordings] Cloudinary not configured — skipping upload');
    return null;
  }

  try {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const timestamp = Math.round(Date.now() / 1000);
    const folder = `studystack/recordings/${userId}`;
    const publicId = `session-${sessionId || timestamp}`;

    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder,
          public_id: publicId,
          timeout: 60000,
          tags: ['counselling-recording', `user-${userId}`],
        },
        (error, result) => {
          if (error) {
            console.error('[recordings] Cloudinary upload error:', error);
            resolve(null); // Graceful — don't crash the server
          } else {
            resolve(result.secure_url);
          }
        }
      );

      // Handle stream error event to prevent unhandledRejection
      uploadStream.on('error', (err) => {
        console.error('[recordings] Upload stream error:', err);
        resolve(null);
      });

      // Write buffer to stream
      const { Readable } = require('stream');
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);

      readable.on('error', (err) => {
        console.error('[recordings] Readable stream error:', err);
        resolve(null);
      });

      readable.pipe(uploadStream);
    });
  } catch (error) {
    console.error('[recordings] Upload failed:', error);
    return null;
  }
}
