#!/usr/bin/env bun
// Enforces FORK.md across source, native packaging and the unified Worker build.
import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures: string[] = [];
const read = (path: string) => readFileSync(join(root, path), "utf8");
const json = (path: string) => JSON.parse(read(path));
const toml = (path: string): any => Bun.TOML.parse(read(path));
const equal = (label: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
};
const contains = (path: string, value: string) => {
  if (!read(path).includes(value)) failures.push(`${path}: missing ${JSON.stringify(value)}`);
};
const repository = "git+https://github.com/shuv1337/shuvtunnel.git";
equal("root name", json("package.json").name, "@shuvtunnel/root");
const cli = json("packages/cli/package.json");
equal("CLI name", cli.name, "shuvtunnel");
equal("CLI bin", cli.bin, { shuvtunnel: "./bin/shuvtunnel.cjs" });
equal("CLI repository", cli.repository?.url, repository);
for (const pkg of ["client", "protocol", "server", "website"]) {
  const manifest = json(`packages/${pkg}/package.json`);
  equal(`${pkg} name`, manifest.name, `@shuvtunnel/${pkg}`);
  if (manifest.repository) equal(`${pkg} repository`, manifest.repository.url, repository);
  if (["client", "protocol"].includes(pkg)) equal(`${pkg} public`, manifest.private ?? false, false);
}
for (const pkg of ["cli", "client", "protocol", "server"]) equal(`${pkg} license`, json(`packages/${pkg}/package.json`).license, "MIT");
const cargo = toml("Cargo.toml");
equal("Cargo version", cargo.workspace.package.version, cli.version);
equal("Cargo repository", cargo.workspace.package.repository, "https://github.com/shuv1337/shuvtunnel");
for (const name of ["shuvtunnel", "shuvtunnel-cli"]) {
  equal(`${name} crate`, toml(`crates/${name}/Cargo.toml`).package.name, name);
  contains("Cargo.lock", `name = "${name}"\nversion = "${cli.version}"`);
}
equal("native binary", toml("crates/shuvtunnel-cli/Cargo.toml").bin[0].name, "shuvtunnel");
equal("Rust library dependency", toml("crates/shuvtunnel-cli/Cargo.toml").dependencies.shuvtunnel.version, cli.version);
contains("packages/cli/bin/shuvtunnel.cjs", '"@shuvtunnel/cli-"');
contains("packages/cli/script/publish.ts", 'bin: { shuvtunnel: "bin/shuvtunnel" }');
contains("packages/cli/script/release.ts", 'const repo = "shuv1337/shuvtunnel"');
contains("packages/cli/script/release.ts", "shuv1337/homebrew-tap.git");
contains("packages/cli/script/release.ts", "aur.archlinux.org/shuvtunnel-bin.git");
contains("packages/protocol/src/bridge-protocol.ts", 'WEBSOCKET_SUBPROTOCOL = "shuvtunnel"');
contains("crates/shuvtunnel/src/protocol/bridge.rs", '"shuvtunnel"');
contains("packages/protocol/src/api/api.ts", 'HttpApi.make("shuvtunnel")');
contains("packages/client/src/effect/client.ts", '"https://shuv.zip"');
contains("crates/shuvtunnel/src/protocol/api.rs", '"https://shuv.zip"');
contains("packages/client/src/effect/storage.ts", '"shuvtunnel"');
contains("crates/shuvtunnel/src/paths.rs", '"shuvtunnel"');
contains("packages/website/src/wordmark.tsx", 'WORDMARK = "SHUVTUNNEL"');
contains("cloudflare.config.ts", 'production ? "opentunnel-shuv" : `shuvtunnel-${mode}`');
contains("cloudflare.config.ts", 'production ? "opentunnel-shuv-certificates" : `shuvtunnel-certificates-${mode}`');
contains("cloudflare.config.ts", 'production ? "shuv.zip" : `${mode}.shuv.zip`');
contains("cloudflare.config.ts", "SHUVTUNNEL_DOMAIN: bindings.text(domain)");
contains("cloudflare.config.ts", 'pattern: "shuv.zip/*", zone: "shuv.zip"');
contains("cloudflare.config.ts", '"c3873d6934c4d42ed652225530ad9cd6"');
contains("package.json", "CLOUDFLARE_ACCOUNT_ID=771240435fb4f1407f2b4669085dc79d");
contains(".github/workflows/publish.yml", "github.repository == 'shuv1337/shuvtunnel' && vars.SHUVTUNNEL_NPM_PUBLISH == 'true'");
contains(".github/workflows/deploy.yml", "github.repository == 'shuv1337/shuvtunnel' && vars.SHUVTUNNEL_DEPLOY_WEBSITE == 'true'");
for (const path of ["FORK.md", "README.md", "packages/website/src/App.tsx"]) contains(path, "https://github.com/anomalyco/opentunnel");
contains("packages/cli/CHANGELOG.md", "aa5e197");
contains("packages/cli/CHANGELOG.md", "aac6b95");
contains("packages/website/src/App.tsx", 'className="fork-note"');
contains("packages/website/src/App.tsx", 'id="credits"');
contains("packages/website/src/App.tsx", '<a href={upstream} target="_blank" rel="noopener">opentunnel</a>');
contains("index.html", "slopfork of opentunnel.");

