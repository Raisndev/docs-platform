// Actualizar y eliminar documento específico
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { getUserRole, hasPermission } from '@/lib/permissions'
import { slugify } from '@/lib/slugify'

// GET - Obtener documento específico
export async function GET(
    request: NextRequest,
    { params }: { params: { docId: string } }
) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const docId = params.docId

        const doc = await db.query.documents.findFirst({
            where: eq(documents.id, docId),
            with: {
                children: true,
            },
        })

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
        }

        // Verificar acceso a la organización
        const role = await getUserRole(user.id, doc.organizationId)

        if (!role) {
            return NextResponse.json({ error: 'No tienes acceso a este documento' }, { status: 403 })
        }

        return NextResponse.json(doc)
    } catch (error) {
        console.error('Error fetching document:', error)
        return NextResponse.json({ error: 'Error al obtener documento' }, { status: 500 })
    }
}

// PATCH - Actualizar documento
export async function PATCH(
    request: NextRequest,
    { params }: { params: { docId: string } }
) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const docId = params.docId

        const doc = await db.query.documents.findFirst({
            where: eq(documents.id, docId),
        })

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
        }

        const role = await getUserRole(user.id, doc.organizationId)

        if (!role || !hasPermission(role, 'edit_docs')) {
            return NextResponse.json({ error: 'No tienes permisos para editar este documento' }, { status: 403 })
        }

        const body = await request.json()
        const { title, slug: customSlug, content, published, order } = body

        // Si se actualiza el slug, verificar que no exista
        if (customSlug && customSlug !== doc.slug) {
            const existingDoc = await db.query.documents.findFirst({
                where: and(
                    eq(documents.organizationId, doc.organizationId),
                    eq(documents.slug, customSlug)
                ),
            })

            if (existingDoc) {
                return NextResponse.json(
                    { error: 'Ya existe un documento con este slug' },
                    { status: 409 }
                )
            }
        }

        const [updatedDoc] = await db.update(documents)
            .set({
                ...(title && { title }),
                ...(customSlug && { slug: customSlug }),
                ...(content !== undefined && { content }),
                ...(published !== undefined && { published }),
                ...(order !== undefined && { order }),
                lastEditedBy: user.id,
                updatedAt: new Date(),
            })
            .where(eq(documents.id, docId))
            .returning()

        return NextResponse.json(updatedDoc)
    } catch (error) {
        console.error('Error updating document:', error)
        return NextResponse.json({ error: 'Error al actualizar documento' }, { status: 500 })
    }
}

// DELETE - Eliminar documento
export async function DELETE(
    request: NextRequest,
    { params }: { params: { docId: string } }
) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const docId = params.docId

        const doc = await db.query.documents.findFirst({
            where: eq(documents.id, docId),
        })

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
        }

        const role = await getUserRole(user.id, doc.organizationId)

        if (!role || !hasPermission(role, 'edit_docs')) {
            return NextResponse.json({ error: 'No tienes permisos para eliminar este documento' }, { status: 403 })
        }

        // Cascade eliminará automáticamente los hijos
        await db.delete(documents).where(eq(documents.id, docId))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting document:', error)
        return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 })
    }
}