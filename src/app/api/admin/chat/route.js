import { NextResponse } from 'next/server';
import { ChatController } from '@/controllers/chatController';

const ADMIN_ASSIST_PROMPT = `
You are the MediAI Management Assistant. Help administrators manage clinical data and insights.
Respond in strictly valid JSON:
{
  "assist_message": "string (Professional management guidance)",
  "management_insights": ["string"],
  "audit_summary": "string"
}
`;

export async function POST(req) {
  try {
    const { message } = await req.json();

    try {
      const assistData = await ChatController.executeAIRequest(message, ADMIN_ASSIST_PROMPT);

      return NextResponse.json({ 
        success: true, 
        reply: assistData.assist_message,
        assist: assistData
      });

    } catch (aiError) {
      if (aiError.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json({ error: "AI Quota Exhausted" }, { status: 429 });
      }
      return NextResponse.json({ error: aiError.message }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
