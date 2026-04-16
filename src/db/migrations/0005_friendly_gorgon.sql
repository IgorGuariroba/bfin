CREATE TABLE "dividas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conta_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"valor_total" numeric(12, 2) NOT NULL,
	"total_parcelas" integer NOT NULL,
	"valor_parcela" numeric(12, 2) NOT NULL,
	"data_inicio" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcelas_divida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"divida_id" uuid NOT NULL,
	"numero_parcela" integer NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"data_vencimento" date NOT NULL,
	"data_pagamento" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parcelas_divida_divida_numero_unique" UNIQUE("divida_id","numero_parcela")
);
--> statement-breakpoint
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_conta_id_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcelas_divida" ADD CONSTRAINT "parcelas_divida_divida_id_dividas_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."dividas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_parcela_divida_id_parcelas_divida_id_fk" FOREIGN KEY ("parcela_divida_id") REFERENCES "public"."parcelas_divida"("id") ON DELETE set null ON UPDATE no action;