CREATE TYPE "public"."anomaly_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."movement_direction" AS ENUM('in', 'out', 'neutral');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" jsonb,
	"search_key" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_daily_summary" (
	"day" date PRIMARY KEY NOT NULL,
	"invoice_count" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"cost_of_goods_sold" numeric(18, 2) DEFAULT '0' NOT NULL,
	"gross_profit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_number" text NOT NULL,
	"customer_id" text,
	"customer_name" text,
	"location_id" text,
	"delivery_date" timestamp with time zone,
	"status" text,
	"payment_status" text,
	"payment_method" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"stock_updated" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_delivery_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"direct_delivery_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"material_id" text,
	"source_material_id" text,
	"material_name" text,
	"model_number" text,
	"location_id" text,
	"unit" text,
	"quantity" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"line_total" numeric(18, 2) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_run_id" uuid,
	"severity" "anomaly_severity" NOT NULL,
	"code" text NOT NULL,
	"source_path" text NOT NULL,
	"source_id" text,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file" text NOT NULL,
	"source_sha256" text NOT NULL,
	"status" "import_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"source_counts" jsonb NOT NULL,
	"imported_counts" jsonb,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "invoice_batch_allocations" (
	"invoice_line_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"quantity" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 2) NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_batch_allocations_invoice_line_id_batch_id_pk" PRIMARY KEY("invoice_line_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"material_id" text,
	"source_material_id" text,
	"item_type" text,
	"description" text,
	"unit" text,
	"location_id" text,
	"quantity" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"discount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 2) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" text,
	"customer_snapshot" jsonb,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"status" text NOT NULL,
	"type" text,
	"location_id" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"project_id" text,
	"project_name" text,
	"service_type" text,
	"terms" text,
	"notes" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_stock_summary" (
	"material_id" text NOT NULL,
	"location_id" text NOT NULL,
	"available_quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"inventory_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_stock_summary_material_id_location_id_pk" PRIMARY KEY("material_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"model_number" text,
	"description" text,
	"default_unit" text,
	"grade_or_quality" text,
	"reorder_point" numeric(18, 4) DEFAULT '0' NOT NULL,
	"storage_requirements" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"search_key" text NOT NULL,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_order_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"material_id" text,
	"source_material_id" text,
	"description" text,
	"unit" text,
	"quantity" numeric(18, 4) NOT NULL,
	"received_quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"original_unit_price" numeric(18, 2),
	"original_currency" text,
	"discount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 2) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"vendor_id" text,
	"vendor_name" text,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"status" text NOT NULL,
	"currency" text,
	"exchange_rate" numeric(18, 6),
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"courier_charges" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_receipt_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_receipt_id" text NOT NULL,
	"purchase_order_line_id" text,
	"line_number" integer NOT NULL,
	"material_id" text,
	"source_material_id" text,
	"location_id" text,
	"description" text,
	"unit" text,
	"received_quantity" numeric(18, 4) NOT NULL,
	"notes" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_number" text NOT NULL,
	"purchase_order_id" text,
	"vendor_id" text,
	"receipt_date" date NOT NULL,
	"status" text NOT NULL,
	"landed_cost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"material_id" text,
	"source_material_id" text NOT NULL,
	"location_id" text,
	"transaction_id" text,
	"adjustment_type" text NOT NULL,
	"quantity" numeric(18, 4) NOT NULL,
	"unit" text,
	"reason" text,
	"status" text,
	"notes" text,
	"created_by" text,
	"approved_by" text,
	"created_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"material_id" text,
	"source_material_id" text NOT NULL,
	"location_id" text,
	"purchase_receipt_line_id" text,
	"quantity_remaining" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 2),
	"unit" text,
	"status" text,
	"received_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"material_id" text,
	"source_material_id" text NOT NULL,
	"batch_id" text,
	"location_id" text,
	"movement_type" text NOT NULL,
	"direction" "movement_direction" NOT NULL,
	"quantity" numeric(18, 4) NOT NULL,
	"unit" text,
	"cost_per_unit" numeric(18, 2),
	"total_cost" numeric(18, 2),
	"related_document_type" text,
	"raw_related_document_id" text,
	"resolved_related_document_id" text,
	"relationship_confidence" text,
	"notes" text,
	"performed_by" text,
	"movement_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location_type" text,
	"capacity_unit" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"source_path" text NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"type" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"embedded_id" text,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"payment_terms" text,
	"tax_id" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"search_key" text NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_metadata" ALTER COLUMN "version" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "system_metadata" ALTER COLUMN "version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "direct_deliveries" ADD CONSTRAINT "direct_deliveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_delivery_lines" ADD CONSTRAINT "direct_delivery_lines_direct_delivery_id_direct_deliveries_id_fk" FOREIGN KEY ("direct_delivery_id") REFERENCES "public"."direct_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_delivery_lines" ADD CONSTRAINT "direct_delivery_lines_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_anomalies" ADD CONSTRAINT "import_anomalies_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_batch_allocations" ADD CONSTRAINT "invoice_batch_allocations_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_batch_allocations" ADD CONSTRAINT "invoice_batch_allocations_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock_summary" ADD CONSTRAINT "material_stock_summary_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_purchase_receipt_id_purchase_receipts_id_fk" FOREIGN KEY ("purchase_receipt_id") REFERENCES "public"."purchase_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_transaction_id_stock_movements_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_purchase_receipt_line_id_purchase_receipt_lines_id_fk" FOREIGN KEY ("purchase_receipt_line_id") REFERENCES "public"."purchase_receipt_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_search_key_idx" ON "customers" USING btree ("search_key");--> statement-breakpoint
CREATE INDEX "dashboard_daily_summary_day_idx" ON "dashboard_daily_summary" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_deliveries_number_uq" ON "direct_deliveries" USING btree ("delivery_number");--> statement-breakpoint
CREATE INDEX "direct_deliveries_date_idx" ON "direct_deliveries" USING btree ("delivery_date");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_delivery_lines_delivery_number_uq" ON "direct_delivery_lines" USING btree ("direct_delivery_id","line_number");--> statement-breakpoint
CREATE INDEX "import_anomalies_run_idx" ON "import_anomalies" USING btree ("import_run_id");--> statement-breakpoint
CREATE INDEX "import_anomalies_code_idx" ON "import_anomalies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invoice_batch_allocations_batch_idx" ON "invoice_batch_allocations" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_invoice_number_uq" ON "invoice_lines" USING btree ("invoice_id","line_number");--> statement-breakpoint
CREATE INDEX "invoice_lines_material_idx" ON "invoice_lines" USING btree ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_date_id_idx" ON "invoices" USING btree ("invoice_date","id");--> statement-breakpoint
CREATE INDEX "invoices_customer_date_idx" ON "invoices" USING btree ("customer_id","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_status_date_idx" ON "invoices" USING btree ("status","invoice_date");--> statement-breakpoint
CREATE INDEX "material_stock_summary_available_idx" ON "material_stock_summary" USING btree ("available_quantity");--> statement-breakpoint
CREATE INDEX "materials_search_key_idx" ON "materials" USING btree ("search_key");--> statement-breakpoint
CREATE INDEX "materials_model_number_idx" ON "materials" USING btree ("model_number");--> statement-breakpoint
CREATE INDEX "materials_active_idx" ON "materials" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_lines_order_number_uq" ON "purchase_order_lines" USING btree ("purchase_order_id","line_number");--> statement-breakpoint
CREATE INDEX "purchase_order_lines_material_idx" ON "purchase_order_lines" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_number_idx" ON "purchase_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "purchase_orders_date_idx" ON "purchase_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "purchase_orders_vendor_date_idx" ON "purchase_orders" USING btree ("vendor_id","order_date");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_receipt_lines_receipt_number_uq" ON "purchase_receipt_lines" USING btree ("purchase_receipt_id","line_number");--> statement-breakpoint
CREATE INDEX "purchase_receipt_lines_material_idx" ON "purchase_receipt_lines" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "purchase_receipts_number_idx" ON "purchase_receipts" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "purchase_receipts_date_idx" ON "purchase_receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "purchase_receipts_order_idx" ON "purchase_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_material_idx" ON "stock_adjustments" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "stock_batches_picker_idx" ON "stock_batches" USING btree ("material_id","location_id","quantity_remaining","received_at");--> statement-breakpoint
CREATE INDEX "stock_batches_source_material_idx" ON "stock_batches" USING btree ("source_material_id");--> statement-breakpoint
CREATE INDEX "stock_movements_material_date_idx" ON "stock_movements" USING btree ("material_id","movement_at","id");--> statement-breakpoint
CREATE INDEX "stock_movements_document_idx" ON "stock_movements" USING btree ("resolved_related_document_id");--> statement-breakpoint
CREATE INDEX "stock_movements_type_date_idx" ON "stock_movements" USING btree ("movement_type","movement_at");--> statement-breakpoint
CREATE INDEX "storage_locations_name_idx" ON "storage_locations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "units_code_idx" ON "units" USING btree ("code");--> statement-breakpoint
CREATE INDEX "units_name_idx" ON "units" USING btree ("name");--> statement-breakpoint
CREATE INDEX "vendors_search_key_idx" ON "vendors" USING btree ("search_key");
