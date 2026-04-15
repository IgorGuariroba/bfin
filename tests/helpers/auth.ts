import { generateKeyPair, SignJWT, exportJWK, JWTPayload } from "jose";
import type { TokenValidator } from "../../src/plugins/oidc.js";

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
  keyPair: TestKeyPair
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
    const { payload } = await jwtVerify(token, localJwks, {
      algorithms: ["RS256"],
    });

    return {
      sub: String(payload.sub),
      name: payload.name as string | undefined,
      given_name: payload.given_name as string | undefined,
      family_name: payload.family_name as string | undefined,
      email: payload.email as string | undefined,
    };
  };
}

export async function signTestToken(
  keyPair: TestKeyPair,
  payload: JWTPayload
): Promise<string> {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: keyPair.kid })
    .setIssuedAt();

  if (payload.exp) {
    jwt.setExpirationTime(payload.exp);
  }

  return jwt.sign(keyPair.privateKey);
}
