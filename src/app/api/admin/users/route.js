import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ 
        error: "SERVICE_ROLE_KEY_MISSING",
        message: "To view user emails, you must add SUPABASE_SERVICE_ROLE_KEY to your .env.local file. Supabase hides user emails from public access for security." 
      }, { status: 403 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = data.users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.first_name || u.user_metadata?.full_name || 'N/A',
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      is_banned: !!u.banned_until
    }));

    return NextResponse.json({ users, total: users.length });

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SERVICE_ROLE_KEY_MISSING" }, { status: 403 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    let result;
    if (action === 'delete') {
      result = await supabaseAdmin.auth.admin.deleteUser(userId);
    } else if (action === 'ban') {
      result = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '87600h' }); // Ban for 10 years
    } else if (action === 'unban') {
      result = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
