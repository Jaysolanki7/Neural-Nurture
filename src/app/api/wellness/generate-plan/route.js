import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { get(name) { return cookieStore.get(name)?.value } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: records } = await supabase
      .from('medical_records')
      .select('title, category')
      .eq('user_id', user.id);

    const context = records?.map(r => r.title).join(", ") || "No specific conditions";

    const prompt = `
      Create a 7-day personalized healthy meal plan for a patient.
      Medical Context: ${context}
      
      Generate a list of meals (Breakfast, Lunch, Dinner) for the next 7 days.
      For each meal, provide:
      - day_of_week, meal_type, title, description, calories (number), prep_time (minutes), image_url, macros
      
      Return ONLY a JSON array of objects.
    `;

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-pro"
    ];

    let meals = null;
    let lastError = null;
    let successModel = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🚀 [Meal Gen] Attempting model: ${modelName}...`);
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.warn(`⚠️ [Meal Gen] ${modelName} failed:`, errorData.error?.message);
          lastError = new Error(errorData.error?.message);
          continue;
        }

        const data = await res.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (responseText) {
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            meals = JSON.parse(jsonMatch[0]);
            successModel = modelName;
            console.log(`✅ [Meal Gen] Success with ${modelName}`);
            break;
          }
        }
      } catch (err) {
        console.error(`❌ [Meal Gen] Connection error with ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!meals) {
      throw lastError || new Error("All authorized meal planning models are currently unavailable.");
    }

    // LOG USAGE
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      action_type: 'MEAL_PLAN',
      model_name: successModel
    });

    // 3. Clear old plans and save new ones
    await supabase.from('meal_plans').delete().eq('user_id', user.id);

    const foodImages = [
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
      "https://images.unsplash.com/photo-1473093226795-af9932fe5856",
      "https://images.unsplash.com/photo-1493770348161-369560ae357d",
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061"
    ];

    const mealsToInsert = meals.map((meal, idx) => {
      const baseImg = foodImages[idx % foodImages.length];
      const finalImageUrl = meal.image_url?.startsWith('http')
        ? meal.image_url
        : `${baseImg}?auto=format&fit=crop&w=800&q=80&sig=${idx}`;

      return {
        ...meal,
        user_id: user.id,
        image_url: finalImageUrl
      };
    });


    const { error: dbError } = await supabase.from('meal_plans').insert(mealsToInsert);
    if (dbError) throw dbError;

    return NextResponse.json({ success: true, meals });

  } catch (error) {
    console.error("Meal Generation Error:", error);
    return NextResponse.json({ error: "Failed to generate meal plan", details: error.message }, { status: 500 });
  }
}
