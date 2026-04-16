import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("GET /projecao", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function createUser(app: TestApp, idProvedor: string, email: string) {
    const [user] = await app.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${idProvedor}, ${email.split("@")[0]}, ${email}, false)
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

  async function createCategory(app: TestApp, nome: string, tipo: string) {
    const [row] = await app.client`
      INSERT INTO categorias (nome, tipo_categoria_id)
      SELECT ${nome}, id FROM tipo_categorias WHERE slug = ${tipo}
      RETURNING id
    `;
    return row.id as string;
  }

  async function createAccount(
    app: TestApp,
    usuarioId: string,
    nome: string,
    saldoInicial = 0,
    createdAt = "2024-03-01T00:00:00Z"
  ) {
    const [conta] = await app.client`
      INSERT INTO contas (nome, saldo_inicial, created_at)
      VALUES (${nome}, ${saldoInicial}, ${createdAt})
      RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${conta.id}, ${usuarioId}, 'owner')
    `;
    return conta.id as string;
  }

  async function tokenFor(
    keyPair: Awaited<ReturnType<typeof generateTestKeyPair>>,
    sub: string
  ) {
    return signTestToken(keyPair, { sub, email: `${sub}@example.com`, name: sub });
  }

  it("owner fetches empty projection with saldo_inicial baseline", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "proj1", "proj1@example.com");
    const contaId = await createAccount(testApp, userId, "Conta P1", 1500);
    const token = await tokenFor(keyPair, "proj1");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.contaId).toBe(contaId);
    expect(body.mes).toBe("2024-03");
    expect(body.status).toBe("atualizada");
    expect(body.meta_reserva).toBeNull();
    expect(body.projecao).toHaveLength(31);
    expect(body.projecao[0].saldo_projetado).toBe("1500.00");
    expect(body.projecao[0].indicador_reserva).toBeNull();
    expect(body.resumo.saldo_final_projetado).toBe("1500.00");
    expect(body.resumo.indicador_reserva_final).toBeNull();
  });

  it("viewer reads projection", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "proj-o", "proj-o@example.com");
    const viewerId = await createUser(testApp, "proj-v", "proj-v@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta P2", 500);
    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;
    const token = await tokenFor(keyPair, "proj-v");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).projecao).toHaveLength(31);
  });

  it("stranger gets 403", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "proj-o2", "proj-o2@example.com");
    await createUser(testApp, "proj-x", "proj-x@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta P3");
    const token = await tokenFor(keyPair, "proj-x");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("invalid mes format returns 422", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "proj-mi", "proj-mi@example.com");
    const contaId = await createAccount(testApp, userId, "Conta PMI");
    const token = await tokenFor(keyPair, "proj-mi");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=03-2024`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.payload).code).toBe("VALIDATION_ERROR");
  });

  it("first read persists row and second read is cache hit", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "proj-c", "proj-c@example.com");
    const contaId = await createAccount(testApp, userId, "Conta PC", 1000);
    const token = await tokenFor(keyPair, "proj-c");

    const first = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(first.statusCode).toBe(200);

    const persisted = await testApp.client<{ mes: string; status: string; recalculado_em: string | Date }[]>`
      SELECT mes, status, recalculado_em FROM projecao WHERE conta_id = ${contaId}
    `;
    expect(persisted.length).toBe(1);
    expect(persisted[0].status).toBe("atualizada");
    const firstTimestamp = new Date(persisted[0].recalculado_em).getTime();

    const second = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = JSON.parse(second.payload);
    expect(new Date(secondBody.recalculado_em).getTime()).toBe(firstTimestamp);
  });

  it("recomputes cascade across two months", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "proj-cc", "proj-cc@example.com");
    const contaId = await createAccount(testApp, userId, "Conta PCC", 1000);
    const receitaCat = await createCategory(testApp, "Salário", "receita");
    const token = await tokenFor(keyPair, "proj-cc");

    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "receita",
        categoriaId: receitaCat,
        valor: 500,
        data: "2024-03-05",
      },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-05`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.mes).toBe("2024-05");
    expect(body.resumo.saldo_final_projetado).toBe("1500.00");

    const mesesPersistidos = await testApp.client<{ mes: string }[]>`
      SELECT mes FROM projecao WHERE conta_id = ${contaId} ORDER BY mes
    `;
    expect(mesesPersistidos.map((r) => r.mes)).toEqual([
      "2024-03",
      "2024-04",
      "2024-05",
    ]);
  });
});
