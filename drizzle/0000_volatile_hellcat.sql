CREATE TABLE "bikes" (
	"id" serial PRIMARY KEY NOT NULL,
	"reg_no" text NOT NULL,
	"province" text NOT NULL,
	"district" text NOT NULL,
	"model" text NOT NULL,
	"officer" text NOT NULL,
	"date_added" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bikes_reg_no_unique" UNIQUE("reg_no")
);
--> statement-breakpoint
CREATE TABLE "service_log_spares" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_log_id" integer NOT NULL,
	"spare_id" integer,
	"spare_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"price_at_time" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"bike_id" integer NOT NULL,
	"date" text NOT NULL,
	"next_service_date" text,
	"next_service_mileage" integer,
	"mileage" integer NOT NULL,
	"officer" text NOT NULL,
	"province" text NOT NULL,
	"district" text NOT NULL,
	"work_done" text,
	"work_pending" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"bike_id" integer NOT NULL,
	"bike_reg" text NOT NULL,
	"officer_uid" text,
	"requested_by" text NOT NULL,
	"service_type" text NOT NULL,
	"problem_description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"date_requested" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spares_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"date_added" text NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "spares_inventory_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"phone_number" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "service_log_spares" ADD CONSTRAINT "service_log_spares_service_log_id_service_logs_id_fk" FOREIGN KEY ("service_log_id") REFERENCES "public"."service_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_log_spares" ADD CONSTRAINT "service_log_spares_spare_id_spares_inventory_id_fk" FOREIGN KEY ("spare_id") REFERENCES "public"."spares_inventory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_logs" ADD CONSTRAINT "service_logs_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_officer_uid_users_uid_fk" FOREIGN KEY ("officer_uid") REFERENCES "public"."users"("uid") ON DELETE set null ON UPDATE no action;