import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import { assertAccountRole } from "../src/lib/account-authorization.js";
import { NotFoundError, ForbiddenError } from "../src/lib/errors.js";

describe("assertAccountRole (pure)", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({});
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function createUser(id: string, email: string) {
    const [user] = await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email)
      VALUES (${id}, ${email.split("@")[0]}, ${email})
      RETURNING id
    `;
    return user.id as string;
  }

  async function createConta(nome: string) {
    const [conta] = await testApp.client`
      INSERT INTO contas (nome, saldo_inicial)
      VALUES (${nome}, 0)
      RETURNING id
    `;
    return conta.id as string;
  }

  async function associate(contaId: string, userId: string, papel: string) {
    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${userId}, ${papel})
    `;
  }

  it("passes when user is owner and minRole is owner", async () => {
    const userId = await createUser("prov-owner", "owner@example.com");
    const contaId = await createConta("Conta");
    await associate(contaId, userId, "owner");

    await expect(assertAccountRole(userId, contaId, "owner")).resolves.toBeUndefined();
  });

  it("passes when user is viewer and minRole is viewer", async () => {
    const userId = await createUser("prov-viewer", "viewer@example.com");
    const contaId = await createConta("Conta");
    await associate(contaId, userId, "viewer");

    await expect(assertAccountRole(userId, contaId, "viewer")).resolves.toBeUndefined();
  });

  it("throws ForbiddenError when viewer requests owner", async () => {
    const userId = await createUser("prov-viewer2", "v2@example.com");
    const contaId = await createConta("Conta");
    await associate(contaId, userId, "viewer");

    await expect(assertAccountRole(userId, contaId, "owner")).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it("throws ForbiddenError when user has no association", async () => {
    const userId = await createUser("prov-orphan", "orphan@example.com");
    const contaId = await createConta("Conta");

    await expect(assertAccountRole(userId, contaId, "viewer")).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it("throws NotFoundError when conta does not exist", async () => {
    const userId = await createUser("prov-noconta", "noconta@example.com");
    const missingContaId = "00000000-0000-0000-0000-000000000000";

    await expect(assertAccountRole(userId, missingContaId, "viewer")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
