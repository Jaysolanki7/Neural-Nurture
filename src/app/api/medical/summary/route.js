import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Fetch all medical records
    const { data: records, error: recError } = await supabase
      .from('medical_records')
      .select('*')
      .eq('user_id', user.id)
      .order('record_date', { ascending: true });

    console.log(`📊 [Summary] Found ${records?.length || 0} medical records`);

    // 2. Fetch recent wellness logs
    const { data: logs, error: logError } = await supabase
      .from('wellness_logs')
      .select('*')
      .eq('user_id', user.id)
      .limit(30);

    console.log(`📊 [Summary] Found ${logs?.length || 0} wellness logs`);

    if (!records?.length && !logs?.length) {
       return NextResponse.json({ 
         success: true, 
         summary: "No clinical data found yet. Please upload a medical record or log your daily wellness to generate a summary." 
       });
    }

    // 3. Prepare data
    const clinicalHistory = records?.map(r => 
      `${r.record_date}: ${r.title} at ${r.facility} (${r.category})`
    ).join('\n') || "No medical records";

    const habitHistory = logs?.map(l => 
      `${l.log_date}: Water ${l.water_intake}L, Mindfulness ${l.mindfulness_minutes}min, Score ${l.daily_score}%`
    ).join('\n') || "No wellness logs";

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, age, gender')
      .eq('id', user.id)
      .single();

    const patientInfoStr = `Name: ${profile?.full_name || 'N/A'}, Age: ${profile?.age || 'N/A'}, Gender: ${profile?.gender || 'N/A'}`;

    const prompt = `
      You are a Senior Clinical Diagnostic Lead. Analyze the following patient health record and wellness history to construct a longitudinal medical synthesis.
      
      PATIENT IDENTIFICATION:
      ${patientInfoStr}

      HISTORICAL DIAGNOSTIC RECORDS:
      ${clinicalHistory}
      
      DAILY WELLNESS TRENDS (LAST 30 DAYS):
      ${habitHistory}
      
      YOUR TASK:
      1. Construct a chronological timeline of the patient's health progression based on the Diagnostic records.
      2. Explain "What happened" (pathology/events) and "What was the treatment" (elaj/protocol) at each stage.
      3. Identify longitudinal trends or recurring clinical patterns.
      4. Suggest next-phase clinical directives based on the historical trajectory.

      Return ONLY a JSON object with this exact structure:
      {
        "patientInfo": { "name": "${profile?.full_name || 'N/A'}", "age": "${profile?.age || 'N/A'}", "gender": "${profile?.gender || 'N/A'}" },
        "overview": { 
          "status": "Stable/Critical/Action Needed", 
          "analysis": "A detailed longitudinal timeline summary. Start with the earliest record and explain the journey to the present. Focus on what happened and the treatments (elaj) provided.",
          "clinicalTraj": "Summary of where the patient is heading health-wise."
        },
        "trends": [ { "topic": "Metabolic/Respiratory/etc", "observation": "...", "status": "Positive/Warning" } ],
        "progress": { "highlights": ["Historical win 1", "Win 2"], "concerns": ["Unresolved issue 1"] },
        "recommendations": [ { "action": "Immediate next step", "priority": "High/Med/Low", "reason": "Based on historical data..." } ]
      }
    `;

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-pro"
    ];

    let summary = null;
    let lastError = null;
    let successModel = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🚀 [Summary Gen] Attempting model: ${modelName}...`);
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`⚠️ [Summary Gen] ${modelName} failed:`, errorData.error?.message);
          lastError = new Error(errorData.error?.message);
          continue; 
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            summary = JSON.parse(jsonMatch[0]);
            successModel = modelName;
            console.log(`✅ [Summary Gen] Success with ${modelName}`);
            break;
          }
        }
      } catch (err) {
        console.error(`❌ [Summary Gen] Connection error with ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!summary) {
      throw lastError || new Error("All authorized models are currently unavailable.");
    }

    // LOG USAGE
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      action_type: 'SUMMARY',
      model_name: successModel
    });

    return NextResponse.json({ success: true, summary });

  } catch (error) {
    console.error("Summary Generation Error:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
