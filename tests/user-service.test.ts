import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";
import { findOrCreateUser, UserCreationError } from "../src/services/user-service.js";
import type { OidcClaims } from "../src/plugins/oidc.js";

const ADMIN_EMAIL = "admin@example.com";

vi.mock("../src/config.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/config.js")>();
  return {
    ...mod,
    config: new Proxy({} as mod.Config, {
      get(_, prop) {
        if (prop === "adminEmails") return new Set([ADMIN_EMAIL]);
        return mod.config[prop as keyof mod.Config];
      },
      has() {
        return true;
      },
      ownKeys() {
        return Reflect.ownKeys(mod.config);
      },
      getOwnPropertyDescriptor(_, prop) {
        return Reflect.getOwnPropertyDescriptor(mod.config, prop);
      },
    }),
  };
});

describe("findOrCreateUser", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown();
  });

  function makeClaims(overrides: Partial<OidcClaims> = {}): OidcClaims {
    return {
      sub: "user-123",
      email: "user@example.com",
      name: "Test User",
      email_verified: true,
      ...overrides,
    };
  }

  it("throws CLAIMS_INSUFFICIENT when email is missing", async () => {
    await expect(findOrCreateUser(makeClaims({ email: undefined }))).rejects.toThrow(
      new UserCreationError("Token missing required claim: email", "CLAIMS_INSUFFICIENT")
    );
  });

  it("uses name claim when provided", async () => {
    const user = await findOrCreateUser(makeClaims({ name: "Full Name" }));
    expect(user.nome).toBe("Full Name");
  });

  it("falls back to given_name + family_name", async () => {
    const user = await findOrCreateUser(
      makeClaims({ name: undefined, given_name: "John", family_name: "Doe" })
    );
    expect(user.nome).toBe("John Doe");
  });

  it("falls back to given_name alone", async () => {
    const user = await findOrCreateUser(
      makeClaims({ name: undefined, given_name: "Jane", family_name: undefined })
    );
    expect(user.nome).toBe("Jane");
  });

  it("falls back to Unknown when no name claims", async () => {
    const user = await findOrCreateUser(
      makeClaims({ name: undefined, given_name: undefined, family_name: undefined })
    );
    expect(user.nome).toBe("Unknown");
  });

  it("returns existing user by provider without changes", async () => {
    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${"user-123"}, ${"Existing"}, ${"user@example.com"}, ${false})
    `;

    const user = await findOrCreateUser(makeClaims());
    expect(user.nome).toBe("Existing");
    expect(user.isAdmin).toBe(false);
  });

  it("promotes existing provider user to admin when email is in admin list", async () => {
    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${"user-123"}, ${"Existing"}, ${ADMIN_EMAIL}, ${false})
    `;

    const user = await findOrCreateUser(makeClaims({ email: ADMIN_EMAIL }));
    expect(user.isAdmin).toBe(true);

    const row = await testApp.client`
      SELECT is_admin FROM usuarios WHERE id_provedor = ${"user-123"}
    `;
    expect(row[0].is_admin).toBe(true);
  });

  it("throws EMAIL_NOT_VERIFIED when relinking unverified email", async () => {
    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${"old-provider"}, ${"Existing"}, ${"user@example.com"}, ${false})
    `;

    await expect(
      findOrCreateUser(makeClaims({ email_verified: false }))
    ).rejects.toThrow(
      new UserCreationError("Email not verified; cannot re-link account", "EMAIL_NOT_VERIFIED")
    );
  });

  it("relinks existing user by email and promotes to admin", async () => {
    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${"old-provider"}, ${"Existing"}, ${ADMIN_EMAIL}, ${false})
    `;

    const user = await findOrCreateUser(
      makeClaims({ sub: "new-provider", email: ADMIN_EMAIL })
    );
    expect(user.idProvedor).toBe("new-provider");
    expect(user.isAdmin).toBe(true);

    const row = await testApp.client`
      SELECT id_provedor, is_admin FROM usuarios WHERE email = ${ADMIN_EMAIL}
    `;
    expect(row[0].id_provedor).toBe("new-provider");
    expect(row[0].is_admin).toBe(true);
  });

  it("creates new user when no match exists", async () => {
    const user = await findOrCreateUser(makeClaims());
    expect(user.idProvedor).toBe("user-123");
    expect(user.email).toBe("user@example.com");
    expect(user.nome).toBe("Test User");
    expect(user.isAdmin).toBe(false);

    const rows = await testApp.client`
      SELECT * FROM usuarios WHERE id_provedor = ${"user-123"}
    `;
    expect(rows.length).toBe(1);
  });

  it("creates new user as admin when email is in admin list", async () => {
    const user = await findOrCreateUser(makeClaims({ email: ADMIN_EMAIL }));
    expect(user.isAdmin).toBe(true);
  });

  it("throws EMAIL_CONFLICT on unique constraint violation", async () => {
    const { db } = await import("../src/db/index.js");
    const mockChain = {
      values: () => ({
        returning: () =>
          Promise.reject(
            Object.assign(
              new Error('duplicate key value violates unique constraint "usuarios_email_unique"'),
              { code: "23505" }
            )
          ),
      }),
    };
    vi.spyOn(db, "insert").mockReturnValue(mockChain as ReturnType<typeof db.insert>);

    await expect(findOrCreateUser(makeClaims())).rejects.toThrow(
      new UserCreationError("Email already registered with another provider", "EMAIL_CONFLICT")
    );

    vi.restoreAllMocks();
  });
});
