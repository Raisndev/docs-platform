// Helper para obtener organización actual del contexto
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { organizations } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function getOrgFromSlug(orgSlug: string) {
    return await db.query.organizations.findFirst({
        where: eq(organizations.slug, orgSlug),
    })
}

export async function getCurrentUser() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}
