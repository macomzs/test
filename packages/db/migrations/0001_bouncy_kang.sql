CREATE TYPE "public"."product_kind" AS ENUM('SIMPLE', 'PARENT', 'VARIANT');--> statement-breakpoint
CREATE TYPE "public"."product_source" AS ENUM('MANUAL', 'FEED');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'XML_FEED' NOT NULL,
	"url" text NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_run_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"alt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "product_kind" DEFAULT 'SIMPLE' NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"variant_label" text,
	"sku" text,
	"ean" text,
	"brand" text,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"base_price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"currency" text DEFAULT 'PLN' NOT NULL,
	"length_mm" integer,
	"width_mm" integer,
	"height_mm" integer,
	"weight_g" integer,
	"materials" text,
	"stock_qty" integer,
	"stock_updated_at" timestamp with time zone,
	"source" "product_source" DEFAULT 'MANUAL' NOT NULL,
	"source_data" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_source_id_import_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."import_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sources" ADD CONSTRAINT "import_sources_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_runs_started_idx" ON "import_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_uq" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_ean_uq" ON "products" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "products_parent_idx" ON "products" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");