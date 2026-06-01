import { NextResponse } from 'next/server';

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;

/**
 * LinkedIn Posts API version header.
 * Must be in YYYYMM format. Using a recent supported version.
 */
const LINKEDIN_API_VERSION = '202605';

export async function POST(req) {
  const { text, access_token, imageUrls } = await req.json();
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }

  // Use provided token or fall back to app-level token
  const token = access_token || LINKEDIN_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: 'No access token available. Please connect LinkedIn in your profile or set LINKEDIN_ACCESS_TOKEN in .env' },
      { status: 400 }
    );
  }

  console.log('[linkedin-post] Starting post. Image count:', imageUrls?.length || 0);

  try {
    // ── 1. Get the author URN ──────────────
    let personUrn = '';
    
    // Try OpenID Connect /v2/userinfo first
    let profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (profileRes.ok) {
      const profile = await profileRes.json();
      personUrn = `urn:li:person:${profile.sub}`;
    } else {
      // Fallback to /v2/me (for non-OIDC tokens)
      profileRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0'
        },
      });
      
      if (!profileRes.ok) {
        const errorData = await profileRes.json().catch(() => ({}));
        console.error('[linkedin-post] Profile fetch failed:', profileRes.status, errorData);
        return NextResponse.json(
          { error: 'Failed to get LinkedIn profile. Token may be expired — please reconnect LinkedIn.', details: errorData },
          { status: 400 }
        );
      }
      
      const profile = await profileRes.json();
      personUrn = `urn:li:person:${profile.id}`;
    }
    console.log('[linkedin-post] Author URN:', personUrn);

    // ── 2. Upload images using the new Images API ─────────────────────
    let uploadedImageUrns = [];

    if (imageUrls && imageUrls.length > 0) {
      console.log(`[linkedin-post] Uploading ${imageUrls.length} image(s) via Images API...`);

      for (const imageUrl of imageUrls.slice(0, 9)) {
        try {
          // Step 2a: Initialize upload
          const initRes = await fetch(
            'https://api.linkedin.com/rest/images?action=initializeUpload',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'LinkedIn-Version': LINKEDIN_API_VERSION,
                'X-Restli-Protocol-Version': '2.0.0',
              },
              body: JSON.stringify({
                initializeUploadRequest: {
                  owner: personUrn,
                },
              }),
            }
          );

          if (!initRes.ok) {
            const errBody = await initRes.text();
            console.error('[linkedin-post] Image init upload failed:', initRes.status, errBody);
            continue;
          }

          const initData = await initRes.json();
          const uploadUrl = initData.value?.uploadUrl;
          const imageUrn = initData.value?.image;

          if (!uploadUrl || !imageUrn) {
            console.error('[linkedin-post] Missing uploadUrl or image URN from init response:', initData);
            continue;
          }

          console.log('[linkedin-post] Image upload URL obtained. URN:', imageUrn);

          // Step 2b: Download the image from the source URL
          const imgFetchRes = await fetch(imageUrl);
          if (!imgFetchRes.ok) {
            console.error(`[linkedin-post] Failed to fetch source image: ${imageUrl} (${imgFetchRes.status})`);
            continue;
          }

          const imageBuffer = await imgFetchRes.arrayBuffer();
          const nodeBuffer = Buffer.from(imageBuffer);
          console.log(`[linkedin-post] Fetched image (${nodeBuffer.byteLength} bytes)`);

          // Step 2c: Upload the binary to LinkedIn's upload URL
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/octet-stream',
              'Content-Length': nodeBuffer.byteLength.toString(),
            },
            body: nodeBuffer,
          });

          if (uploadRes.ok || uploadRes.status === 201) {
            uploadedImageUrns.push(imageUrn);
            console.log(`[linkedin-post] Image uploaded successfully. URN: ${imageUrn}`);
          } else {
            const errText = await uploadRes.text();
            console.error('[linkedin-post] Image binary upload failed:', uploadRes.status, errText);
          }
        } catch (imgError) {
          console.error('[linkedin-post] Error during image upload:', imgError);
        }
      }
    }

    // ── 3. Create the post using the new Posts API ─────────────────────
    const postBody = {
      author: personUrn,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
    };

    // Attach images if we uploaded any
    if (uploadedImageUrns.length > 0) {
      if (uploadedImageUrns.length === 1) {
        // Single image post
        postBody.content = {
          media: {
            id: uploadedImageUrns[0],
            title: 'Campaign image',
          },
        };
      } else {
        // Multi-image post (carousel-style)
        postBody.content = {
          multiImage: {
            images: uploadedImageUrns.map((urn) => ({
              id: urn,
              altText: 'Campaign image',
            })),
          },
        };
      }
    }

    console.log('[linkedin-post] Creating post with', uploadedImageUrns.length, 'image(s)...');

    const postRes = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    });

    // The Posts API returns 201 Created with the post URN in the x-restli-id header
    if (postRes.status === 201 || postRes.ok) {
      const postId = postRes.headers.get('x-restli-id') || postRes.headers.get('x-linkedin-id') || 'unknown';
      console.log('[linkedin-post] ✅ Post created successfully! Post ID:', postId);
      return NextResponse.json({
        success: true,
        post: { id: postId },
      });
    }

    // Handle error
    const errorData = await postRes.json().catch(() => ({}));
    console.error('[linkedin-post] Post creation failed:', postRes.status, JSON.stringify(errorData));
    return NextResponse.json(
      { error: 'Failed to post to LinkedIn', details: errorData },
      { status: postRes.status }
    );
  } catch (error) {
    console.error('[linkedin-post] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to post to LinkedIn', details: error.message },
      { status: 500 }
    );
  }
}
