import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, transcript } = await req.json();
    if (!transcript) {
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const g = user.gamification || {};
    const text = transcript.toLowerCase();
    
    // Very basic keyword detection for milestones
    // In production, this would be an LLM extraction pass
    let triggeredMilestone = null;
    let awardAction = null;

    if (!g.milestoneFlags?.ieltsScoreAdded && 
       (text.includes('ielts') || text.includes('toefl')) && 
       (text.includes('gave the exam') || text.includes('score') || text.includes('band') || text.includes('taken') || text.includes('completed'))) {
      triggeredMilestone = 'IELTS/TOEFL Test';
      awardAction = 'ielts_score_added';
    } 
    else if (!g.milestoneFlags?.shortlistDone && 
            (text.includes('shortlist') || text.includes('university list') || text.includes('shortlisted')) && 
            (text.includes('done') || text.includes('completed') || text.includes('finalized') || text.includes('ready'))) {
      triggeredMilestone = 'University Shortlist';
      awardAction = 'shortlist_done';
    }
    else if (!g.milestoneFlags?.sopDone && 
            (text.includes('sop') || text.includes('lor') || text.includes('statement of purpose') || text.includes('recommendation letter')) && 
            (text.includes('done') || text.includes('completed') || text.includes('ready') || text.includes('written') || text.includes('prepared'))) {
      triggeredMilestone = 'SOP and LOR Set';
      awardAction = 'sop_done';
    }
    else if (!g.milestoneFlags?.applicationSubmitted && 
            (text.includes('applied to') || text.includes('submitted application') || text.includes('submitted applications') || text.includes('application submitted'))) {
      triggeredMilestone = 'Application Submitted';
      awardAction = 'application_submitted';
    }
    else if (!g.milestoneFlags?.visaDone && 
            (text.includes('got my visa') || text.includes('visa approved') || text.includes('visa is done') || text.includes('visa complete'))) {
      triggeredMilestone = 'Visa Approved';
      awardAction = 'visa_done';
    }

    // If we detected a milestone, we call our own award API internally
    let awardResult = null;
    if (awardAction) {
      const host = req.headers.get('host');
      const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
      
      const awardReq = await fetch(`${protocol}://${host}/api/gamification/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') // Pass session cookie
        },
        body: JSON.stringify({ action: awardAction })
      });
      
      if (awardReq.ok) {
        awardResult = await awardReq.json();
      }
    }

    return NextResponse.json({
      triggeredMilestone,
      awardAction,
      awardResult
    });

  } catch (error) {
    console.error('[gamification/milestone] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
