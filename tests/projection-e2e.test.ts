import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("Projection E2E", () => {
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
    saldoInicial: number
  ) {
    const [conta] = await app.client`
      INSERT INTO contas (nome, saldo_inicial, created_at)
      VALUES ('Conta E2E', ${saldoInicial}, '2024-03-01T00:00:00Z')
      RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${conta.id}, ${usuarioId}, 'owner')
    `;
    return conta.id as string;
  }

  async function token(keyPair: Awaited<ReturnType<typeof generateTestKeyPair>>, sub: string) {
    return signTestToken(keyPair, { sub, email: `${sub}@example.com`, name: sub });
  }

  it("fluxo completo: meta + movimentações + dívida + pagamento e cascata de 3 meses", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);

    const userId = await createUser(testApp, "e2e", "e2e@example.com");
    const contaId = await createAccount(testApp, userId, 3000);
    const receitaCat = await createCategory(testApp, "Salário", "receita");
    const despesaCat = await createCategory(testApp, "Moradia", "despesa");
    const dividaCat = await createCategory(testApp, "Cartão", "divida");
    const t = await token(keyPair, "e2e");

    const metaRes = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${t}` },
      payload: { contaId, porcentagem_reserva: 20 },
    });
    expect(metaRes.statusCode).toBe(201);

    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${t}` },
      payload: {
        contaId,
        tipo: "receita",
        categoriaId: receitaCat,
        valor: 5000,
        data: "2024-03-05",
        recorrente: true,
      },
    });

    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${t}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId: despesaCat,
        valor: 1500,
        data: "2024-03-10",
        recorrente: true,
      },
    });

    const dividaRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${t}` },
      payload: {
        contaId,
        categoriaId: dividaCat,
        descricao: "Compra parcelada",
        valorTotal: 900,
        totalParcelas: 3,
        dataInicio: "2024-03-20",
      },
    });
    const divida = JSON.parse(dividaRes.payload);

    await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${divida.id}/parcelas/${divida.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${t}` },
      payload: { dataPagamento: "2024-03-25" },
    });

    const marco = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(marco.statusCode).toBe(200);
    const marcoBody = JSON.parse(marco.payload);
    expect(marcoBody.meta_reserva).not.toBeNull();
    expect(marcoBody.resumo.reserva_ideal).toBe("1000.00");

    const abril = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-04`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(abril.statusCode).toBe(200);

    const maio = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-05`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(maio.statusCode).toBe(200);

    const persisted = await testApp.client<{ mes: string; status: string }[]>`
      SELECT mes, status FROM projecao WHERE conta_id = ${contaId} ORDER BY mes
    `;
    expect(persisted.map((r) => r.mes)).toEqual([
      "2024-03",
      "2024-04",
      "2024-05",
    ]);
  });

  it("alterar saldo_inicial invalida todas as projeções e muda a projeção futura", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "e2e-sal", "e2e-sal@example.com");
    const contaId = await createAccount(testApp, userId, 1000);
    const t = await token(keyPair, "e2e-sal");

    const first = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(JSON.parse(first.payload).resumo.saldo_final_projetado).toBe(
      "1000.00"
    );

    const patchRes = await testApp.app.inject({
      method: "PATCH",
      url: `/contas/${contaId}`,
      headers: { authorization: `Bearer ${t}` },
      payload: { saldo_inicial: 5000 },
    });
    expect(patchRes.statusCode).toBe(200);

    const invalidadas = await testApp.client<{ status: string }[]>`
      SELECT status FROM projecao WHERE conta_id = ${contaId}
    `;
    expect(invalidadas.every((r) => r.status === "invalidada")).toBe(true);

    const second = await testApp.app.inject({
      method: "GET",
      url: `/projecao?contaId=${contaId}&mes=2024-03`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(JSON.parse(second.payload).resumo.saldo_final_projetado).toBe(
      "5000.00"
    );
  });
});
