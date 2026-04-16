// Base schema file — prepared for future entities
import { pgTable, uuid, timestamp, varchar, boolean, numeric, pgEnum, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
