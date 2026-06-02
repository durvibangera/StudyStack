import { WorkflowNode, WorkflowEdge, NodeExecutionContext } from '@/types/workflow';

/**
 * Builds the execution context for a node by analyzing incoming edges
 * and compiling context from source nodes
 */
export function buildExecutionContext(
  targetNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  campaignBrief: string,
  campaignStrategy: string,
  kyc?: Record<string, any>
): NodeExecutionContext {
  // Find the target node
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    throw new Error(`Node with ID ${targetNodeId} not found`);
  }

  // Find all incoming edges to this node
  const incomingEdges = edges.filter(edge => edge.target === targetNodeId);

  // Build context from each incoming edge
  const incomingContext = incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    if (!sourceNode) {
      console.warn(`Source node ${edge.source} not found for edge ${edge.id}`);
      return null;
    }

    // Only include context if the source node has completed
    if (sourceNode.data.status !== 'complete' || !sourceNode.data.output) {
      return null;
    }

    return {
      sourceNodeId: sourceNode.id,
      sourceOutput: sourceNode.data.output,
      transferLogic: edge.data?.transferLogic || 'Use the output from the previous step',
      edgeLabel: edge.data?.label || edge.label || 'Context',
    };
  }).filter(Boolean) as NodeExecutionContext['incomingEdges'];

  return {
    nodeId: targetNode.id,
    nodeType: targetNode.data.type,
    promptContext: targetNode.data.promptContext,
    incomingEdges: incomingContext,
    campaignContext: {
      brief: campaignBrief,
      strategy: campaignStrategy,
      kyc,
    },
  };
}

/**
 * Compiles the final prompt by combining the node's base prompt
 * with context from incoming edges
 */
