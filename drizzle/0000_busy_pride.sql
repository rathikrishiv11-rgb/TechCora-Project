CREATE TABLE "system_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "system_metadata_key_uq" ON "system_metadata" USING btree ("key");--> statement-breakpoint
CREATE INDEX "system_metadata_updated_at_idx" ON "system_metadata" USING btree ("updated_at");