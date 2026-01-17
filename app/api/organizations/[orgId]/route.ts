// Actualizar y eliminar organización específica
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { organizations, organizationMembers, documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { getUserRole, hasPermission } from '@/lib/permissions'

// GET - Obtener detalles de una organización
export async function GET(
    request: NextRequest,
    { params }: { params: { orgId: string } }
) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const orgId = params.orgId

        // Verificar que el usuario pertenece a la org
        const membership = await db.query.organizationMembers.findFirst({
            where: and(
                eq(organizationMembers.organizationId, orgId),
                eq(organizationMembers.userId, user.id)
            ),
        })

        if (!membership) {
            return NextResponse.json({ error: 'No tienes acceso a esta organización' }, { status: 403 })
        }

        const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, orgId),
        })

        if (!org) {
            return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ ...org, role: membership.role })
    } catch (error) {
        console.error('Error fetching organization:', error)
        return NextResponse.json({ error: 'Error al obtener organización' }, { status: 500 })
    }
}

// PATCH - Actualizar organización
export async function PATCH(
    request: NextRequest,
    { params }: { params: { orgId: string } }
) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const orgId = params.orgId
        const role = await getUserRole(user.id, orgId)

        if (!role || !hasPermission(role, 'manage_settings')) {
            return NextResponse.json({ error: 'No tienes permisos para editar esta organización' }, { status: 403 })
        }

        const body = await request.json()
        const { name, logo, primaryColor, customDomain } = body

        const [updatedOrg] = await db.update(organizations)
            .set({
                ...(name && { name }),
                ...(logo !== undefined && { logo }),
                ...(primaryColor && { primaryColor }),
                ...(customDomain !== undefined && { customDomain }),
                updatedAt: new Date(),
            })
            .where(eq(organizations.id, orgId))
            .returning()

        return NextResponse.json(updatedOrg)
    } catch (error) {
        console.error('Error updating organization:', error)
        return NextResponse.json({ error: 'Error al actualizar organización' }, { status: 500 })
    }
}

// DELETE - Eliminar organización
export async function DELETE(
    request: NextRequest,
    { params }: { params: { orgId: string } }
) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const orgId = params.orgId
        const role = await getUserRole(user.id, orgId)

        if (!role || !hasPermission(role, 'delete_org')) {
            return NextResponse.json({ error: 'Solo el owner puede eliminar la organización' }, { status: 403 })
        }

        // Cascade eliminará automáticamente miembros, documentos, etc
        await db.delete(organizations).where(eq(organizations.id, orgId))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting organization:', error)
        return NextResponse.json({ error: 'Error al eliminar organización' }, { status: 500 })
    }
}