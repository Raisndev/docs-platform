import { db } from '@/lib/db'
import { organizationMembers } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

export const ROLE_PERMISSIONS = {
    owner: ['delete_org', 'manage_billing', 'manage_members', 'manage_settings', 'edit_docs', 'view_docs'],
    admin: ['manage_members', 'manage_settings', 'edit_docs', 'view_docs'],
    editor: ['edit_docs', 'view_docs'],
    viewer: ['view_docs'],
} as const

export async function getUserOrganizations(userId: string) {
    const memberships = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, userId),
        with: {
            organization: true,
        },
    })

    return memberships.map(m => ({
        ...m.organization,
        role: m.role as Role,
    }))
}

export async function getUserRole(userId: string, orgId: string): Promise<Role | null> {
    const membership = await db.query.organizationMembers.findFirst({
        where: and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, orgId)
        ),
    })

    return membership ? (membership.role as Role) : null
}

export function hasPermission(role: Role, permission: string): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission as any) ?? false
}

export async function canUserAccessOrg(userId: string, orgId: string): Promise<boolean> {
    const role = await getUserRole(userId, orgId)
    return role !== null
}

export async function canUserEditDocs(userId: string, orgId: string): Promise<boolean> {
    const role = await getUserRole(userId, orgId)
    return role ? hasPermission(role, 'edit_docs') : false
}