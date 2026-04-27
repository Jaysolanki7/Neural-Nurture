import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { image } = await req.json();

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const prompt = `
      Analyze this food image and provide a detailed nutritional breakdown in JSON format.
      Include the following keys:
      - food_name: Name of the dish
      - calories: Estimated calories (number)
      - protein: Protein content (e.g., "25g")
      - carbs: Carbohydrates (e.g., "30g")
      - fats: Total fats (e.g., "10g")
      - vitamins: List of key vitamins found
      - benefits: Health benefits of this food
      - risks: Potential side effects or risks (e.g., high sodium, allergies)
      - serving_size: Estimated serving size
      
      Return ONLY the JSON object.
    `;

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro"
    ];

    let analysis = null;
    let lastError = null;
    let successModel = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🚀 [AI Scan] Attempting model: ${modelName}...`);
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: image.split(",")[1],
                    mimeType: "image/jpeg",
                  }
                }
              ]
            }]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`⚠️ [AI Scan] ${modelName} failed:`, errorData.error?.message);
          lastError = new Error(errorData.error?.message);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
            successModel = modelName;
            console.log(`✅ [AI Scan] Success with ${modelName}`);
            break;
          }
        }
      } catch (err) {
        console.error(`❌ [AI Scan] Connection error with ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!analysis) {
      throw lastError || new Error("All authorized vision models are currently unavailable.");
    }

    // LOG USAGE
    if (user) {
      await supabase.from('ai_usage').insert({
        user_id: user.id,
        action_type: 'FOOD_SCAN',
        model_name: successModel
      });
    }

    return NextResponse.json({ success: true, analysis });

  } catch (error) {
    console.error("⛔ [AI Scan] Final Failure:", error);
    return NextResponse.json({
      error: "AI analysis failed. Please ensure the photo is clear and try again.",
      details: error.message
    }, { status: 500 });
  }
}
