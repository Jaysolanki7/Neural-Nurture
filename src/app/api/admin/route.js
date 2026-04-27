import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const data = await req.json();
    const { name, specialty, location, latitude, longitude, fee, rating, availability } = data;
    
    if (!name || !specialty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Try to insert with ALL fields first
      const { error: fullError } = await supabase
        .from('doctors')
        .insert([{ 
          name, 
          specialty, 
          location, 
          latitude, 
          longitude, 
          price: fee,
          rating,
          availability 
        }]);
        
      if (!fullError) {
        return NextResponse.json({ success: true, message: "Successfully saved doctor with all fields." });
      }

      // If it failed (likely missing columns), try the MINIMAL insert (original columns)
      console.warn("Full insert failed, attempting minimal insert. Error:", fullError.message);
      const { error: minError } = await supabase
        .from('doctors')
        .insert([{ 
          name, 
          specialty, 
          location, 
          latitude, 
          longitude, 
          price: fee
        }]);

      if (!minError) {
        return NextResponse.json({ 
          success: true, 
          warning: "Doctor saved, but 'rating' and 'availability' were skipped. Please add these columns to your Supabase 'doctors' table (rating: text, availability: text) to enable full features.",
          message: "Saved minimal profile." 
        });
      }

      return NextResponse.json({ error: minError.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Supabase keys missing" }, { status: 500 });

  } catch (error) {
    console.error("Admin API Error:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}
