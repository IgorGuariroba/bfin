// Base schema file — prepared for future entities
import { pgTable, uuid, timestamp, varchar, boolean, numeric, pgEnum, unique, integer, date, jsonb } from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow(),
});

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  idProvedor: varchar("id_provedor", { length: 255 }).notNull().unique(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tipoCategorias = pgTable("tipo_categorias", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  nome: varchar("nome", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categorias = pgTable("categorias", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  tipoCategoriaId: uuid("tipo_categoria_id").notNull().references(() => tipoCategorias.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("categorias_nome_tipo_unique").on(table.nome, table.tipoCategoriaId),
]);

export const contas = pgTable("contas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  saldoInicial: numeric("saldo_inicial", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const papelContaEnum = pgEnum("papel_conta", ["owner", "viewer"]);

export const contaUsuarios = pgTable("conta_usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  contaId: uuid("conta_id").notNull().references(() => contas.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  papel: papelContaEnum("papel").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("conta_usuarios_conta_usuario_unique").on(table.contaId, table.usuarioId),
]);

export const dividas = pgTable("dividas", {
  id: uuid("id").primaryKey().defaultRandom(),
  contaId: uuid("conta_id").notNull().references(() => contas.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  categoriaId: uuid("categoria_id").notNull().references(() => categorias.id),
  descricao: varchar("descricao", { length: 255 }).notNull(),
  valorTotal: numeric("valor_total", { precision: 12, scale: 2 }).notNull(),
  totalParcelas: integer("total_parcelas").notNull(),
  valorParcela: numeric("valor_parcela", { precision: 12, scale: 2 }).notNull(),
  dataInicio: date("data_inicio", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const parcelasDivida = pgTable("parcelas_divida", {
  id: uuid("id").primaryKey().defaultRandom(),
  dividaId: uuid("divida_id").notNull().references(() => dividas.id, { onDelete: "cascade" }),
  numeroParcela: integer("numero_parcela").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  dataVencimento: date("data_vencimento", { mode: "date" }).notNull(),
  dataPagamento: date("data_pagamento", { mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("parcelas_divida_divida_numero_unique").on(table.dividaId, table.numeroParcela),
]);

export const movimentacoes = pgTable("movimentacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  contaId: uuid("conta_id").notNull().references(() => contas.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  categoriaId: uuid("categoria_id").notNull().references(() => categorias.id),
  descricao: varchar("descricao", { length: 255 }),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  data: timestamp("data", { withTimezone: true, mode: "date" }).notNull(),
  recorrente: boolean("recorrente").notNull().default(false),
  dataFim: timestamp("data_fim", { withTimezone: true, mode: "date" }),
  parcelaDividaId: uuid("parcela_divida_id").references(() => parcelasDivida.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projecaoStatusEnum = pgEnum("projecao_status", ["atualizada", "invalidada"]);

export const projecao = pgTable("projecao", {
  id: uuid("id").primaryKey().defaultRandom(),
  contaId: uuid("conta_id").notNull().references(() => contas.id, { onDelete: "cascade" }),
  mes: varchar("mes", { length: 7 }).notNull(),
  dados: jsonb("dados").notNull(),
  status: projecaoStatusEnum("status").notNull().default("atualizada"),
  recalculadoEm: timestamp("recalculado_em", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("projecao_conta_mes_unique").on(table.contaId, table.mes),
]);

export const meta = pgTable("meta", {
  id: uuid("id").primaryKey().defaultRandom(),
  contaId: uuid("conta_id").notNull().unique().references(() => contas.id, { onDelete: "cascade" }),
  porcentagemReserva: numeric("porcentagem_reserva", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
