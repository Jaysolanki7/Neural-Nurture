import { NextResponse } from 'next/server';
import { ChatController } from '@/controllers/chatController';

const DOCTOR_ASSIST_PROMPT = `
You are the MediAI Clinical Assistant. Your goal is to help doctors with differential diagnosis, treatment plans, and clinical summaries.

Respond in strictly valid JSON:
{
  "assist_message": "string (Professional message for the doctor)",
  "potential_diagnostics": ["string"],
  "clinical_summary": "string"
}
`;

export async function POST(req) {
  try {
    const { message } = await req.json();

    try {
        const assistJSON = await ChatController.handleDoctorAssist(message, DOCTOR_ASSIST_PROMPT);

        return NextResponse.json({ 
          success: true, 
          reply: assistJSON.assist_message,
          assist: assistJSON
        });
    } catch (apiError) {
        console.error("Doctor AI API Error:", apiError);
        return NextResponse.json({ error: "AI Controller Error" }, { status: 500 });
    }

  } catch (error) {
    console.error("Doctor API Route Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
