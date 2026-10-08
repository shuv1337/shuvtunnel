#!/usr/bin/env bun
// Publishes the CLI binaries outside npm: a GitHub release with one tarball per
// platform (also used by the install script), the Homebrew formula in
// shuv1337/homebrew-tap, and the shuvtunnel-bin AUR package. Each step is
// skipped when its credentials are missing.

import { $ } from "bun"
import { fileURLToPath } from "url"
import pkg from "../package.json"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const version = pkg.version
const tag = `v${version}`
const repo = "shuv1337/shuvtunnel"
const description = "Public URLs for local services, end-to-end encrypted"
const download = (platform: string) =>
  `https://github.com/${repo}/releases/download/${tag}/shuvtunnel-${platform}.tar.gz`

const platforms = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"]
const sha: Record<string, string> = {}
for (const platform of platforms) {
  const tarball = `./dist/shuvtunnel-${platform}.tar.gz`
  await $`chmod 755 ./dist/cli-${platform}/bin/shuvtunnel`
  await $`tar -czf ${tarball} -C ./dist/cli-${platform}/bin shuvtunnel`
  sha[platform] = new Bun.CryptoHasher("sha256").update(await Bun.file(tarball).arrayBuffer()).digest("hex")
}

// GitHub release
if (process.env.GH_TOKEN) {
  if ((await $`gh release view ${tag} --repo ${repo}`.nothrow().quiet()).exitCode === 0) {
    console.log(`release ${tag} already exists`)
  } else {
    const tarballs = platforms.map((platform) => `./dist/shuvtunnel-${platform}.tar.gz`)
    await $`gh release create ${tag} ${tarballs} --repo ${repo} --title ${tag} --generate-notes`
  }
} else {
  console.warn("GH_TOKEN is not set; skipping the GitHub release, Homebrew, and AUR")
  process.exit(0)
}

// Homebrew: brew install shuv1337/tap/shuvtunnel
const formula = `class Shuvtunnel < Formula
  desc "${description}"
  homepage "https://shuv.zip"
  version "${version}"
  license "MIT"

  on_macos do
    on_arm do
      url "${download("darwin-arm64")}"
      sha256 "${sha["darwin-arm64"]}"
    end
    on_intel do
      url "${download("darwin-x64")}"
      sha256 "${sha["darwin-x64"]}"
    end
  end

  on_linux do
    on_arm do
      url "${download("linux-arm64")}"
      sha256 "${sha["linux-arm64"]}"
    end
    on_intel do
      url "${download("linux-x64")}"
      sha256 "${sha["linux-x64"]}"
    end
  end

  def install
    bin.install "shuvtunnel"
  end

  test do
    system bin/"shuvtunnel", "--version"
  end
end
`
// CI writes the tap's deploy key (HOMEBREW_TAP_KEY) to an SSH host alias, homebrew-tap.github.com.
if (process.env.HOMEBREW_TAP_KEY) {
  const tap = "git@homebrew-tap.github.com:shuv1337/homebrew-tap.git"
  await $`rm -rf ./dist/homebrew-tap`
  await $`git clone --depth 1 ${tap} ./dist/homebrew-tap`
  await Bun.write("./dist/homebrew-tap/shuvtunnel.rb", formula)
  await $`git add shuvtunnel.rb`.cwd("./dist/homebrew-tap")
  if ((await $`git diff --cached --quiet`.cwd("./dist/homebrew-tap").nothrow()).exitCode !== 0) {
    await $`git commit -m ${`shuvtunnel ${version}`}`.cwd("./dist/homebrew-tap")
    await $`git push`.cwd("./dist/homebrew-tap")
  }
} else {
  console.warn("HOMEBREW_TAP_KEY is not set; skipping Homebrew")
}

// AUR: yay -S shuvtunnel-bin
const aurSource = (arch: string, platform: string) =>
  `shuvtunnel-${version}-${arch}.tar.gz::${download(platform)}`
const pkgbuild = `pkgname=shuvtunnel-bin
pkgver=${version}
pkgrel=1
pkgdesc='${description}'
url='https://shuv.zip'
arch=('aarch64' 'x86_64')
license=('MIT')
provides=('shuvtunnel')
conflicts=('shuvtunnel')
options=('!debug' '!strip')
source_aarch64=("${aurSource("aarch64", "linux-arm64")}")
sha256sums_aarch64=('${sha["linux-arm64"]}')
source_x86_64=("${aurSource("x86_64", "linux-x64")}")
sha256sums_x86_64=('${sha["linux-x64"]}')

package() {
  install -Dm755 shuvtunnel "$pkgdir/usr/bin/shuvtunnel"
}
`
// Equivalent to \`makepkg --printsrcinfo\`, which is not available on CI runners.
const srcinfo = `pkgbase = shuvtunnel-bin
\tpkgdesc = ${description}
\tpkgver = ${version}
\tpkgrel = 1
\turl = https://shuv.zip
\tarch = aarch64
\tarch = x86_64
\tlicense = MIT
\tprovides = shuvtunnel
\tconflicts = shuvtunnel
\toptions = !debug
\toptions = !strip
\tsource_aarch64 = ${aurSource("aarch64", "linux-arm64")}
\tsha256sums_aarch64 = ${sha["linux-arm64"]}
\tsource_x86_64 = ${aurSource("x86_64", "linux-x64")}
\tsha256sums_x86_64 = ${sha["linux-x64"]}

pkgname = shuvtunnel-bin
`
if (process.env.AUR_KEY) {
  await $`rm -rf ./dist/aur`
  await $`git clone ssh://aur@aur.archlinux.org/shuvtunnel-bin.git ./dist/aur`
  await Bun.write("./dist/aur/PKGBUILD", pkgbuild)
  await Bun.write("./dist/aur/.SRCINFO", srcinfo)
  await $`git add PKGBUILD .SRCINFO`.cwd("./dist/aur")
  if ((await $`git diff --cached --quiet`.cwd("./dist/aur").nothrow()).exitCode !== 0) {
    await $`git commit -m ${`Update to ${version}`}`.cwd("./dist/aur")
    await $`git push origin HEAD:master`.cwd("./dist/aur")
  }
} else {
  console.warn("AUR_KEY is not set; skipping AUR")
}
