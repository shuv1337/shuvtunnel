import "reflect-metadata";
import { Effect, Layer, ServiceMap } from "effect";
import {
  Pkcs10CertificateRequestGenerator,
  SubjectAlternativeNameExtension,
} from "@peculiar/x509";
import { CSR } from "@shuvtunnel/protocol/csr";
import { Tunnel } from "@shuvtunnel/protocol/tunnel";
import { ShuvTunnelApiClient } from "./api.js";
import { ShuvTunnelClientError } from "./errors.js";
import { ShuvTunnelStorage, type ShuvTunnelStorage as Storage } from "./storage.js";
import type {
  ShuvTunnelEffectClient,
  ShuvTunnelIdentity,
  ShuvTunnelPendingIdentity,
  ShuvTunnelProfileOptions,
  ShuvTunnelProvisionStage,
  ShuvTunnelRoute,
} from "./types.js";
import { connectBridge } from "./bridge.js";

const profileName = (options?: ShuvTunnelProfileOptions) => options?.profile ?? "default";
const clientError = (message: string, cause: unknown) =>
  new ShuvTunnelClientError({ message, cause });

const privateKeyPem = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const body = btoa(binary);
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END PRIVATE KEY-----\n`;
};

export interface ShuvTunnelClientOptions {
  readonly api?: URL | string;
  readonly storage?: Storage;
}

export class ShuvTunnelClient extends ServiceMap.Service<
  ShuvTunnelClient,
  ShuvTunnelEffectClient
>()("@shuvtunnel/client/ShuvTunnelClient") {
  static layer(options: ShuvTunnelClientOptions = {}) {
    const storage = options.storage ?? ShuvTunnelStorage.xdg();
    return Layer.effect(
      ShuvTunnelClient,
      Effect.gen(function* () {
        const api = yield* ShuvTunnelApiClient;
        const routesByProfile = new Map<string, ReadonlyArray<ShuvTunnelRoute>>();

        const get = Effect.fn("ShuvTunnelClient.tunnel.get")(function* (
          input?: ShuvTunnelProfileOptions,
        ) {
          return yield* storage.load(profileName(input));
        });

        const completePending = Effect.fn("ShuvTunnelClient.tunnel.completePending")(function* (options: {
          readonly profile: string;
          readonly pending: ShuvTunnelPendingIdentity;
          readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
        }) {
          const authorized = yield* api.authorized(Tunnel.Token.makeUnsafe(options.pending.token));
          yield* Effect.sync(() => options.onProgress?.("requesting-certificate"));
          yield* authorized.tunnel["tunnel.bindCertificate"]({
            params: { id: Tunnel.ID.makeUnsafe(options.pending.id) },
            payload: { csr: options.pending.csr as CSR.Raw },
          }).pipe(
            Effect.mapError((cause) => clientError("Failed to start certificate issuance", cause)),
          );

          const certificate = yield* Effect.gen(function* () {
            while (true) {
              yield* Effect.sync(() => options.onProgress?.("waiting-certificate"));
              const value = yield* authorized.tunnel["tunnel.getCertificate"]({
                params: { id: Tunnel.ID.makeUnsafe(options.pending.id) },
              }).pipe(
                Effect.mapError((cause) => clientError("Failed to read certificate", cause)),
              );
              if (value.state.type === "ready") return value.state;
              if (value.state.type === "failed") {
                return yield* new ShuvTunnelClientError({
                  message: `Certificate issuance failed: ${value.state.reason}`,
                });
              }
              yield* Effect.sleep("2 seconds");
            }
          });
          const identity: ShuvTunnelIdentity = {
            id: options.pending.id,
            hostname: options.pending.hostname,
            token: options.pending.token,
            privateKey: options.pending.privateKey,
            certificate: certificate.certificate,
            chain: certificate.chain,
            certificateExpiry: new Date(certificate.expiry),
          };
          yield* Effect.sync(() => options.onProgress?.("saving-identity"));
          yield* storage.save(options.profile, identity);
          yield* Effect.sync(() => options.onProgress?.("ready"));
          return identity;
        });

        const provision = Effect.fn("ShuvTunnelClient.tunnel.provision")(function* (options: {
          readonly profile: string;
          readonly id: Tunnel.ID;
          readonly hostname: string;
          readonly token: Tunnel.Token;
          readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
        }) {
          yield* Effect.sync(() => options.onProgress?.("generating-key"));
          const keys = yield* Effect.tryPromise({
            try: () =>
              crypto.subtle.generateKey(
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign", "verify"],
              ) as Promise<CryptoKeyPair>,
            catch: (cause) => clientError("Failed to generate certificate key", cause),
          });
          yield* Effect.sync(() => options.onProgress?.("generating-csr"));
          const csr = yield* Effect.tryPromise({
            try: () =>
              Pkcs10CertificateRequestGenerator.create({
                name: `CN=${options.hostname}`,
                extensions: [
                  new SubjectAlternativeNameExtension([
                    { type: "dns", value: options.hostname },
                    { type: "dns", value: `*.${options.hostname}` },
                  ]),
                ],
                signingAlgorithm: { name: "ECDSA", hash: "SHA-256" },
                keys,
              }),
            catch: (cause) => clientError("Failed to generate certificate request", cause),
          });
          const exported = yield* Effect.tryPromise({
            try: () => crypto.subtle.exportKey("pkcs8", keys.privateKey),
            catch: (cause) => clientError("Failed to export certificate key", cause),
          });
          const pending: ShuvTunnelPendingIdentity = {
            id: String(options.id),
            hostname: options.hostname,
            token: options.token,
            privateKey: privateKeyPem(exported),
            csr: csr.toString(),
          };
          yield* storage.savePending(options.profile, pending);
          return yield* completePending({
            profile: options.profile,
            pending,
            onProgress: options.onProgress,
          });
        });

        const create = Effect.fn("ShuvTunnelClient.tunnel.create")(function* (
          input?: ShuvTunnelProfileOptions & {
            readonly name?: string;
            readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
          },
        ) {
          const profile = profileName(input);
          if (yield* storage.load(profile)) {
            return yield* new ShuvTunnelClientError({
              message: `Profile '${profile}' already has a tunnel`,
            });
          }

          const pending = yield* storage.loadPending(profile);
          if (pending) {
            yield* Effect.sync(() => input?.onProgress?.("resuming-certificate"));
            return yield* completePending({ profile, pending, onProgress: input?.onProgress });
          }

          yield* Effect.sync(() => input?.onProgress?.("creating-tunnel"));
          const created = yield* api.client.tunnel["tunnel.create"]({
            payload: { name: input?.name },
          }).pipe(Effect.mapError((cause) => clientError("Failed to create tunnel", cause)));
          return yield* provision({
            profile,
            id: created.tunnel.id,
            hostname: String(created.tunnel.hostname),
            token: created.token,
            onProgress: input?.onProgress,
          });
        });

        const ensure = Effect.fn("ShuvTunnelClient.tunnel.ensure")(function* (
          input?: ShuvTunnelProfileOptions & { readonly name?: string },
        ) {
          const existing = yield* get(input);
          if (!existing) return yield* create(input);
          const authorized = yield* api.authorized(Tunnel.Token.makeUnsafe(existing.token));
          const certificate = yield* authorized.tunnel["tunnel.getCertificate"]({
            params: { id: Tunnel.ID.makeUnsafe(existing.id) },
          }).pipe(
            Effect.mapError((cause) => clientError("Failed to read certificate", cause)),
          );
          if (certificate.state.type !== "failed") return existing;
          return yield* provision({
            profile: profileName(input),
            id: Tunnel.ID.makeUnsafe(existing.id),
            hostname: existing.hostname,
            token: Tunnel.Token.makeUnsafe(existing.token),
          });
        });

        const pending = Effect.fn("ShuvTunnelClient.tunnel.pending")(function* (
          input?: ShuvTunnelProfileOptions,
        ) {
          const value = yield* storage.loadPending(profileName(input));
          return value ? { id: value.id, hostname: value.hostname } : undefined;
        });

        const resume = Effect.fn("ShuvTunnelClient.tunnel.resume")(function* (
          input?: ShuvTunnelProfileOptions & {
            readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
          },
        ) {
          const profile = profileName(input);
          const value = yield* storage.loadPending(profile);
          if (!value) return undefined;
          yield* Effect.sync(() => input?.onProgress?.("resuming-certificate"));
          return yield* completePending({ profile, pending: value, onProgress: input?.onProgress });
        });

        const listRoutes = Effect.fn("ShuvTunnelClient.route.list")(function* (
          input?: ShuvTunnelProfileOptions,
        ) {
          const profile = profileName(input);
          const identity = yield* storage.load(profile);
          const routes = routesByProfile.get(profile) ?? [];
          return routes.map((route) => ({
            ...route,
            hostname: identity ? `${route.name}.${identity.hostname}` : route.name,
          }));
        });

        const client: ShuvTunnelEffectClient = {
          profile: { list: storage.profiles },
          route: {
            list: listRoutes,
            add: Effect.fn("ShuvTunnelClient.route.add")(function* (input) {
              const profile = profileName(input);
              const identity = yield* ensure(input);
              const routes = routesByProfile.get(profile) ?? [];
              if (routes.some((route) => route.name === input.name)) {
                return yield* new ShuvTunnelClientError({
                  message: `Route '${input.name}' already exists in profile '${profile}'`,
                });
              }
              if (input.target.includes("://")) {
                return yield* new ShuvTunnelClientError({
                  message: "Route targets must use host:port",
                });
              }
              const target = new URL(`tcp://${input.target}`);
              if (!target.hostname || !target.port) {
                return yield* new ShuvTunnelClientError({ message: "Route targets must use host:port" });
              }
              const route: ShuvTunnelRoute = {
                name: input.name,
                hostname: `${input.name}.${identity.hostname}`,
                target: input.target,
              };
              routesByProfile.set(profile, [...routes, route]);
              return route;
            }),
            remove: Effect.fn("ShuvTunnelClient.route.remove")(function* (input) {
              const profile = profileName(input);
              const routes = routesByProfile.get(profile) ?? [];
              routesByProfile.set(
                profile,
                routes.filter((route) => route.name !== input.name),
              );
            }),
          },
          tunnel: {
            list: storage.list,
            get,
            pending,
            resume,
            create,
            ensure,
            remove: Effect.fn("ShuvTunnelClient.tunnel.remove")(function* (input) {
              const profile = profileName(input);
              // A tunnel whose certificate never completed has only a pending identity but still exists on the server.
              const identity = (yield* storage.load(profile)) ?? (yield* storage.loadPending(profile));
              if (!identity) return;
              const authorized = yield* api.authorized(Tunnel.Token.makeUnsafe(identity.token));
              yield* authorized.tunnel["tunnel.remove"]({
                params: { id: Tunnel.ID.makeUnsafe(identity.id) },
              }).pipe(
                Effect.catchTag("TunnelNotFoundError", () => Effect.void),
                Effect.mapError((cause) => clientError("Failed to remove tunnel", cause)),
              );
              yield* storage.remove(profile);
            }),
            connect: (input) =>
              Effect.gen(function* () {
                const profile = profileName(input);
                const identity = yield* ensure(input);
                const configured = routesByProfile.get(profile) ?? [];
                return yield* connectBridge({
                  api: new URL(options.api ?? "https://shuv.zip"),
                  identity,
                  routes: configured,
                });
              }),
          },
        };
        return client;
      }),
    ).pipe(
      Layer.provide(ShuvTunnelApiClient.layer({ api: options.api ?? "https://shuv.zip" })),
    );
  }
}
