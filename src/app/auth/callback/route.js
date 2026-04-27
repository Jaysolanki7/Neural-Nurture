import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getURL } from '../../../lib/utils'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch{
              // Ignore in server context
            }
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const baseUrl = getURL()
      return NextResponse.redirect(`${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}${next}`)
    } else {
      console.error("Auth Callback Error:", error.message)
    }
  }

  // return the user to an error page with instructions
  const baseUrl = getURL()
  return NextResponse.redirect(`${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/login?error=auth-callback-failed`)
}
