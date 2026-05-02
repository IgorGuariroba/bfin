import { config } from "../config.js";
import { createJwtVerifier, JwtValidationError } from "../lib/oidc-jwks.js";

export interface OidcClaims {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  aud?: string | string[];
}

export type TokenValidator = (token: string) => Promise<OidcClaims>;

export async function initOidc(): Promise<TokenValidator> {
  const verifier = await createJwtVerifier({
    issuerUrl: config.oidcIssuerUrl,
    audience: config.oidcAudience,
    clientIdForDiscovery: "bfin-api",
  });

  return async (token: string): Promise<OidcClaims> => {
    try {
      const payload = await verifier.verify(token);
      const ns = "https://bfincont.com.br/";
      const nsEmail = payload[`${ns}email`] as string | undefined;
      const nsEmailVerified = payload[`${ns}email_verified`] as boolean | undefined;
      const nsName = payload[`${ns}name`] as string | undefined;
      return {
        sub: String(payload.sub),
        name: (payload.name as string | undefined) ?? nsName,
        given_name: payload.given_name as string | undefined,
        family_name: payload.family_name as string | undefined,
        email: (payload.email as string | undefined) ?? nsEmail,
        email_verified: (payload.email_verified as boolean | undefined) ?? nsEmailVerified,
        aud: payload.aud as string | string[] | undefined,
      };
    } catch (err) {
      if (err instanceof JwtValidationError) {
        throw new TokenValidationError(err.message, err.code);
      }
      throw err;
    }
  };
}

export class TokenValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "TOKEN_EXPIRED" | "TOKEN_INVALID"
  ) {
    super(message);
    this.name = "TokenValidationError";
  }
}