export function compilePrompt(context: NodeExecutionContext): string {
  const { nodeType, promptContext, incomingEdges, campaignContext } = context;

  // Start with campaign context
  let prompt = `CAMPAIGN CONTEXT:\n`;
  prompt += `Brief: ${campaignContext.brief}\n\n`;
  prompt += `Strategy Overview: ${campaignContext.strategy}\n\n`;

  // Include KYC student profile if available
  if (campaignContext.kyc) {
    try {
      const entries: string[] = [];
      Object.entries(campaignContext.kyc).forEach(([key, value]) => {
        if (value === null || typeof value === 'undefined') return;
        const prettyKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        if (Array.isArray(value)) {
          if (value.length) entries.push(`${prettyKey}: ${value.join(', ')}`);
        } else {
          entries.push(`${prettyKey}: ${String(value)}`);
        }
      });
      if (entries.length) {
        prompt += `STUDENT PROFILE (KYC):\n`;
        entries.forEach(line => { prompt += `- ${line}\n`; });
        prompt += `\nUse the student profile attributes above to tailor outputs (tone, channels, personas, timing, and constraints).\n\n`;
      }
    } catch {}
  }

  // Add context from incoming edges
  if (incomingEdges.length > 0) {
    prompt += `CONTEXT FROM PREVIOUS STEPS:\n`;
    
    incomingEdges.forEach((edge, index) => {
      prompt += `\n--- ${edge.edgeLabel} ---\n`;
      prompt += `Transfer Logic: ${edge.transferLogic}\n`;
      prompt += `Source Output:\n${edge.sourceOutput}\n`;
    });
    
    prompt += `\n`;
  }

  // Add the specific task for this node
  prompt += `YOUR TASK:\n`;
  prompt += `${promptContext}\n\n`;

  // Add type-specific instructions
  switch (nodeType) {
    case 'copy':
      prompt += `You are an Education Counselling Ad Copy generator for StudyStack, a leading overseas education consultancy specializing in UK and Ireland university placements.
Create platform-ready ads targeting prospective students and parents interested in studying abroad.
KEEP IT CONCISE. Return:
- 2 headlines (30-40 chars each) — e.g. "Your UK Dream Starts Here", "Study Abroad with Expert Guidance"
- 2 primary texts (80-120 chars) — focusing on benefits like 45,000+ placements, 120+ partner universities, IELTS/PTE training, scholarship assistance
- 2 CTAs — e.g. "Book Free Counselling", "Check Your Eligibility"
Output as a clean list. NO long explanations.\n`;
      break;
    
    case 'image':
      prompt += `Generate 4 professional social media marketing images for StudyStack's student outreach campaigns. CRITICAL: Each image must be a SINGLE cohesive scene — NOT a collage, NOT a grid, NOT multiple panels. All images should share a consistent brand aesthetic (navy, gold, white palette) while varying the subject: students on campus, graduation moments, study abroad lifestyle, university buildings. Style: polished Instagram/LinkedIn ad creative. If this model supports direct image output, return images. Otherwise, return detailed prompts.\n`;
      break;
    
    case 'research':
      prompt += `Conduct research on student outreach and overseas education counselling trends. Provide CONCISE, actionable insights relevant to StudyStack's UK/Ireland focus.
Consider: student demographics, admission cycle timing, IELTS/PTE preparation trends, popular courses, scholarship availability, visa process updates, competitor strategies.
LIMIT: 5-7 bullet points maximum. Be specific but brief. NO long paragraphs.\n`;
      break;
    
    case 'exa_research':
      prompt += `You are a Lead Generation Specialist for StudyStack, an overseas education consultancy. Your task is to produce a CLEAN, PROFESSIONAL lead report focused on ACTIONABLE contacts.

⚠️ CRITICAL: The CSV output will be used to send emails. Only include leads that can actually be contacted.

## OUTPUT STRUCTURE

### 1. EXECUTIVE SUMMARY (2-3 sentences)
Brief overview of findings and top opportunities.

### 2. 🔥 HOT LEADS (Score 85-100)
These are HIGH-PRIORITY, CONTACTABLE leads. Format as a clean table:
| Name | Email/Contact | Source | Why Hot |
Only include if: Has email OR LinkedIn profile with inferable email OR clear contact method.

### 3. 🌡️ WARM LEADS (Score 70-84)  
Interested prospects needing nurturing. Same table format.

### 4. 📥 EXPORT: Lead Database
\`\`\`csv
Name,Email,Phone,LinkedIn,Type,Score,Source URL,Next Action
\`\`\`

**CSV RULES:**
- ONLY include rows where you have at least ONE of: Email, Phone, or LinkedIn URL
- For LinkedIn profiles: Extract name from URL (john-smith → John Smith)
- For LinkedIn emails: Try pattern firstname.lastname@company.com if company is visible
- DO NOT include Reddit communities (r/studyAbroad, r/ukvisa etc) - these are intel, not leads
- DO NOT include competitor companies as leads
- Reddit users ARE valid leads if they show high intent (mark as "Reddit DM" in contact)
- Score must reflect CONTACT QUALITY not just interest level

**Lead Types (use exactly):**
- "Student" - Prospective student with contact info
- "Professional" - LinkedIn profile in education/career transition
- "Alumni" - UK university graduate (testimonial potential)
- "Advisor" - University admission officer or counselor

**Next Action (use exactly):**
- "Email Outreach" - Has email, ready to contact
- "LinkedIn Connect" - No email, but has LinkedIn
- "Phone Call" - Has phone number
- "Reddit DM" - Reddit user showing high intent
- "Research More" - Promising but needs more info

### 5. 📊 MARKET INTELLIGENCE (Separate section - NOT in CSV)
**Communities to Monitor:**
- List Reddit/Facebook communities with member counts if available

**Competitor Landscape:**
- List competitors with their positioning (this is intel, not leads)

**Student Pain Points:**
- Key themes from forum discussions

### 6. 💡 RECOMMENDED OUTREACH STRATEGY
3-5 specific actions based on the data.

---

## QUALITY STANDARDS

✅ GOOD CSV ROW (has email):
\`"Rahul Sharma","rahul.sharma@gmail.com","+919876543210","linkedin.com/in/rahul-sharma","Student",92,"reddit.com/r/studyAbroad/...","Email Outreach"\`

✅ GOOD CSV ROW (no email but LinkedIn):
\`"Priya Patel","","+919812345678","linkedin.com/in/priya-patel-uk","Professional",85,"linkedin.com/in/priya-patel-uk","LinkedIn Connect"\`

✅ GOOD CSV ROW (Reddit high-intent):
\`"u/scholarship_seeker","","","","Student",88,"reddit.com/r/studyAbroad/...","Reddit DM"\`

✅ GOOD CSV ROW (phone only):
\`"Amit Kumar","","+919998887776","","Student",80,"contactpage.com","Phone Call"\`

❌ BAD - Community:
\`"r/Indians_StudyAbroad","","","","Community",75,...\` ← This is market intel, NOT a lead!

❌ BAD - Competitor:
\`"Karan Gupta Consulting","kgc@karangupta.com","","","Competitor",64,...\` ← Don't email competitors!

❌ BAD - No contact:
\`"Unknown User","See URL","","","Student",60,...\` ← Useless for outreach!

---

Be professional, concise, and focus on ACTIONABLE leads that can actually be contacted for student recruitment.\n`;
      break;
    
    case 'strategy':
      prompt += `Provide strategic analysis and recommendations for student recruitment and counselling campaigns for StudyStack.
Consider: target student segments (undergrad/postgrad, regions, fields of study), intake timing (Jan/Sep), lead qualification (Hot/Warm/Cold scoring), counsellor productivity optimization, and channel strategy (webinars, social media, campus visits, WhatsApp).
LIMIT: 3-5 key points maximum. Use clear headings and brief bullet points. NO lengthy explanations.\n`;
      break;
    
    case 'timeline':
      prompt += `Create a concise campaign timeline for a student outreach or counselling campaign aligned with university intake cycles (UK/Ireland September and January intakes).
Include key milestones: awareness phase, lead generation, counselling sessions, application deadlines, visa processing windows, pre-departure orientation.
LIMIT: 5-7 key milestones maximum. Be specific with dates and actions. Keep descriptions under 15 words each.\n`;
      break;
    
    case 'distribution':
      prompt += `Provide a distribution strategy for reaching prospective students interested in studying abroad (UK/Ireland focus).
LIMIT: 4-6 channels maximum. Consider: Instagram/YouTube for awareness, WhatsApp for nurturing, webinars for engagement, email for follow-ups, campus ambassador programs, education fairs.
For each: channel name, timing (1 line), key tactics (2-3 bullet points). Keep it actionable and brief.\n`;
      break;
    
    case 'linkedin':
      prompt += `You are a LinkedIn content creator for StudyStack, a leading overseas education consultancy. Generate ONE professional LinkedIn post.\n
REQUIREMENTS:
- Maximum 2800 characters (strict limit - LinkedIn allows 3000 but leave buffer)
- Professional, informative, and inspiring tone aimed at students and parents
- Topics: study abroad success stories, university spotlight, scholarship tips, visa guidance, IELTS prep advice, student testimonials, placement milestones
- Include relevant hashtags (3-5) — e.g. #StudyAbroad #UKUniversities #IrelandEducation #IELTS #StudyStack
- Use line breaks for readability
- Focus on value: actionable tips, success metrics, or inspiring stories
- NO multiple post variations - just ONE post ready to publish

Output ONLY the post text, nothing else.\n`;
      break;
    
    case 'twitter':
      prompt += `You are a Twitter/X content creator for StudyStack, a study abroad consultancy. Generate ONE tweet.\n
REQUIREMENTS:
- Maximum 270 characters (strict limit - Twitter allows 280 but leave buffer)
- Engaging, motivational, student-focused
- Topics: study abroad tips, application deadlines, IELTS scores, scholarship alerts, placement stats
- Include 1-2 relevant hashtags — e.g. #StudyInUK #StudyAbroad
- Can use emojis sparingly (🎓📚✈️🌍)
- NO multiple tweet variations - just ONE tweet ready to publish

Output ONLY the tweet text, nothing else.\n`;
      break;
    
    case 'email':
      prompt += `You are an expert education marketing copywriter for StudyStack, a leading overseas education consultancy with 45,000+ successful placements. Your task is to write a premium, high-converting outreach email based on the campaign context.

⚠️ CRITICAL INSTRUCTION ⚠️
The campaign brief and strategy above are YOUR INSTRUCTIONS - they describe what to write about.
DO NOT copy the brief text into the email. DO NOT quote the brief.
Transform those instructions into persuasive, empathetic outreach copy that speaks directly to students and parents.

Think of it this way:
- Campaign Brief = Your assignment (what to create)
- Email Content = What you deliver to students (the actual outreach message)

⚠️ PERSONALIZATION PLACEHOLDERS ⚠️
- Use ONLY {{name}} for recipient name personalization
- DO NOT use {{FirstName}}, {{CompanyName}}, {{LastName}}, or any other placeholders
- DO NOT use bracketed placeholders like [Your Company Name], [University Name], [Link Here]
- All other content must be COMPLETE and STATIC - no placeholders anywhere
- Refer to the consultancy as "StudyStack" or "our team"
- CTA links can use '#' as href - they will be updated by the system

REQUIRED JSON OUTPUT (use ONLY this exact structure):
{
  "subject": "Compelling subject line here",
  "html": "<div style='background-color: #f8fafc; padding: 40px 10px; font-family: Inter, system-ui, sans-serif;'><div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;'><div style='background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center; border-bottom: 3px solid #eab308;'><span style='color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.02em;'>Study<span style='color: #eab308;'>Stack</span></span></div><div style='padding: 40px 30px;'><h2 style='color: #0f172a; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.01em;'>Hello {{name}},</h2><p style='color: #334155; font-size: 15px; line-height: 1.7; margin-bottom: 20px;'>[compelling introductory paragraph...]</p><p style='color: #334155; font-size: 15px; line-height: 1.7; margin-bottom: 20px;'>[detailed benefit or context paragraph...]</p><div style='background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 30px;'><h4 style='color: #0f172a; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0; margin-bottom: 12px;'>Why Students Choose StudyStack:</h4><div style='color: #475569; font-size: 14px; line-height: 1.6;'>• **45,000+ Placements** across top UK & Russell Group universities<br>• **Scholarship Assistance** to lower your education costs<br>• **End-to-End Support** including IELTS/PTE training and visa guidance</div></div><div style='text-align: center; margin: 35px 0;'><a href='#' style='background-color: #10b981; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(16,185,129,0.2);'>[compelling CTA button text]</a></div><p style='color: #334155; font-size: 15px; line-height: 1.7; margin-bottom: 0;'>Best regards,<br><strong>Team StudyStack</strong></p></div><div style='background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;'><p style='margin: 0 0 8px 0;'>StudyStack Overseas Education · 120+ Partner Universities</p><p style='margin: 0;'>You received this email because you registered interest in studying abroad. <a href='#' style='color: #10b981; text-decoration: none;'>Unsubscribe</a></p></div></div></div>",
  "text": "Hello {{name}},\n\n[Introductory paragraph...]\n\n[Benefit or context paragraph...]\n\nWhy Students Choose StudyStack:\n- 45,000+ Placements across top UK & Russell Group universities\n- Scholarship Assistance to lower your education costs\n- End-to-End Support including IELTS/PTE training and visa guidance\n\n[CTA button text]: [link]\n\nBest regards,\nTeam StudyStack"
}

EMAIL WRITING RULES:
1. Subject Line (40-60 chars): Focus on the BENEFIT or OPPORTUNITY, not the campaign description
   ✅ "Your UK University Journey Starts Here"
   ❌ "Our Student Recruitment Campaign Information"

2. Opening Hook (1 paragraph): Start with a relatable aspiration or concern
   - Address the student's dream of studying abroad or common worries (cost, eligibility, IELTS)
   - Make it personal and relevant to their academic stage
   - Replace the introductory paragraph bracket placeholder with the actual Hook copy.

3. Solution & Benefits (1-2 paragraphs):
   - Present StudyStack's services as the answer
   - Highlight 2-3 key benefits (45,000+ placements, 120+ partner universities, scholarship guidance, visa support)
   - Focus on what THEY gain: career prospects, global exposure, expert guidance
   - Replace the detailed benefit bracket placeholder with the actual Solution copy.

4. Call-to-Action:
   - Clear, action-oriented button text (e.g., "Book Free Strategy Session", "Check My Scholarship Eligibility").
   - Replace the button text placeholder with this copy.

5. Closing Signature:
   - Keep "Best regards," followed by "Team StudyStack".

6. Tone & Voice:
   - Write as if speaking directly to ONE student (supportive, warm, encouraging mentor).

7. HTML Format Requirements:
   - Use single quotes (') for all HTML attributes.
   - Do not output any markdown formatting inside the JSON strings except newlines in text.
   - You MUST fully substitute the introductory, benefit, and CTA button text placeholders in the JSON templates. The final JSON payload must be completely ready for email sending, containing zero brackets/placeholders except {{name}}.

NOW: Create the student-facing email with NO PLACEHOLDERS except {{name}}. Every sentence must be complete and ready to send.\n`;
      break;
    
    case 'video':
      prompt += `You are a Cinematic Education Ad Director for StudyStack.
Create a polished, context-aware education advertisement concept for video generation.

OUTPUT RULES:
- Return ONLY valid JSON (no markdown, no commentary).
- Generate EXACTLY 3 scenes, each ideally 10 seconds.
- Narrative arc across scenes: Hook -> Trust/Proof -> CTA.
- Keep all scenes visually consistent as one ad campaign.

SAFETY RULES:
- No real celebrity/public figure references.
- No copyrighted characters, logos, trademarked brands, or watermark requests.
- No violent, sexual, hateful, or controversial political content.
- Use professional, family-safe education storytelling.

CREATIVE RULES:
- Person-led scenes are encouraged (student, counsellor, parent) with natural ad-like interactions.
- Spoken dialogue cues are allowed and encouraged for realism.
- On-screen text cues are allowed (short headline + CTA), but no third-party brand names.
- Keep camera language cinematic: movement, composition, lens feel, lighting, mood.
- Ground scenes in campaign context (student segment, destination, intake timing, value proposition).

REQUIRED JSON STRUCTURE:
{
  "projectName": "string",
  "concept": "one-line ad concept",
  "targetAudience": "string",
  "keyMessage": "string",
  "visualPrompts": [
    {
      "sceneName": "short scene title",
      "adBeat": "hook | proof | cta",
      "prompt": "cinematic visual prompt",
      "duration": 10,
      "aspectRatio": "16:9",
      "mood": "string",
      "transition": "how this scene connects to previous",
      "dialogue": "short spoken line",
      "onScreenText": "short headline or CTA"
    }
  ]
}

Prompt style:
- Be concrete, visual, and production-ready.
- Avoid vague filler language.
- Keep prompt length around 45-90 words per scene.
\n`;
      break;
  }

  return prompt;
}

/**
 * Validates that all dependencies for a node are complete
 */
export function canExecuteNode(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { canExecute: boolean; reason?: string } {
  const node = nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { canExecute: false, reason: 'Node not found' };
  }

  if (node.data.status === 'loading') {
    return { canExecute: false, reason: 'Node is already executing' };
  }

  if (node.data.status === 'complete') {
    return { canExecute: true }; // Allow re-execution
  }

  // Find all incoming edges
  const incomingEdges = edges.filter(edge => edge.target === nodeId);

  // Check if all source nodes are complete
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    if (!sourceNode) {
      continue; // Skip if source node not found
    }

    if (sourceNode.data.status !== 'complete') {
      return { 
        canExecute: false, 
        reason: `Waiting for "${sourceNode.data.label}" to complete` 
      };
    }
  }

  return { canExecute: true };
}

/**
 * Gets the execution order for all nodes (topological sort)
 */
export function getExecutionOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      throw new Error('Circular dependency detected in workflow');
    }

    visiting.add(nodeId);

    // Visit all dependencies first
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  // Visit all nodes
  for (const node of nodes) {
    visit(node.id);
  }

  return order;
}
