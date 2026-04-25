import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";
import { DAILY_LIMIT_V1_SUNSET } from "../src/lib/deprecation.js";

describe("GET /contas/:id/limite-diario", () => {
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
    saldoInicial = 0
  ) {
    const [conta] = await app.client`
      INSERT INTO contas (nome, saldo_inicial) VALUES (${nome}, ${saldoInicial}) RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${conta.id}, ${usuarioId}, 'owner')
    `;
    return conta.id as string;
  }

  async function tokenFor(keyPair: Awaited<ReturnType<typeof generateTestKeyPair>>, sub: string) {
    return signTestToken(keyPair, { sub, email: `${sub}@example.com`, name: sub });
  }

  it("owner consulta limite", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "ld1", "ld1@example.com");
    const contaId = await createAccount(testApp, userId, "Conta LD1", 3200);
    const token = await tokenFor(keyPair, "ld1");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.contaId).toBe(contaId);
    expect(body.saldo_disponivel).toBe("3200.00");
    expect(body.despesas_fixas_pendentes).toBe("0.00");
    expect(body.dias_restantes).toBeGreaterThan(0);
    expect(body.limite_diario).toBeDefined();

    // headers de deprecação
    expect(res.headers["deprecation"]).toBe("true");
    expect(res.headers["sunset"]).toBe(DAILY_LIMIT_V1_SUNSET);
    expect(res.headers["link"]).toContain(`rel="successor-version"`);
    expect(res.headers["link"]).toContain(`/contas/${contaId}/limite-diario-v2`);
  });

  it("viewer consulta limite", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const ownerId = await createUser(testApp, "ld-o", "ld-o@example.com");
    const viewerId = await createUser(testApp, "ld-v", "ld-v@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta LDV", 500);
    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;
    const token = await tokenFor(keyPair, "ld-v");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("stranger recebe 403", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const ownerId = await createUser(testApp, "ld-o2", "ld-o2@example.com");
    await createUser(testApp, "ld-x", "ld-x@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta LDX", 100);
    const token = await tokenFor(keyPair, "ld-x");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);

    // erros NÃO trazem headers de deprecação
    expect(res.headers["deprecation"]).toBeUndefined();
    expect(res.headers["sunset"]).toBeUndefined();
  });

  it("saldo negativo retorna limite_diario = 0.00", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "ld-neg", "ld-neg@example.com");
    const contaId = await createAccount(testApp, userId, "Conta LDN", 0);
    const despesaCat = await createCategory(testApp, "Gasto", "despesa");
    const now = new Date();
    const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await testApp.client`
      INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, valor, data, recorrente)
      VALUES (${contaId}, ${userId}, ${despesaCat}, 500, ${ontem.toISOString()}, false)
    `;
    const token = await tokenFor(keyPair, "ld-neg");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.limite_diario).toBe("0.00");
  });

  it("parcela pendente no mês entra em despesas_fixas_pendentes", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "ld-pc", "ld-pc@example.com");
    const contaId = await createAccount(testApp, userId, "Conta LDP", 2000);
    const divCat = await createCategory(testApp, "Cartão", "divida");
    const now = new Date();
    const venc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 28));
    const vencIso = venc.toISOString().slice(0, 10);
    const [divida] = await testApp.client`
      INSERT INTO dividas (conta_id, usuario_id, categoria_id, descricao, valor_total, total_parcelas, valor_parcela, data_inicio)
      VALUES (${contaId}, ${userId}, ${divCat}, 'Divida', 300, 1, 300, ${vencIso})
      RETURNING id
    `;
    await testApp.client`
      INSERT INTO parcelas_divida (divida_id, numero_parcela, valor, data_vencimento)
      VALUES (${divida.id}, 1, 300, ${vencIso})
    `;
    const token = await tokenFor(keyPair, "ld-pc");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/limite-diario`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.despesas_fixas_pendentes).toBe("300.00");
    expect(body.saldo_disponivel).toBe("1700.00");
  });
});
