import { env, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { ApiClient } from "@peculiar/acme-client";
import { JsonWebKey as JoseJsonWebKey } from "@peculiar/jose";
import { X509Certificate } from "@peculiar/x509";
import { Certificate } from "@shuvtunnel/protocol/certificate";
import { base64Url, decodeBase64Url, pemBody } from "./crypto.js";

export interface CertificateWorkflowParams {
  readonly tunnelID: string;
  readonly certificateID: string;
  readonly hostname: string;
  readonly identifiers: ReadonlyArray<string>;
  readonly csr: string;
}

interface CloudflareResponse<A> {
  readonly success: boolean;
  readonly result: A;
  readonly errors?: ReadonlyArray<{ readonly message?: string }>;
}

const toPem = (buffer: ArrayBuffer): string => {
  const body = base64Url(new Uint8Array(buffer)).replace(/-/g, "+").replace(/_/g, "/");
  const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
  return `-----BEGIN CERTIFICATE-----\n${padded.match(/.{1,64}/g)?.join("\n") ?? padded}\n-----END CERTIFICATE-----`;
};

async function patchExternalAccountBinding(
  client: ApiClient,
  publicKey: CryptoKey,
  keyID: string,
  hmacKey: string,
  newAccountUrl: string,
): Promise<void> {
  const hmac = await crypto.subtle.importKey(
    "raw",
    decodeBase64Url(hmacKey).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);

  const patchable = client as unknown as {
    createExternalAccountBinding(challenge: string, kid: string): Promise<{
      protected: string;
      payload: string;
      signature: string;
    }>;
  };
  patchable.createExternalAccountBinding = async () => {
    const protectedHeader = base64Url(
      new TextEncoder().encode(JSON.stringify({ alg: "HS256", kid: keyID, url: newAccountUrl })),
    );
    const payload = base64Url(new TextEncoder().encode(JSON.stringify(jwk)));
    const signature = await crypto.subtle.sign(
      "HMAC",
      hmac,
      new TextEncoder().encode(`${protectedHeader}.${payload}`),
    );
    return { protected: protectedHeader, payload, signature: base64Url(new Uint8Array(signature)) };
  };
}

// ACME servers (ZeroSSL in particular) can take tens of seconds per request and occasionally answer
// with an HTML gateway error instead of ACME JSON. Every step below is safe to repeat, so each one
// retries with exponential backoff instead of failing the whole issuance on one slow response.
const RETRY = {
  retries: { limit: 5, delay: "15 seconds", backoff: "exponential" },
  timeout: "5 minutes",
} as const;

interface Challenge {
  readonly authorizationUrl: string;
  readonly challengeUrl: string;
  readonly token: string;
  readonly key: string;
  readonly hostname: string;
}

const unquote = (value: string) => value.replace(/^"|"$/g, "");

export class CertificateWorkflow extends WorkflowEntrypoint<Cloudflare.Env, CertificateWorkflowParams> {
  private async update(tunnelID: string, certificateID: string, state: Certificate.State) {
    const updated = await env.TUNNELS.getByName(tunnelID).updateCertificate(certificateID, state);
    if (!updated) throw new Error("Failed to persist certificate state: tunnel or certificate not found");
  }

  /** Builds an ACME client. Without `accountId` it registers (or looks up) the account; with it, it skips that round trip. */
  private async createAcmeClient(accountId?: string) {
    if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) {
      throw new Error("CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are required");
    }

    const stored = JSON.parse(env.ACME_ACCOUNT_KEY_JWK) as JsonWebKey;
    if (
      stored.kty !== "EC" ||
      stored.crv !== "P-256" ||
      typeof stored.x !== "string" ||
      typeof stored.y !== "string" ||
      typeof stored.d !== "string"
    ) {
      throw new Error("ACME_ACCOUNT_KEY_JWK is not a P-256 private JWK");
    }
    const publicJwk: JsonWebKey = {
      kty: stored.kty,
      crv: stored.crv,
      x: stored.x,
      y: stored.y,
      ext: true,
      key_ops: ["verify"],
    };
    const accountKey: CryptoKeyPair = {
      privateKey: await crypto.subtle.importKey(
        "jwk",
        stored,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      ),
      publicKey: await crypto.subtle.importKey(
        "jwk",
        publicJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
      ),
    };

    const client = await ApiClient.create(accountKey, env.ACME_URL, { fetch, crypto });
    if (accountId) {
      (client as unknown as { accountId: string }).accountId = accountId;
    } else {
      // External account binding is required by ZeroSSL and ignored when unset (e.g. Let's Encrypt).
      const eab = env.ACME_EAB_KID && env.ACME_EAB_HMAC_KEY
        ? { kid: env.ACME_EAB_KID, challenge: env.ACME_EAB_HMAC_KEY }
        : undefined;
      if (eab) {
        const directory = await client.getDirectory();
        await patchExternalAccountBinding(client, accountKey.publicKey, eab.kid, eab.challenge, directory.newAccount);
      }
      await client.newAccount({
        contact: [`mailto:${env.ACME_EMAIL}`],
        termsOfServiceAgreed: true,
        ...(eab ? { externalAccountBinding: eab } : {}),
      });
    }

    const thumbprintJwk = await crypto.subtle.exportKey("jwk", accountKey.publicKey);
    const thumbprintHex = await new JoseJsonWebKey(crypto, thumbprintJwk).getThumbprint();
    const thumbprint = base64Url(
      Uint8Array.from(thumbprintHex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)),
    );
    return { client, thumbprint, accountId: (client as unknown as { accountId: string }).accountId };
  }

  private async cloudflare<A>(path: string, init: RequestInit = {}): Promise<A> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records${path}`,
      {
        ...init,
        headers: {
          authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
      },
    );
    const body = (await response.json()) as CloudflareResponse<A>;
    if (!response.ok || !body.success) {
      throw new Error(
        body.errors?.map((item) => item.message).filter(Boolean).join(", ") ||
          `Cloudflare DNS API request failed (${response.status})`,
      );
    }
    return body.result;
  }

  private findChallengeRecords(challenge: Pick<Challenge, "hostname" | "key">) {
    const name = `_acme-challenge.${challenge.hostname}`;
    return this.cloudflare<ReadonlyArray<{ id: string; content: string }>>(
      `?type=TXT&name=${encodeURIComponent(name)}&per_page=100`,
    ).then((records) => records.filter((record) => unquote(record.content) === challenge.key));
  }

  private async deleteChallengeRecords(challenges: ReadonlyArray<Challenge>) {
    let deleted = 0;
    for (const challenge of challenges) {
      for (const record of await this.findChallengeRecords(challenge)) {
        await this.cloudflare(`/${record.id}`, { method: "DELETE" });
        deleted++;
      }
    }
    return deleted;
  }

  async run(event: Readonly<WorkflowEvent<CertificateWorkflowParams>>, step: WorkflowStep) {
    const params = event.payload;
    let challenges: ReadonlyArray<Challenge> = [];
    try {
      const account = await step.do("register acme account", RETRY, async () => {
        const { accountId } = await this.createAcmeClient();
        return { accountId };
      });
      const acme = () => this.createAcmeClient(account.accountId);

      // A lost response here only leaves an unused pending order behind; a retry creates a fresh one.
      const order = await step.do("create acme order", RETRY, async () => {
        const { client } = await acme();
        const created = await client.newOrder({
          identifiers: params.identifiers.map((value) => ({ type: "dns", value })),
        });
        if (!created.content.finalize) throw new Error("ACME order has no finalize URL");
        const orderUrl = created.headers.location;
        if (!orderUrl) throw new Error("ACME order has no location URL");
        return {
          orderUrl,
          finalizeUrl: created.content.finalize,
          authorizations: [...created.content.authorizations],
        };
      });

      challenges = await step.do("read acme challenges", RETRY, async () => {
        const { client, thumbprint } = await acme();
        const result: Challenge[] = [];
        for (const authorizationUrl of order.authorizations) {
          const authorization = await client.getAuthorization(authorizationUrl);
          const challenge = authorization.content.challenges?.find((item) => item.type === "dns-01");
          if (!challenge) throw new Error("ACME server did not offer dns-01");
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(`${challenge.token}.${thumbprint}`),
          );
          result.push({
            authorizationUrl,
            challengeUrl: challenge.url,
            token: challenge.token,
            key: base64Url(new Uint8Array(digest)),
            hostname: authorization.content.identifier.value.replace(/^\*\./, ""),
          });
        }
        return result;
      });

      const firstChallenge = challenges[0]!;
      await step.do("record acme challenge", RETRY, async () => {
        await this.update(params.tunnelID, params.certificateID, {
          type: "challenge",
          token: firstChallenge.token,
          key: firstChallenge.key,
        });
        return { recorded: true };
      });

      // Reuses records left by an earlier attempt instead of creating duplicates.
      await step.do("create dns challenge records", RETRY, async () => {
        let created = 0;
        for (const challenge of challenges) {
          if ((await this.findChallengeRecords(challenge)).length > 0) continue;
          await this.cloudflare("", {
            method: "POST",
            body: JSON.stringify({
              type: "TXT",
              name: `_acme-challenge.${challenge.hostname}`,
              content: challenge.key,
              ttl: 60,
            }),
          });
          created++;
        }
        return { created };
      });

      await step.sleep("wait for dns propagation", "20 seconds");

      await step.do("trigger acme challenges", RETRY, async () => {
        const { client } = await acme();
        let triggered = 0;
        for (const { authorizationUrl, challengeUrl } of challenges) {
          const authorization = await client.getAuthorization(authorizationUrl);
          const current = authorization.content.challenges?.find((item) => item.url === challengeUrl);
          if (current && current.status !== "pending") continue;
          await client.getChallenge(challengeUrl, "POST");
          triggered++;
        }
        return { triggered };
      });

      let authorizationsValid = false;
      for (let attempt = 0; attempt < 24; attempt++) {
        const status = await step.do(`poll authorizations ${attempt}`, RETRY, async () => {
          const { client } = await acme();
          const statuses: string[] = [];
          for (const { authorizationUrl } of challenges) {
            const authorization = await client.getAuthorization(authorizationUrl);
            statuses.push(authorization.content.status);
          }
          return { statuses };
        });
        if (status.statuses.every((s) => s === "valid")) {
          authorizationsValid = true;
          break;
        }
        if (
          status.statuses.some(
            (s) => s === "invalid" || s === "deactivated" || s === "expired" || s === "revoked",
          )
        ) {
          throw new Error(`ACME authorization ended in ${status.statuses.join(",")}`);
        }
        await step.sleep(`wait authorization ${attempt}`, "5 seconds");
      }
      if (!authorizationsValid) throw new Error("ACME authorization timed out");

      // Checks the order first so a retry after a lost finalize response does not finalize twice.
      const finalized = await step.do("finalize acme order", RETRY, async () => {
        const { client } = await acme();
        const current = await client.getOrder(order.orderUrl);
        if (current.content.status === "ready") {
          await client.finalize(order.finalizeUrl, {
            csr: base64Url(Uint8Array.from(atob(pemBody(params.csr)), (c) => c.charCodeAt(0))),
          });
          return { status: "processing" };
        }
        return { status: current.content.status };
      });
      if (finalized.status !== "processing" && finalized.status !== "valid") {
        throw new Error(`ACME order is ${finalized.status} and cannot be finalized`);
      }

      let certificateUrl: string | undefined;
      for (let attempt = 0; attempt < 24; attempt++) {
        const orderStatus = await step.do(`poll order ${attempt}`, RETRY, async () => {
          const { client } = await acme();
          const current = await client.getOrder(order.orderUrl);
          return {
            status: current.content.status,
            certificate: current.content.certificate ?? null,
          };
        });
        if (orderStatus.status === "valid" && orderStatus.certificate) {
          certificateUrl = orderStatus.certificate;
          break;
        }
        if (orderStatus.status === "invalid") throw new Error("ACME order ended in invalid");
        await step.sleep(`wait order ${attempt}`, "3 seconds");
      }
      if (!certificateUrl) throw new Error("ACME order timed out waiting for certificate");

      const state = await step.do("store certificate", RETRY, async () => {
        const { client } = await acme();
        const response = await client.getCertificate(certificateUrl!);
        const certificates = response.content.map(toPem);
        const certificate = certificates[0];
        if (!certificate) throw new Error("ACME response did not contain a certificate");
        const chain = certificates.slice(1).join("\n");
        const expiry = new X509Certificate(certificate).notAfter.toISOString();
        const ready = { type: "ready", certificate, chain, expiry } as const;
        await this.update(params.tunnelID, params.certificateID, ready);
        return ready;
      });

      await step.do("cleanup dns challenge records", RETRY, async () => ({
        deleted: await this.deleteChallengeRecords(challenges),
      }));

      return state;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (challenges.length) {
        try {
          await step.do("cleanup dns after failure", RETRY, async () => ({
            deleted: await this.deleteChallengeRecords(challenges),
          }));
        } catch {
          // Leftover TXT records expire harmlessly; recording the failure matters more.
        }
      }
      await step.do("record certificate failure", RETRY, async () => {
        await this.update(params.tunnelID, params.certificateID, { type: "failed", reason });
        return { recorded: true };
      });
      return { state: "failed", reason };
    }
  }
}
