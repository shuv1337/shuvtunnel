#!/usr/bin/env bun
// Publishes the shuvtunnel library and the shuvtunnel-cli crate to crates.io at the version the release
// carries (script/version.ts keeps it equal to the npm version). Versions already on crates.io are skipped,
// so a rerun only publishes what is missing. Skipped when CARGO_REGISTRY_TOKEN is missing.

import { $ } from "bun"
import pkg from "../package.json"

const version = pkg.version
const root = new URL("../../../", import.meta.url).pathname

if (!process.env.CARGO_REGISTRY_TOKEN) {
  console.warn("CARGO_REGISTRY_TOKEN is not set; skipping crates.io")
  process.exit(0)
}

// The library first: the CLI depends on it at the same version.
for (const crate of ["shuvtunnel", "shuvtunnel-cli"]) {
  const response = await fetch(`https://crates.io/api/v1/crates/${crate}/${version}`, {
    headers: { "user-agent": "shuvtunnel-release (github.com/shuv1337/shuvtunnel)" },
  })
  if (response.ok) {
    console.log(`already published ${crate}@${version}`)
    continue
  }
  await $`cargo publish --locked -p ${crate}`.cwd(root)
}
