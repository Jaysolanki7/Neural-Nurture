import { NextResponse } from "next/server";

export async function GET() {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    const response = await fetch(API_URL);
    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      models: data.models?.map(m => m.name) || [],
      raw: data 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
