import { discovery, allowInsecureRequests } from "openid-client";
import { jwtVerify, createRemoteJWKSet, errors as joseErrors, type JWTPayload } from "jose";

export class JwtValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "TOKEN_EXPIRED" | "TOKEN_INVALID"
  ) {
    super(message);
    this.name = "JwtValidationError";
  }
}

export interface JwtVerifier {
  verify(token: string): Promise<JWTPayload>;
  readonly issuer: string;
}

export async function createJwtVerifier(params: {
  issuerUrl: string;
  audience: string;
  clientIdForDiscovery?: string;
  allowInsecureHttp?: boolean;
}): Promise<JwtVerifier> {
  const {
    issuerUrl,
    audience,
    clientIdForDiscovery = "bfin-mcp",
    allowInsecureHttp = process.env.OIDC_ALLOW_INSECURE === "true",
  } = params;

  const serverUrl = new URL(issuerUrl);
  const clientConfig = await discovery(
    serverUrl,
    clientIdForDiscovery,
    undefined,
    undefined,
    allowInsecureHttp ? { execute: [allowInsecureRequests] } : undefined
  );
  const metadata = clientConfig.serverMetadata();
  const issuer = metadata.issuer;

  if (!metadata.jwks_uri) {
    throw new Error("OIDC provider metadata missing jwks_uri");
  }

  const jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));

  return {
    issuer,
    async verify(token: string): Promise<JWTPayload> {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          audience,
        });
        return payload;
      } catch (err) {
        if (err instanceof joseErrors.JWTExpired) {
          throw new JwtValidationError("Token expired", "TOKEN_EXPIRED");
        }
        if (
          err instanceof joseErrors.JWSSignatureVerificationFailed ||
          err instanceof joseErrors.JWTInvalid ||
          err instanceof joseErrors.JWTClaimValidationFailed ||
          err instanceof joseErrors.JWKSNoMatchingKey ||
          err instanceof joseErrors.JWKSMultipleMatchingKeys ||
          err instanceof joseErrors.JWKSInvalid ||
          err instanceof joseErrors.JWKInvalid ||
          err instanceof joseErrors.JOSEAlgNotAllowed ||
          err instanceof joseErrors.JWSInvalid
        ) {
          throw new JwtValidationError("Token invalid", "TOKEN_INVALID");
        }
        throw err;
      }
    },
  };
}
