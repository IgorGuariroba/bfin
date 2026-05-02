import { generateKeyPair, SignJWT, exportJWK, JWTPayload } from "jose";
import type { TokenValidator } from "../../src/plugins/oidc.js";

export const TEST_AUDIENCE = "https://api.bfincont.com.br";

export interface TestKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  kid: string;
}

export async function generateTestKeyPair(): Promise<TestKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
  });
  return {
    privateKey,
    publicKey,
    kid: `test-key-${Date.now()}`,
  };
}

export async function createTestJwksProvider(
  keyPair: TestKeyPair,
  audience?: string
): Promise<TokenValidator> {
  const jwk = await exportJWK(keyPair.publicKey);
  jwk.kid = keyPair.kid;
  jwk.use = "sig";
  jwk.alg = "RS256";

  const jwks = {
    keys: [jwk],
  };

  return async (token: string) => {
    const { jwtVerify, createLocalJWKSet } = await import("jose");
    const localJwks = createLocalJWKSet(jwks);
    const verifyOpts: Parameters<typeof jwtVerify>[2] = { algorithms: ["RS256"] };
    if (audience) verifyOpts.audience = audience;
    const { payload } = await jwtVerify(token, localJwks, verifyOpts);

    return {
      sub: String(payload.sub),
      name: payload.name as string | undefined,
      given_name: payload.given_name as string | undefined,
      family_name: payload.family_name as string | undefined,
      email: payload.email as string | undefined,
      email_verified: payload.email_verified as boolean | undefined,
      aud: payload.aud as string | string[] | undefined,
    };
  };
}

export async function signTestToken(
  keyPair: TestKeyPair,
  payload: JWTPayload
): Promise<string> {
  const merged = {
    email_verified: true,
    aud: TEST_AUDIENCE,
    ...payload,
  };
  const jwt = new SignJWT(merged)
    .setProtectedHeader({ alg: "RS256", kid: keyPair.kid })
    .setIssuedAt();

  if (payload.exp) {
    jwt.setExpirationTime(payload.exp);
  }

  return jwt.sign(keyPair.privateKey);
}
