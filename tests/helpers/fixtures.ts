import type { FastifyInstance } from "fastify";
import { createTestApp, type TestApp } from "./setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
  type TestKeyPair,
} from "./auth.js";

export interface AuthedTestApp {
  testApp: TestApp;
  keyPair: TestKeyPair;
  signToken(
    idProvedor: string,
    email: string,
    name?: string
  ): Promise<string>;
}

export async function setupAuthedApp(
  registerRoutes?: (app: FastifyInstance) => void
): Promise<AuthedTestApp> {
  const keyPair = await generateTestKeyPair();
  const validateToken = await createTestJwksProvider(keyPair);
  const testApp = await createTestApp({ validateToken }, registerRoutes);
  await testApp.truncateAll();
  return {
    testApp,
    keyPair,
    signToken: (idProvedor, email, name) =>
      signTestToken(keyPair, { sub: idProvedor, email, name: name ?? idProvedor }),
  };
}

export async function seedTipoCategorias(app: TestApp): Promise<void> {
  await app.client`
    INSERT INTO tipo_categorias (slug, nome)
    VALUES ('receita', 'Receita'), ('despesa', 'Despesa'), ('divida', 'Dívida')
    ON CONFLICT (slug) DO NOTHING
  `;
}

export async function createUser(
  app: TestApp,
  idProvedor: string,
  email: string,
  isAdmin = false
): Promise<string> {
  const [user] = await app.client`
    INSERT INTO usuarios (id_provedor, nome, email, is_admin)
    VALUES (${idProvedor}, ${email.split("@")[0]}, ${email}, ${isAdmin})
    RETURNING id
  `;
  return user.id as string;
}

export async function createConta(app: TestApp, nome: string): Promise<string> {
  const [conta] = await app.client`
    INSERT INTO contas (nome, saldo_inicial) VALUES (${nome}, 0) RETURNING id
  `;
  return conta.id as string;
}

export async function associateUser(
  app: TestApp,
  contaId: string,
  usuarioId: string,
  papel: string
): Promise<void> {
  await app.client`
    INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
    VALUES (${contaId}, ${usuarioId}, ${papel})
  `;
}

export async function createAccountForUser(
  app: TestApp,
  usuarioId: string,
  nome: string
): Promise<string> {
  const contaId = await createConta(app, nome);
  await associateUser(app, contaId, usuarioId, "owner");
  return contaId;
}

export async function createCategoriaBySlug(
  app: TestApp,
  nome: string,
  slug: string
): Promise<string> {
  const [row] = await app.client`
    INSERT INTO categorias (nome, tipo_categoria_id)
    SELECT ${nome}, id FROM tipo_categorias WHERE slug = ${slug}
    RETURNING id
  `;
  return row.id as string;
}
