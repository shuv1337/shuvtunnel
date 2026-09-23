import { Effect, Exit, ManagedRuntime, Scope, Stream } from "effect";
import {
  ShuvTunnelClient,
  type ShuvTunnelClientOptions as EffectClientOptions,
} from "../effect/client.js";
import type {
  ShuvTunnelClientEvent,
  ShuvTunnelIdentity,
  ShuvTunnelPendingIdentity,
  ShuvTunnelProfileOptions,
  ShuvTunnelProvisionStage,
  ShuvTunnelRoute,
  ShuvTunnelStoredTunnel,
} from "../effect/types.js";
import { toEffectStorage, type ShuvTunnelStorage } from "./storage.js";

export interface ShuvTunnelClientOptions {
  readonly api?: URL | string;
  readonly store?: ShuvTunnelStorage;
}

export interface ShuvTunnelConnection {
  readonly tunnel: ShuvTunnelIdentity;
  readonly routes: ReadonlyArray<ShuvTunnelRoute>;
  readonly events: AsyncIterable<ShuvTunnelClientEvent>;
  readonly closed: Promise<void>;
  readonly close: () => Promise<void>;
}

export interface ShuvTunnelPromiseClient {
  readonly profile: {
    readonly list: () => Promise<ReadonlyArray<string>>;
  };
  readonly route: {
    readonly list: (options?: ShuvTunnelProfileOptions) => Promise<ReadonlyArray<ShuvTunnelRoute>>;
    readonly add: (
      options: ShuvTunnelProfileOptions & { readonly name: string; readonly target: string },
    ) => Promise<ShuvTunnelRoute>;
    readonly remove: (
      options: ShuvTunnelProfileOptions & { readonly name: string },
    ) => Promise<void>;
  };
  readonly tunnel: {
    readonly list: () => Promise<ReadonlyArray<ShuvTunnelStoredTunnel>>;
    readonly get: (options?: ShuvTunnelProfileOptions) => Promise<ShuvTunnelIdentity | undefined>;
    readonly pending: (
      options?: ShuvTunnelProfileOptions,
    ) => Promise<Pick<ShuvTunnelPendingIdentity, "id" | "hostname"> | undefined>;
    readonly resume: (
      options?: ShuvTunnelProfileOptions & {
        readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
      },
    ) => Promise<ShuvTunnelIdentity | undefined>;
    readonly create: (
      options?: ShuvTunnelProfileOptions & {
        readonly name?: string;
        readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
      },
    ) => Promise<ShuvTunnelIdentity>;
    readonly ensure: (
      options?: ShuvTunnelProfileOptions & { readonly name?: string },
    ) => Promise<ShuvTunnelIdentity>;
    readonly remove: (options?: ShuvTunnelProfileOptions) => Promise<void>;
    readonly connect: (
      options?: ShuvTunnelProfileOptions & { readonly signal?: AbortSignal },
    ) => Promise<ShuvTunnelConnection>;
  };
  readonly dispose: () => Promise<void>;
}

export function create(options: ShuvTunnelClientOptions = {}): ShuvTunnelPromiseClient {
  const effectOptions: EffectClientOptions = {
    api: options.api,
    ...(options.store ? { storage: toEffectStorage(options.store) } : {}),
  };
  const runtime = ManagedRuntime.make(ShuvTunnelClient.layer(effectOptions));
  const withClient = <A, E>(
    f: (client: ShuvTunnelClient["Service"]) => Effect.Effect<A, E>,
  ) => runtime.runPromise(Effect.flatMap(ShuvTunnelClient.asEffect(), f));

  return {
    profile: { list: () => withClient((client) => client.profile.list()) },
    route: {
      list: (input) => withClient((client) => client.route.list(input)),
      add: (input) => withClient((client) => client.route.add(input)),
      remove: (input) => withClient((client) => client.route.remove(input)),
    },
    tunnel: {
      list: () => withClient((client) => client.tunnel.list()),
      get: (input) => withClient((client) => client.tunnel.get(input)),
      pending: (input) => withClient((client) => client.tunnel.pending(input)),
      resume: (input) => withClient((client) => client.tunnel.resume(input)),
      create: (input) => withClient((client) => client.tunnel.create(input)),
      ensure: (input) => withClient((client) => client.tunnel.ensure(input)),
      remove: (input) => withClient((client) => client.tunnel.remove(input)),
      connect: async (input) => {
        const scope = await runtime.runPromise(Scope.make());
        const connection = await runtime.runPromise(
          Effect.flatMap(ShuvTunnelClient.asEffect(), (client) => client.tunnel.connect(input)).pipe(
            Effect.provideService(Scope.Scope, scope),
          ),
        );
        const closeScope = () => runtime.runPromise(Scope.close(scope, Exit.succeed(undefined)));
        return {
          tunnel: connection.tunnel,
          routes: connection.routes,
          events: Stream.toAsyncIterable(connection.events),
          closed: runtime.runPromise(connection.closed).finally(closeScope),
          close: () => runtime.runPromise(connection.close).finally(closeScope),
        };
      },
    },
    dispose: () => runtime.dispose(),
  };
}
