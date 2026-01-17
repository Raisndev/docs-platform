import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { organizations, organizationMembers } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { slugify } from '@/lib/slugify'

// GET - Listar organizaciones del usuario
export async function GET() {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const userOrgs = await db.query.organizationMembers.findMany({
            where: eq(organizationMembers.userId, user.id),
            with: {
                organization: true,
            },
        })

        const orgsWithRoles = userOrgs.map(membership => ({
            ...membership.organization,
            role: membership.role,
        }))

        return NextResponse.json(orgsWithRoles)
    } catch (error) {
        console.error('Error fetching organizations:', error)
        return NextResponse.json({ error: 'Error al obtener organizaciones' }, { status: 500 })
    }
}

// POST - Crear nueva organización
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { name, slug: customSlug } = body

        if (!name) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
        }

        // Generar slug
        const slug = customSlug || slugify(name, { lower: true, strict: true })

        // Verificar que el slug no exista
        const existingOrg = await db.query.organizations.findFirst({
            where: eq(organizations.slug, slug),
        })

        if (existingOrg) {
            return NextResponse.json(
                { error: 'Este slug ya está en uso' },
                { status: 409 }
            )
        }

        // Crear organización
        const [newOrg] = await db.insert(organizations).values({
            name,
            slug,
        }).returning()

        // Añadir usuario como owner
        await db.insert(organizationMembers).values({
            organizationId: newOrg.id,
            userId: user.id,
            role: 'owner',
        })

        return NextResponse.json(newOrg, { status: 201 })
    } catch (error) {
        console.error('Error creating organization:', error)
        return NextResponse.json({ error: 'Error al crear organización' }, { status: 500 })
    }
}