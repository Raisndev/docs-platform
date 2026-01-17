import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const redirect = searchParams.get('redirect') ?? '/onboarding'
    const error = searchParams.get('error')
    const errorCode = searchParams.get('error_code')
    const errorDescription = searchParams.get('error_description')
    
    console.log('request', request)
    console.log('code', code)
    console.log('redirect', redirect)
    console.log('origin', origin)
    console.log('error', error)
    console.log('error_code', errorCode)
    console.log('error_description', errorDescription)

    if (code) {
        const supabase = await createServerSupabaseClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        console.log('error', error)
        if (!error) {
            return NextResponse.redirect(`${origin}${redirect}`)
        }
    }

    return NextResponse.redirect(`${origin}/login`)
}
