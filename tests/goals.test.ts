import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("POST /metas", () => {
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

  async function createAccount(app: TestApp, usuarioId: string, nome: string) {
    const [conta] = await app.client`
      INSERT INTO contas (nome, saldo_inicial) VALUES (${nome}, 0) RETURNING id
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

  it("owner cria meta nova com 201", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "meta1", "meta1@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M1");
    const token = await tokenFor(keyPair, "meta1");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 25 },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.contaId).toBe(contaId);
    expect(body.porcentagem_reserva).toBe("25.00");
  });

  it("owner atualiza meta existente com 200", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "meta2", "meta2@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M2");
    const token = await tokenFor(keyPair, "meta2");

    await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 20 },
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 30 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.porcentagem_reserva).toBe("30.00");
  });

  it("viewer recebe 403", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const ownerId = await createUser(testApp, "meta-o", "meta-o@example.com");
    const viewerId = await createUser(testApp, "meta-v", "meta-v@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta MV");
    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;
    const token = await tokenFor(keyPair, "meta-v");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 30 },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("rejeita porcentagem > 100 com 400", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "meta3", "meta3@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M3");
    const token = await tokenFor(keyPair, "meta3");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 150 },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).code).toBe("VALIDATION_ERROR");
  });

  it("rejeita porcentagem negativa com 400", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "meta4", "meta4@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M4");
    const token = await tokenFor(keyPair, "meta4");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: -5 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("aceita limites 0 e 100", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "meta5", "meta5@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M5");
    const token = await tokenFor(keyPair, "meta5");

    const r0 = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 0 },
    });
    expect(r0.statusCode).toBe(201);

    const r100 = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 100 },
    });
    expect(r100.statusCode).toBe(200);
  });

  it("POST /metas invalida projeções existentes da conta", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "meta6", "meta6@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M6");
    const token = await tokenFor(keyPair, "meta6");

    await testApp.client`
      INSERT INTO projecao (conta_id, mes, dados, status) VALUES
        (${contaId}, '2024-01', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-02', '{}'::jsonb, 'atualizada')
    `;

    const res = await testApp.app.inject({
      method: "POST",
      url: "/metas",
      headers: { authorization: `Bearer ${token}` },
      payload: { contaId, porcentagem_reserva: 25 },
    });
    expect(res.statusCode).toBe(201);

    const linhas = await testApp.client<{ mes: string; status: string }[]>`
      SELECT mes, status FROM projecao WHERE conta_id = ${contaId} ORDER BY mes
    `;
    expect(linhas.map((l) => l.status)).toEqual(["invalidada", "invalidada"]);
  });
});
