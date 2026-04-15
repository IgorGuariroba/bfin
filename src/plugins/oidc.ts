import { discovery } from "openid-client";
import { jwtVerify, createRemoteJWKSet, errors as joseErrors } from "jose";
import { config } from "../config.js";

export interface OidcClaims {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}

export type TokenValidator = (token: string) => Promise<OidcClaims>;

let tokenValidator: TokenValidator | undefined;

export async function initOidc(): Promise<void> {
  try {
    const serverUrl = new URL(config.oidcIssuerUrl);
    const clientConfig = await discovery(serverUrl, "bfin-api");
    const metadata = clientConfig.serverMetadata();
    const issuer = metadata.issuer;

    if (!metadata.jwks_uri) {
      throw new Error("OIDC provider metadata missing jwks_uri");
    }

    const jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));

    tokenValidator = async (token: string): Promise<OidcClaims> => {
      const verifyOptions: Parameters<typeof jwtVerify>[2] = {
        issuer,
      };
      if (config.oidcAudience) {
        verifyOptions.audience = config.oidcAudience;
      }

      try {
        const { payload } = await jwtVerify(token, jwks, verifyOptions);
        return {
          sub: String(payload.sub),
          name: payload.name as string | undefined,
          given_name: payload.given_name as string | undefined,
          family_name: payload.family_name as string | undefined,
          email: payload.email as string | undefined,
        };
      } catch (err) {
        if (err instanceof joseErrors.JWTExpired) {
          throw new TokenValidationError("Token expired", "TOKEN_EXPIRED");
        }
        if (
          err instanceof joseErrors.JWSSignatureVerificationFailed ||
          err instanceof joseErrors.JWTInvalid ||
          err instanceof joseErrors.JWTClaimValidationFailed ||
          err instanceof joseErrors.JWKSNoMatchingKey ||
          err instanceof joseErrors.JWKSMultipleMatchingKeys ||
          err instanceof joseErrors.JWKSInvalid ||
          err instanceof joseErrors.JWKInvalid ||
          err instanceof joseErrors.JOSEAlgNotAllowed
        ) {
          throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
        }
        throw err;
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OIDC discovery failed for ${config.oidcIssuerUrl}: ${message}`);
  }
}

export function getTokenValidator(): TokenValidator {
  if (!tokenValidator) {
    throw new Error("OIDC not initialized. Call initOidc() during bootstrap.");
  }
  return tokenValidator;
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
