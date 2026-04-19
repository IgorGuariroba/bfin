import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";
import { deleteCategory } from "../src/services/category-service.js";

describe("Category service SQL injection protection", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function createUser(
    app: TestApp,
    idProvedor: string,
    email: string,
    isAdmin = false
  ) {
    const [user] = await app.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${idProvedor}, ${email.split("@")[0]}, ${email}, ${isAdmin})
      RETURNING id
    `;
    return user.id as string;
  }

  async function seedTipoCategorias(app: TestApp) {
    await app.client`
      INSERT INTO tipo_categorias (slug, nome)
      VALUES ('receita', 'Receita'), ('despesa', 'Despesa'), ('divida', 'Dívida')
      ON CONFLICT (slug) DO NOTHING
    `;
  }

  describe("DELETE /categorias/:id", () => {
    it("rejects malicious id with quote injection (Zod UUID validation)", async () => {
      const keyPair = await generateTestKeyPair();
      const validateToken = await createTestJwksProvider(keyPair);
      testApp = await createTestApp({ validateToken });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);
      await createUser(testApp, "admin-user", "admin@example.com", true);

      const token = await signTestToken(keyPair, {
        sub: "admin-user",
        email: "admin@example.com",
        name: "Admin",
      });

      const maliciousId = "' OR '1'='1";
      const res = await testApp.app.inject({
        method: "DELETE",
        url: `/categorias/${maliciousId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
    });

    it("does not drop table on semicolon injection", async () => {
      const keyPair = await generateTestKeyPair();
      const validateToken = await createTestJwksProvider(keyPair);
      testApp = await createTestApp({ validateToken });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);
      await createUser(testApp, "admin-user", "admin@example.com", true);

      const token = await signTestToken(keyPair, {
        sub: "admin-user",
        email: "admin@example.com",
        name: "Admin",
      });

      const maliciousId = "550e8400-e29b-41d4-a716-446655440000'; DROP TABLE categorias; --";
      const res = await testApp.app.inject({
        method: "DELETE",
        url: `/categorias/${maliciousId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);

      const tableCheck = await testApp.client`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categorias'
      `;
      expect(tableCheck.length).toBe(1);
    });

    it("rejects malicious id with union injection", async () => {
      const keyPair = await generateTestKeyPair();
      const validateToken = await createTestJwksProvider(keyPair);
      testApp = await createTestApp({ validateToken });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);
      await createUser(testApp, "admin-user", "admin@example.com", true);

      const token = await signTestToken(keyPair, {
        sub: "admin-user",
        email: "admin@example.com",
        name: "Admin",
      });

      const maliciousId = "1' UNION SELECT id, nome, tipo_categoria_id, created_at, updated_at FROM categorias--";
      const res = await testApp.app.inject({
        method: "DELETE",
        url: `/categorias/${maliciousId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe("deleteCategory service", () => {
    it("rejects malicious id with quote injection (Postgres UUID validation)", async () => {
      testApp = await createTestApp({});
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);

      const maliciousId = "' OR '1'='1";
      await expect(deleteCategory(maliciousId)).rejects.toThrow();
    });

    it("rejects malicious id with comment injection (Postgres UUID validation)", async () => {
      testApp = await createTestApp({});
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);

      const maliciousId = "550e8400-e29b-41d4-a716-446655440000'--";
      await expect(deleteCategory(maliciousId)).rejects.toThrow();
    });

    it("does not delete linked records when id contains injection", async () => {
      const keyPair = await generateTestKeyPair();
      const validateToken = await createTestJwksProvider(keyPair);
      testApp = await createTestApp({ validateToken });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);
      const adminId = await createUser(testApp, "admin-user", "admin@example.com", true);

      const [tipoDespesa] = await testApp.client`SELECT id FROM tipo_categorias WHERE slug = 'despesa'`;
      const [cat] = await testApp.client`
        INSERT INTO categorias (nome, tipo_categoria_id) VALUES ('Temp', ${tipoDespesa.id}) RETURNING id
      `;
      const [conta] = await testApp.client`
        INSERT INTO contas (nome, saldo_inicial) VALUES ('Conta Temp', 0) RETURNING id
      `;
      await testApp.client`
        INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, valor, data)
        VALUES (${conta.id}, ${adminId}, ${cat.id}, 100, '2024-01-01')
      `;

      const maliciousId = `${cat.id}' OR '1'='1`;
      await expect(deleteCategory(maliciousId)).rejects.toThrow();

      const [remaining] = await testApp.client`
        SELECT id FROM categorias WHERE id = ${cat.id}
      `;
      expect(remaining).toBeDefined();

      const [linked] = await testApp.client`
        SELECT id FROM movimentacoes WHERE categoria_id = ${cat.id}
      `;
      expect(linked).toBeDefined();
    });
  });
});
