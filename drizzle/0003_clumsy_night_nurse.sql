CREATE TABLE "month_category_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"allocated_balance" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_category_snapshots_month_category_unique" UNIQUE("month_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "month_category_snapshots" ADD CONSTRAINT "month_category_snapshots_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_category_snapshots" ADD CONSTRAINT "month_category_snapshots_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;