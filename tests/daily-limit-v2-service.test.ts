import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import { calcularLimiteDiarioV2 } from "../src/services/daily-limit-v2-service.js";
import { NotFoundError } from "../src/lib/errors.js";

describe("calcularLimiteDiarioV2", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function setup() {
    testApp = await createTestApp();
    await testApp.truncateAll();
    await testApp.client`
      INSERT INTO tipo_categorias (slug, nome)
      VALUES ('receita', 'Receita'), ('despesa', 'Despesa'), ('divida', 'Dívida')
      ON CONFLICT (slug) DO NOTHING
    `;
    return testApp;
  }

  async function createUser(app: TestApp, idProvedor: string) {
    const [u] = await app.client`
      INSERT INTO usuarios (id_provedor, nome, email)
      VALUES (${idProvedor}, ${idProvedor}, ${idProvedor + "@example.com"})
      RETURNING id
    `;
    return u.id as string;
  }

  async function createAccount(app: TestApp, userId: string, saldoInicial = 0) {
    const [c] = await app.client`
      INSERT INTO contas (nome, saldo_inicial) VALUES ('Conta', ${saldoInicial}) RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${c.id}, ${userId}, 'owner')
    `;
    return c.id as string;
  }

  async function createCategory(app: TestApp, tipo: string) {
    const [r] = await app.client`
      INSERT INTO categorias (nome, tipo_categoria_id)
      SELECT ${tipo}, id FROM tipo_categorias WHERE slug = ${tipo}
      RETURNING id
    `;
    return r.id as string;
  }

  async function addMovimentacao(
    app: TestApp,
    contaId: string,
    userId: string,
    catId: string,
    valor: number,
    data: Date,
    recorrente = false
  ) {
    await app.client`
      INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, valor, data, recorrente)
      VALUES (${contaId}, ${userId}, ${catId}, ${valor}, ${data.toISOString()}, ${recorrente})
    `;
  }

  it("cálculo padrão: saldo_inicial + receitas - despesas", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-c1");
    const contaId = await createAccount(app, userId, 1000);
    const recCat = await createCategory(app, "receita");
    const despCat = await createCategory(app, "despesa");
    const hoje = new Date("2026-04-24T10:00:00Z");
    const ontem = new Date("2026-04-23T10:00:00Z");
    await addMovimentacao(app, contaId, userId, recCat, 3000, ontem);
    await addMovimentacao(app, contaId, userId, despCat, 1500, ontem);

    const result = await calcularLimiteDiarioV2({ contaId, hoje });

    expect(result.saldo_atual).toBe("2500.00");
    expect(result.limite_diario).toBe("83.33");
    expect(result.horizonte_dias).toBe(30);
  });

  it("saldo zero retorna limite_diario = 0.00", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-zero");
    const contaId = await createAccount(app, userId, 0);

    const result = await calcularLimiteDiarioV2({ contaId, hoje: new Date() });

    expect(result.saldo_atual).toBe("0.00");
    expect(result.limite_diario).toBe("0.00");
  });

  it("saldo negativo retorna limite_diario = 0.00", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-neg");
    const contaId = await createAccount(app, userId, 0);
    const despCat = await createCategory(app, "despesa");
    const ontem = new Date(Date.now() - 86400000);
    await addMovimentacao(app, contaId, userId, despCat, 500, ontem);

    const result = await calcularLimiteDiarioV2({ contaId });

    expect(result.limite_diario).toBe("0.00");
  });

  it("arredondamento HALF_EVEN: saldo 100.00 / 30", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-rnd");
    const contaId = await createAccount(app, userId, 100);

    const result = await calcularLimiteDiarioV2({ contaId, hoje: new Date() });

    // 10000n / 30 = 333 remainder 10, *2=20 < 30 → round down → 333 centavos = 3.33
    expect(result.limite_diario).toBe("3.33");
  });

  it("receitas futuras não contam", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-fut");
    const contaId = await createAccount(app, userId, 0);
    const recCat = await createCategory(app, "receita");
    const hoje = new Date("2026-04-24T10:00:00Z");
    const amanha = new Date("2026-04-25T10:00:00Z");
    await addMovimentacao(app, contaId, userId, recCat, 1000, amanha);

    const result = await calcularLimiteDiarioV2({ contaId, hoje });

    expect(result.saldo_atual).toBe("0.00");
    expect(result.limite_diario).toBe("0.00");
  });

  it("parcelas de dívida não entram em saldo_atual", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-div");
    const contaId = await createAccount(app, userId, 3000);
    const divCat = await createCategory(app, "divida");
    const hoje = new Date("2026-04-24T10:00:00Z");

    const [divida] = await app.client`
      INSERT INTO dividas (conta_id, usuario_id, categoria_id, descricao, valor_total, total_parcelas, valor_parcela, data_inicio)
      VALUES (${contaId}, ${userId}, ${divCat}, 'Dívida', 600, 2, 300, '2026-04-01')
      RETURNING id
    `;
    await app.client`
      INSERT INTO parcelas_divida (divida_id, numero_parcela, valor, data_vencimento)
      VALUES (${divida.id}, 1, 300, '2026-04-30'), (${divida.id}, 2, 300, '2026-05-30')
    `;

    const result = await calcularLimiteDiarioV2({ contaId, hoje });

    expect(result.saldo_atual).toBe("3000.00");
    expect(result.limite_diario).toBe("100.00");
  });

  it("recorrentes futuras não entram em saldo_atual", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-rec");
    const contaId = await createAccount(app, userId, 3000);
    const despCat = await createCategory(app, "despesa");
    const hoje = new Date("2026-04-24T10:00:00Z");
    const amanha = new Date("2026-04-25T10:00:00Z");
    await addMovimentacao(app, contaId, userId, despCat, 500, amanha, true);

    const result = await calcularLimiteDiarioV2({ contaId, hoje });

    expect(result.saldo_atual).toBe("3000.00");
    expect(result.limite_diario).toBe("100.00");
  });

  it("meta não altera limite v2", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-meta");
    const contaId1 = await createAccount(app, userId, 3000);
    const contaId2 = await createAccount(app, userId, 3000);
    const hoje = new Date("2026-04-24T10:00:00Z");

    await app.client`
      INSERT INTO meta (conta_id, porcentagem_reserva)
      VALUES (${contaId1}, 30)
      ON CONFLICT (conta_id) DO UPDATE SET porcentagem_reserva = 30
    `;

    const r1 = await calcularLimiteDiarioV2({ contaId: contaId1, hoje });
    const r2 = await calcularLimiteDiarioV2({ contaId: contaId2, hoje });

    expect(r1.limite_diario).toBe(r2.limite_diario);
    expect(r1.saldo_atual).toBe(r2.saldo_atual);
  });

  it("conta inexistente lança NotFoundError", async () => {
    const app = await setup();

    await expect(
      calcularLimiteDiarioV2({ contaId: "00000000-0000-0000-0000-000000000000" })
    ).rejects.toThrow(NotFoundError);
  });

  it("janela UTC: horizonte_dias=30 e janela_fim = hoje + 30 dias", async () => {
    const app = await setup();
    const userId = await createUser(app, "v2-jan");
    const contaId = await createAccount(app, userId, 0);
    const hoje = new Date("2026-04-28T10:00:00Z");

    const result = await calcularLimiteDiarioV2({ contaId, hoje });

    expect(result.janela_inicio).toBe("2026-04-28T10:00:00.000Z");
    expect(result.janela_fim).toBe("2026-05-28T10:00:00.000Z");
    expect(result.horizonte_dias).toBe(30);
  });
});
