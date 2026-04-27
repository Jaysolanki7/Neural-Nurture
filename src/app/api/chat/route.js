import { NextResponse } from 'next/server';
import { ChatController } from '@/controllers/chatController';

const TRIAGE_SYSTEM_PROMPT = `
You are the MediAI Clinical Triage Assistant. 
Analyze the user's symptoms and provide a professional clinical assessment.
Return a strictly valid JSON object with the following structure:

{
  "assessment": "A professional, concise summary of the findings to be shown in the chat bubble.",
  "urgency": "LOW | GREEN | YELLOW | RED | CRITICAL (Use GREEN for minor, YELLOW for moderate, RED for urgent)",
  "likely_cause": "The most probable medical condition or diagnostic hypothesis.",
  "specialist_needed": "The recommended medical specialist (e.g., General Practitioner, Cardiologist, Neurologist).",
  "home_care": ["Step-by-step patient care instructions or immediate actions to take."]
}

Keep the 'assessment' reassuring but clinical.
`;

export async function POST(req) {
  try {
    const { message, fileData } = await req.json();

    if (!message && !fileData) {
      return NextResponse.json({ error: "Missing message or file data" }, { status: 400 });
    }

    const ANALYSIS_PROMPT = fileData 
      ? `${TRIAGE_SYSTEM_PROMPT}\n\nIMPORTANT: A document (PDF/Image) has been attached. Analyze the document's clinical content and incorporate findings into your assessment.` 
      : TRIAGE_SYSTEM_PROMPT;

    try {
      const triageResult = await ChatController.executeAIRequest(message || "Analyze attached report", ANALYSIS_PROMPT, fileData);

      return NextResponse.json({ 
        success: true, 
        reply: triageResult.assessment,
        triage: triageResult 
      });


    } catch (aiError) {
      console.error("[Chat API] AI Error:", aiError.message);
      
      if (aiError.message === 'QUOTA_EXCEEDED' || aiError.message.includes('429')) {
        return NextResponse.json({ 
          error: "QUOTA_EXHAUSTED",
          message: "Your Gemini API quota is exhausted (Limit: 0). This usually means the API key is from a project without free-tier access. Please create a COMPLETELY NEW project in Google AI Studio and generate a fresh key."
        }, { status: 429 });
      }

      return NextResponse.json({ 
        error: aiError.message || "The AI diagnostic engine is currently unavailable." 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("[Chat API] Server Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
