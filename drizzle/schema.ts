import { text, boolean, timestamp, integer, jsonb, index, unique, pgTable } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';



// ===== ORGANIZACIONES (Empresas/Equipos) =====
export const organizations = pgTable('organizations', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: text('name').notNull(),

    // Slug para subdominio o path
    // Ejemplo: "acme" → acme.tudocs.com o tudocs.com/acme
    slug: text('slug').notNull().unique(),

    // Plan y límites
    plan: text('plan').notNull().default('free'), // free, pro, enterprise
    maxDocuments: integer('max_documents').default(50),
    maxMembers: integer('max_members').default(3),

    // Personalización
    logo: text('logo'),
    primaryColor: text('primary_color').default('#000000'),
    customDomain: text('custom_domain'), // docs.acme.com

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('org_slug_idx').on(table.slug),
]);

// ===== MIEMBROS DE ORGANIZACIÓN =====
export const organizationMembers = pgTable('organization_members', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(), // ID de Supabase Auth
    role: text('role').notNull().default('member'), // owner, admin, editor, viewer
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    // Un usuario solo puede estar una vez por organización
    unique('user_org_unique').on(table.userId, table.organizationId),
    index('org_members_org_idx').on(table.organizationId),
    index('org_members_user_idx').on(table.userId),
]);

// ===== DOCUMENTOS (ahora por organización) =====
export const documents = pgTable('documents', {
    id: text('id').primaryKey().$defaultFn(() => createId()),

    // Ahora pertenece a una organización
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),

    // Slug único dentro de la organización
    slug: text('slug').notNull(),

    content: jsonb('content'),
    parentId: text('parent_id').references(() => documents.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    published: boolean('published').notNull().default(false),

    // Autor y editor
    createdBy: text('created_by').notNull(), // userId de Supabase
    lastEditedBy: text('last_edited_by'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    // Slug único por organización (no globalmente)
    unique('org_slug_unique').on(table.organizationId, table.slug),
    index('docs_org_idx').on(table.organizationId),
    index('docs_slug_idx').on(table.slug),
    index('docs_parent_idx').on(table.parentId),
    index('docs_published_idx').on(table.published),
]);

// ===== INVITACIONES =====
export const invitations = pgTable('invitations', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('invitations_org_idx').on(table.organizationId),
    index('invitations_token_idx').on(table.token),
]);

// ===== RELACIONES =====
export const organizationsRelations = relations(organizations, ({ many }) => ({
    members: many(organizationMembers),
    documents: many(documents),
    invitations: many(invitations),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
    organization: one(organizations, {
        fields: [organizationMembers.organizationId],
        references: [organizations.id],
    }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [documents.organizationId],
        references: [organizations.id],
    }),
    parent: one(documents, {
        fields: [documents.parentId],
        references: [documents.id],
        relationName: 'document_hierarchy',
    }),
    children: many(documents, {
        relationName: 'document_hierarchy',
    }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
    organization: one(organizations, {
        fields: [invitations.organizationId],
        references: [organizations.id],
    }),
}));

// ===== TIPOS =====
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;