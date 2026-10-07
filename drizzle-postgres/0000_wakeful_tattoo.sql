CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"recovery_hash" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_images" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"contract_id" text NOT NULL,
	"object_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"building_ids" text DEFAULT '[]' NOT NULL,
	"tenant_id" text,
	"token_hash" text,
	"expires_at" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"kind" text NOT NULL,
	"data" text NOT NULL,
	"slot" text,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_id" text,
	"tenant_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_images" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"tenant_id" text NOT NULL,
	"object_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_images" ADD CONSTRAINT "contract_images_contract_id_records_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_records_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_parent_id_records_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_tenant_id_records_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_images" ADD CONSTRAINT "tenant_images_tenant_id_records_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_phone" ON "accounts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "contract_images_owner_contract" ON "contract_images" USING btree ("owner","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_workspace_phone" ON "memberships" USING btree ("workspace_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_workspace_user" ON "memberships" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "membership_user" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_token" ON "memberships" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "records_owner_kind" ON "records" USING btree ("owner","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "records_unique_slot" ON "records" USING btree ("owner","kind","slot");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_images_owner_tenant" ON "tenant_images" USING btree ("owner","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_owner" ON "workspaces" USING btree ("owner_id");