/**
 * test-linkedin-post.mjs
 *
 * Standalone test script to verify LinkedIn posting works WITHOUT
 * running the full campaign workflow.
 *
 * Usage:
 *   node test-linkedin-post.mjs              # text-only post
 *   node test-linkedin-post.mjs --with-image  # post with a campaign image
 *
 * Prerequisites:
 *   - LINKEDIN_ACCESS_TOKEN must be set in .env
 *   - For --with-image: the dev server must be running (npm run dev)
 *     so the script can serve the local image via http://localhost:3000
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LINKEDIN_API_VERSION = '202605';
let ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;

// ── Step 0: Get Token from DB ─────────────────────────────────────────────
async function getTokenFromDB() {
  console.log('\n🔍 Fetching latest token from MongoDB...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Define minimal User schema for the test
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    // Find the most recently updated user who has a linkedin token
    const user = await User.findOne({ 
      'socialTokens.linkedin.access_token': { $exists: true } 
    }).sort({ 'socialTokens.linkedin.connected_at': -1 }).lean();
    
    await mongoose.disconnect();
    
    if (user && user.socialTokens?.linkedin?.access_token) {
      console.log(`✅ Found connected LinkedIn account for user: ${user.name || user.email}`);
      return user.socialTokens.linkedin.access_token;
    }
  } catch (err) {
    console.error('⚠️ Could not fetch from MongoDB:', err.message);
  }
  return null;
}

const withImage = process.argv.includes('--with-image');

// ── Helper: find a campaign image in public/ ──────────────────────────────
function findTestImage() {
  const campaignDir = path.join(__dirname, 'public', 'campaign-images', 'campaign');
  if (!fs.existsSync(campaignDir)) return null;

  const files = fs.readdirSync(campaignDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  if (files.length === 0) return null;

  // Return the localhost URL (requires dev server running)
  return `http://localhost:3000/campaign-images/campaign/${files[0]}`;
}

// ── Step 1: Verify token & get profile ────────────────────────────────────
async function getProfile() {
  console.log('\n🔑 Step 1: Verifying LinkedIn access token...');

  // Try /v2/userinfo first (OpenID Connect — newer tokens)
  let res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });

  if (res.ok) {
    const profile = await res.json();
    const personUrn = `urn:li:person:${profile.sub}`;
    console.log(`✅ Authenticated as: ${profile.name || profile.email || profile.sub}`);
    console.log(`   Person URN: ${personUrn}`);
    return { personUrn, profile };
  } else {
    const err = await res.json().catch(() => ({}));
    console.log('   /v2/userinfo failed:', res.status, JSON.stringify(err));
  }

  // Fallback to /v2/me (works with older w_member_social tokens)
  res = await fetch('https://api.linkedin.com/v2/me', {
    headers: { 
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0'
    },
  });

  if (res.ok) {
    const profile = await res.json();
    const personUrn = `urn:li:person:${profile.id}`;
    const displayName = `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim();
    console.log(`✅ Authenticated as: ${displayName || profile.id}`);
    console.log(`   Person URN: ${personUrn}`);
    return { personUrn, profile };
  }

  const err = await res.json().catch(() => ({}));
  console.error('❌ Token verification failed:', res.status, JSON.stringify(err, null, 2));
  console.error('   Your token has expired. Re-connect LinkedIn via: http://localhost:3000/api/linkedin/auth');
  process.exit(1);
}

// ── Step 2: Upload image (optional) ───────────────────────────────────────
async function uploadImage(personUrn, imageUrl) {
  console.log(`\n📸 Step 2: Uploading image from ${imageUrl}...`);

  // 2a: Initialize upload
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: personUrn },
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    console.error('❌ Image init failed:', initRes.status, errText);
    return null;
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;
  console.log(`   Upload URL obtained. Image URN: ${imageUrn}`);

  // 2b: Fetch the image binary
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    console.error(`❌ Could not fetch image from ${imageUrl} (${imgRes.status})`);
    console.error('   Make sure your dev server is running (npm run dev)');
    return null;
  }
  const imageBuffer = await imgRes.arrayBuffer();
  console.log(`   Fetched image: ${imageBuffer.byteLength} bytes`);

  // 2c: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (uploadRes.ok || uploadRes.status === 201) {
    console.log(`✅ Image uploaded successfully! URN: ${imageUrn}`);
    return imageUrn;
  } else {
    const errText = await uploadRes.text();
    console.error('❌ Image upload failed:', uploadRes.status, errText);
    return null;
  }
}

// ── Step 3: Create post ───────────────────────────────────────────────────
async function createPost(personUrn, imageUrn) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const commentary = `🧪 StudyStack LinkedIn Integration Test — ${timestamp}\n\nThis is an automated test post from the StudyStack campaign engine to verify the LinkedIn Posts API integration is working correctly.\n\n#StudyStack #TestPost #AIMarketing`;

  console.log('\n📝 Step 3: Creating LinkedIn post...');
  console.log(`   Text preview: ${commentary.substring(0, 80)}...`);

  const postBody = {
    author: personUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
  };

  if (imageUrn) {
    postBody.content = {
      media: {
        id: imageUrn,
        title: 'StudyStack Campaign Test Image',
      },
    };
    console.log(`   Attaching image: ${imageUrn}`);
  }

  const postRes = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  });

  if (postRes.status === 201 || postRes.ok) {
    const postId = postRes.headers.get('x-restli-id') || postRes.headers.get('x-linkedin-id') || 'unknown';
    console.log('\n🎉 ════════════════════════════════════════════');
    console.log('   SUCCESS! Post created on LinkedIn!');
    console.log(`   Post ID: ${postId}`);
    console.log('   ════════════════════════════════════════════\n');
    return true;
  }

  const errorData = await postRes.json().catch(() => ({}));
  console.error('\n❌ Post creation failed:', postRes.status);
  console.error('   Response:', JSON.stringify(errorData, null, 2));

  // Common error guidance
  if (postRes.status === 401 || postRes.status === 403) {
    console.error('\n💡 Your token may have expired or lacks the w_member_social scope.');
    console.error('   Re-authenticate via: http://localhost:3000/api/linkedin/auth');
  } else if (postRes.status === 422) {
    console.error('\n💡 The request body may have invalid fields. Check the LinkedIn API docs.');
  }

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  StudyStack LinkedIn Post Test Script');
  console.log(`  Mode: ${withImage ? 'Text + Image' : 'Text Only'}`);
  console.log('═══════════════════════════════════════════════════');

  const dbToken = await getTokenFromDB();
  if (dbToken) {
    ACCESS_TOKEN = dbToken;
  }

  if (!ACCESS_TOKEN) {
    console.error('\n❌ LINKEDIN_ACCESS_TOKEN is missing (not in DB or .env)');
    console.error('   Please connect LinkedIn via your profile page first: http://localhost:3000/profile');
    process.exit(1);
  }

  const { personUrn } = await getProfile();

  let imageUrn = null;
  if (withImage) {
    const imageUrl = findTestImage();
    if (!imageUrl) {
      console.warn('⚠️  No campaign images found in public/campaign-images/campaign/');
      console.warn('   Falling back to text-only post.');
    } else {
      console.log(`   Found test image: ${imageUrl}`);
      imageUrn = await uploadImage(personUrn, imageUrl);
    }
  }

  const success = await createPost(personUrn, imageUrn);
  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
