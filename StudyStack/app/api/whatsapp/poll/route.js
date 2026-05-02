import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import WhatsAppPollState from '@/lib/models/WhatsAppPollState';
import { handleIncomingMessage } from '@/lib/whatsapp/handleIncoming';

const WHAPI_BASE = 'https://gate.whapi.cloud';

/**
 * Fetch recent incoming messages from Whapi's REST API.
 * Uses /messages/list with from_me=false to only get incoming messages.
 */
async function fetchMessages(token, timeFrom) {
  const params = new URLSearchParams({
    count: '50',
    from_me: 'false',
    sort: 'asc',
  });
  if (timeFrom > 0) {
    params.set('time_from', String(timeFrom));
  }

  const res = await fetch(`${WHAPI_BASE}/messages/list?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Whapi messages/list failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * GET /api/whatsapp/poll
 *
 * Polls Whapi for new incoming messages and processes them
 * through the existing handleIncomingMessage handler.
 * Returns the count of newly processed messages.
 */
export async function GET() {
  const token = process.env.WHAPI_TOKEN;
  if (!token) {
    return NextResponse.json({ processed: 0, disabled: true, reason: 'WHAPI_TOKEN not configured' });
  }

  try {
    await dbConnect();

    // Atomic lock — prevent concurrent poll processing
    const pollState = await WhatsAppPollState.findOneAndUpdate(
      { _id: 'singleton', processing: { $ne: true } },
      { $set: { processing: true } },
      { new: true, upsert: false }
    );

    if (!pollState) {
      // Either no doc yet or another poll is already running
      const exists = await WhatsAppPollState.findById('singleton');
      if (!exists) {
        // First-ever poll — create doc with 5-min lookback
        const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
        await WhatsAppPollState.create({
          _id: 'singleton',
          lastPollTimestamp: fiveMinAgo,
          lastMessageId: '',
          processing: false,
        });
        return NextResponse.json({ processed: 0, total: 0, note: 'initialized' });
      }
      // Another poll is in progress — skip
      return NextResponse.json({ processed: 0, skipped: true });
    }

    let processed = 0;
    let latestTimestamp = pollState.lastPollTimestamp;
    let latestId = pollState.lastMessageId;

    try {
      const data = await fetchMessages(token, pollState.lastPollTimestamp);
      const messages = data?.messages || [];

    for (const msg of messages) {
      // Skip if we've already processed this exact message
      if (msg.id && msg.id === pollState.lastMessageId) continue;

      // Skip outbound messages (already filtered by API, but double-check)
      if (msg.from_me === true) continue;

      // Only process text messages
      if (msg.type !== 'text') continue;

      // Only process 1:1 chats (chat_id ending with @s.whatsapp.net), skip groups
      const chatId = msg.chat_id || '';
      if (chatId.endsWith('@g.us') || chatId.endsWith('@newsletter')) continue;

      // Extract phone number (digits only)
      const phoneNumber = String(msg.from || chatId)
        .replace(/@.*$/, '')
        .replace(/[^0-9]/g, '');
      const messageText = msg.text?.body || msg.body || '';

      if (!phoneNumber || !messageText) continue;

      // Skip messages older than our cursor
      const msgTimestamp = msg.timestamp || 0;
      if (msgTimestamp < pollState.lastPollTimestamp) continue;
      if (
        msgTimestamp === pollState.lastPollTimestamp &&
        msg.id &&
        msg.id <= pollState.lastMessageId
      ) continue;

      console.log(`[whatsapp-poll] Processing message from ${phoneNumber}: "${messageText.slice(0, 50)}..."`);

      try {
        await handleIncomingMessage(phoneNumber, messageText);
        processed++;
      } catch (err) {
        console.error(`[whatsapp-poll] handler error for ${phoneNumber}:`, err);
      }

      // Track the latest processed message
      if (msgTimestamp >= latestTimestamp) {
        latestTimestamp = msgTimestamp;
        latestId = msg.id || latestId;
      }
    }

    // Advance the cursor and release lock
    if (processed > 0) {
      pollState.lastPollTimestamp = latestTimestamp + 1;
      pollState.lastMessageId = latestId;
    }
    pollState.processing = false;
    await pollState.save();

    return NextResponse.json({ processed, total: messages.length });
    } catch (innerErr) {
      // Release lock even if processing fails
      pollState.processing = false;
      await pollState.save().catch(() => {});
      throw innerErr;
    }
  } catch (error) {
    console.error('[whatsapp-poll] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/whatsapp/poll
 *
 * Reset the poll state. Useful for re-processing messages
 * or when the poll cursor gets out of sync.
 */
export async function POST() {
  try {
    await dbConnect();
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    await WhatsAppPollState.findByIdAndUpdate(
      'singleton',
      { lastPollTimestamp: fiveMinAgo, lastMessageId: '', processing: false },
      { upsert: true }
    );
    return NextResponse.json({ status: 'reset', from: fiveMinAgo });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
