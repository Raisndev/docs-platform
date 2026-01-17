// CRUD de documentos dentro de una organización
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getUserRole, hasPermission } from '@/lib/permissions'
import { slugify } from '@/lib/slugify'

// GET - Listar documentos de la organización
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
        const role = await getUserRole(user.id, orgId)

        if (!role) {
            return NextResponse.json({ error: 'No tienes acceso a esta organización' }, { status: 403 })
        }

        // Obtener solo documentos raíz con sus hijos
        const docs = await db.query.documents.findMany({
            where: and(
                eq(documents.organizationId, orgId),
                isNull(documents.parentId)
            ),
            with: {
                children: {
                    with: {
                        children: true, // Nested hasta 2 niveles
                    },
                },
            },
            orderBy: (documents, { asc }) => [asc(documents.order)],
        })

        return NextResponse.json(docs)
    } catch (error) {
        console.error('Error fetching documents:', error)
        return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 })
    }
}

// POST - Crear nuevo documento
export async function POST(
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

        if (!role || !hasPermission(role, 'edit_docs')) {
            return NextResponse.json({ error: 'No tienes permisos para crear documentos' }, { status: 403 })
        }

        const body = await request.json()
        const { title, slug: customSlug, content, parentId } = body

        if (!title) {
            return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
        }

        // Generar slug
        const slug = customSlug || slugify(title, { lower: true, strict: true })

        // Verificar que el slug no exista en esta org
        const existingDoc = await db.query.documents.findFirst({
            where: and(
                eq(documents.organizationId, orgId),
                eq(documents.slug, slug)
            ),
        })

        if (existingDoc) {
            return NextResponse.json(
                { error: 'Ya existe un documento con este slug en esta organización' },
                { status: 409 }
            )
        }

        // Obtener el siguiente número de orden
        const lastDoc = await db.query.documents.findFirst({
            where: and(
                eq(documents.organizationId, orgId),
                parentId ? eq(documents.parentId, parentId) : isNull(documents.parentId)
            ),
            orderBy: (documents, { desc }) => [desc(documents.order)],
        })

        const order = lastDoc ? lastDoc.order + 1 : 0

        const [newDoc] = await db.insert(documents).values({
            organizationId: orgId,
            title,
            slug,
            content: content || null,
            parentId: parentId || null,
            order,
            createdBy: user.id,
            lastEditedBy: user.id,
        }).returning()

        return NextResponse.json(newDoc, { status: 201 })
    } catch (error) {
        console.error('Error creating document:', error)
        return NextResponse.json({ error: 'Error al crear documento' }, { status: 500 })
    }
}