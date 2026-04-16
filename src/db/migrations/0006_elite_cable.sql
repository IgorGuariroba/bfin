CREATE TYPE "public"."projecao_status" AS ENUM('atualizada', 'invalidada');--> statement-breakpoint
CREATE TABLE "meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conta_id" uuid NOT NULL,
	"porcentagem_reserva" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_conta_id_unique" UNIQUE("conta_id")
);
--> statement-breakpoint
CREATE TABLE "projecao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conta_id" uuid NOT NULL,
	"mes" varchar(7) NOT NULL,
	"dados" jsonb NOT NULL,
	"status" "projecao_status" DEFAULT 'atualizada' NOT NULL,
	"recalculado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projecao_conta_mes_unique" UNIQUE("conta_id","mes")
);
--> statement-breakpoint
ALTER TABLE "meta" ADD CONSTRAINT "meta_conta_id_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projecao" ADD CONSTRAINT "projecao_conta_id_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;