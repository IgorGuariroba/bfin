import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("GET /contas/:id/limite-diario-v2", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function setup() {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await testApp.client`
      INSERT INTO tipo_categorias (slug, nome)
      VALUES ('receita', 'Receita'), ('despesa', 'Despesa'), ('divida', 'Dívida')
      ON CONFLICT (slug) DO NOTHING
    `;
    return { keyPair, testApp };
  }

  async function createUser(app: TestApp, idProvedor: string, email: string) {
    const [u] = await app.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${idProvedor}, ${idProvedor}, ${email}, false)
      RETURNING id
    `;
    return u.id as string;
  }

  async function createAccount(app: TestApp, userId: string, nome: string, saldoInicial = 0) {
    const [c] = await app.client`
      INSERT INTO contas (nome, saldo_inicial) VALUES (${nome}, ${saldoInicial}) RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${c.id}, ${userId}, 'owner')
    `;
    return c.id as string;
  }

  async function tokenFor(keyPair: Awaited<ReturnType<typeof generateTestKeyPair>>, sub: string) {
    return signTestToken(keyPair, { sub, email: `${sub}@example.com`, name: sub });
  }

  it("owner consulta limite v2 retorna 200 com payload completo", async () => {
    const { keyPair } = await setup();
    const userId = await createUser(testApp, "v2r-o", "v2r-o@example.com");
    const contaId = await createAccount(testApp, userId, "Conta V2", 3000);
    const token = await tokenFor(keyPair, "v2r-o");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario-v2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.contaId).toBe(contaId);
    expect(body.janela_inicio).toBeDefined();
    expect(body.janela_fim).toBeDefined();
    expect(body.horizonte_dias).toBe(30);
    expect(body.saldo_atual).toBe("3000.00");
    expect(body.limite_diario).toBe("100.00");
    expect(body.calculado_em).toBeDefined();
    expect(Object.keys(body)).toEqual([
      "contaId",
      "janela_inicio",
      "janela_fim",
      "horizonte_dias",
      "saldo_atual",
      "limite_diario",
      "calculado_em",
    ]);
  });

  it("viewer consulta limite v2 retorna 200", async () => {
    const { keyPair } = await setup();
    const ownerId = await createUser(testApp, "v2r-own", "v2r-own@example.com");
    const viewerId = await createUser(testApp, "v2r-view", "v2r-view@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta V2V", 1000);
    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;
    const token = await tokenFor(keyPair, "v2r-view");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario-v2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("usuário sem vínculo recebe 403 INSUFFICIENT_PERMISSIONS", async () => {
    const { keyPair } = await setup();
    const ownerId = await createUser(testApp, "v2r-own2", "v2r-own2@example.com");
    await createUser(testApp, "v2r-str", "v2r-str@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta V2S", 1000);
    const token = await tokenFor(keyPair, "v2r-str");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario-v2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("conta inexistente retorna 404 RESOURCE_NOT_FOUND", async () => {
    const { keyPair } = await setup();
    const userId = await createUser(testApp, "v2r-404", "v2r-404@example.com");
    const contaId = await createAccount(testApp, userId, "Conta V2X", 0);
    const token = await tokenFor(keyPair, "v2r-404");
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${fakeId}/limite-diario-v2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("resposta não inclui projecao, porcentagem_reserva, recorrentes futuras nem parcelasDivida", async () => {
    const { keyPair } = await setup();
    const userId = await createUser(testApp, "v2r-clean", "v2r-clean@example.com");
    const contaId = await createAccount(testApp, userId, "Conta V2C", 3000);
    const token = await tokenFor(keyPair, "v2r-clean");

    // Add meta with porcentagem_reserva — should not affect result
    await testApp.client`
      INSERT INTO meta (conta_id, porcentagem_reserva)
      VALUES (${contaId}, 50)
      ON CONFLICT (conta_id) DO UPDATE SET porcentagem_reserva = 50
    `;

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario-v2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // porcentagem_reserva não altera resultado
    expect(body.saldo_atual).toBe("3000.00");
    expect(body.limite_diario).toBe("100.00");
    // payload não tem campos extras
    expect(body).not.toHaveProperty("projecao");
    expect(body).not.toHaveProperty("porcentagem_reserva");
    expect(body).not.toHaveProperty("despesas_fixas_pendentes");
  });
});
