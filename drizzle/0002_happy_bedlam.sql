ALTER TABLE "debts" ADD COLUMN "category_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_category_id_unique" UNIQUE("category_id");