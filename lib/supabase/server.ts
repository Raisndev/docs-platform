import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
                    } catch {
                        // El método `setAll` fue llamado desde un Server Component.
                        // Esto puede ser ignorado si tienes middleware refrescando
                        // las sesiones de usuario.
                    }
                },
            },
        }
    )
}

// Helper para obtener el usuario actual en Server Components
export async function getCurrentUser() {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return null
    }

    return user
}

// Helper para requerir autenticación en Server Components
export async function requireAuth() {
    const user = await getCurrentUser()

    if (!user) {
        throw new Error('No autenticado')
    }

    return user
}