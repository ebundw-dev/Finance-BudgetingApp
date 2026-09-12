CREATE TABLE "dismissed_subscription_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"payee_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dismissed_subscription_candidates_signature_unique" UNIQUE("user_id","account_id","category_id","payee_key")
);
--> statement-breakpoint
ALTER TABLE "dismissed_subscription_candidates" ADD CONSTRAINT "dismissed_subscription_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_subscription_candidates" ADD CONSTRAINT "dismissed_subscription_candidates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_subscription_candidates" ADD CONSTRAINT "dismissed_subscription_candidates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;