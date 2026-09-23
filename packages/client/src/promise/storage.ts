import { Effect } from "effect";
import {
  ShuvTunnelStorage as EffectStorage,
  type ShuvTunnelStorage as EffectStorageType,
} from "../effect/storage.js";
import type {
  ShuvTunnelIdentity,
  ShuvTunnelPendingIdentity,
  ShuvTunnelStoredTunnel,
} from "../effect/types.js";

const EffectStorageSymbol = Symbol.for("@shuvtunnel/client/EffectStorage");

export interface ShuvTunnelStorage {
  readonly profiles: () => Promise<ReadonlyArray<string>>;
  readonly load: (profile: string) => Promise<ShuvTunnelIdentity | undefined>;
  readonly save: (profile: string, tunnel: ShuvTunnelIdentity) => Promise<void>;
  readonly loadPending: (profile: string) => Promise<ShuvTunnelPendingIdentity | undefined>;
  readonly savePending: (profile: string, tunnel: ShuvTunnelPendingIdentity) => Promise<void>;
  readonly remove: (profile: string) => Promise<void>;
  readonly list: () => Promise<ReadonlyArray<ShuvTunnelStoredTunnel>>;
}

type WrappedStorage = ShuvTunnelStorage & { readonly [EffectStorageSymbol]: EffectStorageType };

const wrap = (storage: EffectStorageType): WrappedStorage => ({
  [EffectStorageSymbol]: storage,
  profiles: () => Effect.runPromise(storage.profiles()),
  load: (profile) => Effect.runPromise(storage.load(profile)),
  save: (profile, tunnel) => Effect.runPromise(storage.save(profile, tunnel)),
  loadPending: (profile) => Effect.runPromise(storage.loadPending(profile)),
  savePending: (profile, tunnel) => Effect.runPromise(storage.savePending(profile, tunnel)),
  remove: (profile) => Effect.runPromise(storage.remove(profile)),
  list: () => Effect.runPromise(storage.list()),
});

export const ShuvTunnelStorage = {
  memory: (): ShuvTunnelStorage => wrap(EffectStorage.memory()),
  xdg: (options?: { readonly env?: NodeJS.ProcessEnv; readonly home?: string }): ShuvTunnelStorage =>
    wrap(EffectStorage.xdg(options)),
};

export function toEffectStorage(storage: ShuvTunnelStorage): EffectStorageType {
  if (EffectStorageSymbol in storage) return (storage as WrappedStorage)[EffectStorageSymbol];
  return {
    profiles: () => Effect.tryPromise(() => storage.profiles()),
    load: (profile) => Effect.tryPromise(() => storage.load(profile)),
    save: (profile, tunnel) => Effect.tryPromise(() => storage.save(profile, tunnel)),
    loadPending: (profile) => Effect.tryPromise(() => storage.loadPending(profile)),
    savePending: (profile, tunnel) => Effect.tryPromise(() => storage.savePending(profile, tunnel)),
    remove: (profile) => Effect.tryPromise(() => storage.remove(profile)),
    list: () => Effect.tryPromise(() => storage.list()),
  };
}
