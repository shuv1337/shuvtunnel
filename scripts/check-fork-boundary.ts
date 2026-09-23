#!/usr/bin/env bun
// Enforces the identity contract in FORK.md: canonical ShuvTunnel names, the
// deliberately kept compatibility identifiers, and upstream attribution.
// `--dist` additionally inspects built output (run after `bun run --filter '*' build`).

import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures: string[] = [];
const fail = (message: string) => failures.push(message);
const read = (path: string) => readFileSync(join(root, path), "utf8");
const json = (path: string) => JSON.parse(read(path));
const jsonc = (path: string) =>
  JSON.parse(read(path).replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"));

const expectEqual = (label: string, actual: unknown, expected: unknown) => {
  if (actual !== expected) fail(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
};
const expectContains = (path: string, needle: string, why: string) => {
  if (!read(path).includes(needle)) fail(`${path}: missing ${JSON.stringify(needle)} (${why})`);
};

const REPOSITORY = "git+https://github.com/shuv1337/shuvtunnel.git";

// Canonical package, binary, and repository identity.
expectEqual("package.json name", json("package.json").name, "@shuvtunnel/root");
const cli = json("packages/cli/package.json");
expectEqual("packages/cli name", cli.name, "shuvtunnel");
expectEqual("packages/cli bin", JSON.stringify(cli.bin), JSON.stringify({ shuvtunnel: "dist/index.js" }));
expectEqual("packages/cli repository", cli.repository?.url, REPOSITORY);
for (const pkg of ["client", "protocol", "server", "website"]) {
  const manifest = json(`packages/${pkg}/package.json`);
  expectEqual(`packages/${pkg} name`, manifest.name, `@shuvtunnel/${pkg}`);
  if (manifest.repository) expectEqual(`packages/${pkg} repository`, manifest.repository.url, REPOSITORY);
}
for (const pkg of ["cli", "client", "protocol", "server"]) {
  expectEqual(`packages/${pkg} license`, json(`packages/${pkg}/package.json`).license, "MIT");
}

// Canonical runtime identity.
expectContains("packages/cli/src/index.ts", 'Command.make("shuvtunnel")', "CLI command name");
expectContains("packages/protocol/src/bridge-protocol.ts", 'WEBSOCKET_SUBPROTOCOL = "shuvtunnel"', "bridge subprotocol");
expectContains("packages/protocol/src/api/api.ts", 'HttpApi.make("shuvtunnel")', "HTTP API name");
expectContains("packages/client/src/effect/client.ts", '"https://shuv.zip"', "default API URL");
expectContains("packages/client/src/effect/storage.ts", '"shuvtunnel"', "XDG data directory");
expectContains("packages/cli/src/config.ts", '"shuvtunnel"', "XDG config directory");
expectContains("packages/website/src/wordmark.tsx", 'WORDMARK = "SHUVTUNNEL"', "website wordmark");

const server = jsonc("packages/server/wrangler.jsonc");
expectEqual("server SHUVTUNNEL_DOMAIN", server.vars?.SHUVTUNNEL_DOMAIN, "shuv.zip");
expectEqual("server API route", server.routes?.[0]?.pattern, "shuv.zip/api/*");

// Compatibility identifiers that must survive byte-for-byte (see FORK.md).
expectEqual("server Worker name (compatibility)", server.name, "opentunnel-shuv");
expectEqual(
  "certificate Workflow name (compatibility)",
  server.workflows?.find((workflow: { binding: string }) => workflow.binding === "CERTIFICATES")?.name,
  "opentunnel-shuv-certificates",
);

// Provenance.
expectContains("FORK.md", "https://github.com/anomalyco/opentunnel", "upstream attribution");
expectContains("FORK.md", "MIT", "license attribution");
expectContains("README.md", "https://github.com/anomalyco/opentunnel", "upstream attribution");
expectContains("packages/cli/CHANGELOG.md", "aac6b95", "upstream release history");

// Retired branding: every remaining match must be an accounted-for exception.
const retired = /open[-_ ]?tunnel|anomalyco/i;
const allowed: ReadonlyArray<readonly [RegExp, RegExp]> = [
  [/^FORK\.md$/, /./],
  [/^AGENTS\.md$/, /anomalyco\/opentunnel|`opentunnel-shuv(-certificates)?`/],
  [/^scripts\/check-fork-boundary\.ts$/, /./],
  [/^README\.md$/, /anomalyco\/opentunnel|upstream OpenTunnel|`opentunnel-shuv(-certificates)?`/],
  [/^packages\/cli\/CHANGELOG\.md$/, /Open Tunnel CLI/],
  [/^packages\/server\/wrangler\.jsonc$/, /"opentunnel-shuv(-certificates)?"/],
];
const tracked = (await $`git ls-files -z --cached --others --exclude-standard`.cwd(root).text())
  .split("\0")
  .filter((path) => path && existsSync(join(root, path)));
for (const path of tracked) {
  const buffer = readFileSync(join(root, path));
  if (buffer.includes(0)) continue;
  const lines = buffer.toString("utf8").split("\n");
  lines.forEach((line, index) => {
    if (!retired.test(line)) return;
    if (allowed.some(([file, pattern]) => file.test(path) && pattern.test(line))) return;
    fail(`${path}:${index + 1}: retired upstream identity: ${line.trim()}`);
  });
}

if (process.argv.includes("--dist")) {
  const bundle = "packages/cli/dist/index.js";
  if (!existsSync(join(root, bundle))) fail(`${bundle}: missing; build the CLI first`);
  else {
    const text = read(bundle);
    if (retired.test(text)) fail(`${bundle}: distributable exposes retired upstream identity`);
    for (const needle of ['"shuvtunnel"', "https://shuv.zip"]) {
      if (!text.includes(needle)) fail(`${bundle}: missing ${needle}`);
    }
  }
  const site = "packages/website/dist/index.html";
  if (!existsSync(join(root, site))) fail(`${site}: missing; build the website first`);
  else {
    const text = read(site);
    if (retired.test(text)) fail(`${site}: distributable exposes retired upstream identity`);
    if (!text.includes("<title>shuvtunnel")) fail(`${site}: title is not shuvtunnel`);
  }
}

if (failures.length) {
  console.error(`Fork boundary check failed (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`Fork boundary check passed${process.argv.includes("--dist") ? " (including dist)" : ""}.`);
