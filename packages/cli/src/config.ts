import { Effect, Schema } from "effect";
import * as Fs from "node:fs/promises";
import * as Os from "node:os";
import * as Path from "node:path";
import { parse, stringify } from "smol-toml";

export class ShuvTunnelCliConfigError extends Schema.TaggedErrorClass<ShuvTunnelCliConfigError>()(
  "ShuvTunnelCliConfigError",
  { message: Schema.String, cause: Schema.optional(Schema.Defect) },
) {}

export interface ShuvTunnelCliConfig {
  readonly routes: Readonly<Record<string, string>>;
}

const profilePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function shuvTunnelConfigPath(profile: string): Effect.Effect<string, ShuvTunnelCliConfigError> {
  if (!profilePattern.test(profile)) {
    return Effect.gen(function* () {
      return yield* new ShuvTunnelCliConfigError({
        message: "Profile names must contain only lowercase letters, numbers, and hyphens",
      });
    });
  }
  return Effect.succeed(
    Path.join(
      process.env.XDG_CONFIG_HOME ?? Path.join(Os.homedir(), ".config"),
      "shuvtunnel",
      `${profile}.toml`,
    ),
  );
}

export const loadShuvTunnelConfig = Effect.fn("ShuvTunnelCliConfig.load")(function* (
  profile: string,
) {
  const path = yield* shuvTunnelConfigPath(profile);
  const content = yield* Effect.tryPromise({
    try: () => Fs.readFile(path, "utf8"),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((cause: unknown) => Effect.gen(function* () {
      if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT") {
        return undefined;
      }
      return yield* new ShuvTunnelCliConfigError({ message: `Failed to read ${path}`, cause });
    })),
  );
  if (!content) return { routes: {} } satisfies ShuvTunnelCliConfig;
  const document = yield* Effect.try({
    try: () => parse(content) as { routes?: Record<string, unknown> },
    catch: (cause) => new ShuvTunnelCliConfigError({ message: `Failed to parse ${path}`, cause }),
  });
  const routes: Record<string, string> = {};
  for (const [name, target] of Object.entries(document.routes ?? {})) {
    if (typeof target === "string") routes[name] = target;
  }
  return { routes } satisfies ShuvTunnelCliConfig;
});

export const saveShuvTunnelConfig = Effect.fn("ShuvTunnelCliConfig.save")(function* (
  profile: string,
  config: ShuvTunnelCliConfig,
) {
  const path = yield* shuvTunnelConfigPath(profile);
  yield* Effect.tryPromise({
    try: async () => {
      await Fs.mkdir(Path.dirname(path), { recursive: true });
      await Fs.writeFile(path, stringify({ routes: config.routes }), { mode: 0o644 });
    },
    catch: (cause) => new ShuvTunnelCliConfigError({ message: `Failed to write ${path}`, cause }),
  });
});
