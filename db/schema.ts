import { AnyPgColumn, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const records = pgTable("records", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  kind: text("kind").notNull(),
  data: text("data").notNull(),
  slot: text("slot"),
  version: integer("version").notNull().default(1),
  parentId: text("parent_id").references((): AnyPgColumn => records.id),
  tenantId: text("tenant_id").references((): AnyPgColumn => records.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("records_owner_kind").on(table.owner, table.kind),
  uniqueIndex("records_unique_slot").on(table.owner, table.kind, table.slot),
]);

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("workspace_owner").on(table.ownerId)]);

export const memberships = pgTable("memberships", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  userId: text("user_id"),
  phone: text("phone").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  buildingIds: text("building_ids").notNull().default("[]"),
  tenantId: text("tenant_id").references(() => records.id),
  tokenHash: text("token_hash"),
  expiresAt: text("expires_at"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("membership_workspace_phone").on(table.workspaceId, table.phone),
  uniqueIndex("membership_workspace_user").on(table.workspaceId, table.userId),
  index("membership_user").on(table.userId),
  uniqueIndex("membership_token").on(table.tokenHash),
]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  recoveryHash: text("recovery_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("accounts_phone").on(table.phone)]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => accounts.id),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("sessions_user").on(table.userId)]);

export const authLimits = pgTable("auth_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const contractImages = pgTable("contract_images", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  contractId: text("contract_id").notNull().references(() => records.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("contract_images_owner_contract").on(table.owner, table.contractId)]);

export const tenantImages = pgTable("tenant_images", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  tenantId: text("tenant_id").notNull().references(() => records.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("tenant_images_owner_tenant").on(table.owner, table.tenantId)]);
