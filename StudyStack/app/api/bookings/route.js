import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Booking from '@/lib/models/Booking';

/**
 * GET /api/bookings
 *
 * Returns all bookings (optionally filtered by status or date range).
 * Query params:
 *   - status: pending | confirmed | cancelled | completed
 *   - from: ISO date string (inclusive)
 *   - to: ISO date string (inclusive)
 */
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const filter = {};

    if (status) {
      filter.status = status;
    } else {
      // By default exclude cancelled
      filter.status = { $ne: 'cancelled' };
    }

    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to) filter.scheduledAt.$lte = new Date(to);
    }

    const bookings = await Booking.find(filter)
      .sort({ scheduledAt: 1 })
      .lean();

    // Serialize for JSON
    const serialized = bookings.map((b) => ({
      _id: String(b._id),
      studentName: b.studentName || 'Unknown Student',
      phoneNumber: b.phoneNumber,
      scheduledAt: b.scheduledAt?.toISOString(),
      durationMinutes: b.durationMinutes || 30,
      status: b.status,
      notes: b.notes || '',
      createdAt: b.createdAt?.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[api/bookings] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