const retired = /open[-_ ]?tunnel|anomalyco/i;
const allowed: ReadonlyArray<readonly [RegExp, RegExp]> = [
  [/^FORK\.md$/, /./],
  [/^scripts\/check-fork-boundary\.ts$/, /./],
  [/^AGENTS\.md$/, /anomalyco\/opentunnel|`opentunnel-shuv(-certificates)?`/],
  [/^README\.md$/, /anomalyco\/opentunnel/],
  [/^cloudflare\.config\.ts$/, /production \? "opentunnel-shuv(-certificates)?"/],
  [/^packages\/cli\/CHANGELOG\.md$/, /Open Tunnel CLI/],
  [/^index\.html$/, /slopfork of opentunnel\./],
  [/^packages\/website\/src\/App\.tsx$/, /"https:\/\/github\.com\/anomalyco\/opentunnel"|>opentunnel<\/a>/],
];
const paths = (await $`git ls-files -z --cached --others --exclude-standard`.cwd(root).text()).split("\0");
for (const path of new Set(paths.filter(path => path && existsSync(join(root, path))))) {
  const bytes = readFileSync(join(root, path));
  if (bytes.includes(0)) continue;
  bytes.toString("utf8").split("\n").forEach((line, i) => {
    if (retired.test(line) && !allowed.some(([file, pattern]) => file.test(path) && pattern.test(line))) {
      failures.push(`${path}:${i + 1}: retired identity: ${line.trim()}`);
    }
  });
}

if (process.argv.includes("--dist")) {
  const workerPath = ".cloudflare/output/v0/workers/default/worker.config.json";
  if (!existsSync(join(root, workerPath))) failures.push(`${workerPath}: missing; build the Worker first`);
  else {
    const worker = json(workerPath);
    equal("built production Worker", worker.name, "opentunnel-shuv");
    equal("built Workflow", worker.env?.CERTIFICATES?.name, "opentunnel-shuv-certificates");
    equal("built DO owner", worker.env?.TUNNELS?.worker, "opentunnel-shuv");
    equal("built domain", worker.env?.SHUVTUNNEL_DOMAIN?.value, "shuv.zip");
    equal("built route", worker.triggers, [{ type: "fetch", pattern: "shuv.zip/*", zone: "shuv.zip" }]);
  }
  const site = ".cloudflare/output/v0/workers/default/assets/index.html";
  if (!existsSync(join(root, site))) failures.push(`${site}: missing; build the website first`);
  else {
    contains(site, "<title>shuvtunnel");
    contains(site, "slopfork of opentunnel.");
    if (retired.test(read(site).replaceAll("slopfork of opentunnel.", ""))) failures.push(`${site}: retired identity`);
  }
  // Binary packaging is a separate CI job; validate generated packages when present.
  for (const path of new Bun.Glob("packages/cli/dist/*/package.json").scanSync({ cwd: root })) {
    const manifest = json(path);
    if (manifest.name !== "shuvtunnel" && !/^@shuvtunnel\/cli-(linux|darwin)-(x64|arm64)$/.test(manifest.name)) failures.push(`${path}: unexpected package name`);
    equal(`${path} version`, manifest.version, cli.version);
    if (retired.test(read(path))) failures.push(`${path}: retired identity`);
  }
}
if (failures.length) {
  console.error(`Fork boundary check failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Fork boundary check passed${process.argv.includes("--dist") ? " (including dist)" : ""}.`);
