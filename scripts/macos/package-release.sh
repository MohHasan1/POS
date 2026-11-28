#!/bin/bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo "Build the QuickPOS Mac installer on an Apple Silicon Mac." >&2
  exit 1
fi

cd "$(dirname "$0")/../.."
repository="$PWD"
version="$(node -p 'require("./package.json").version')"
if [[ ! "$version" =~ ^([0-9]+\.[0-9]+\.[0-9]+)(-[A-Za-z0-9.-]+)?$ ]]; then
  echo "package.json must contain a valid release version." >&2
  exit 1
fi
bundle_version="${BASH_REMATCH[1]}"

node_version=24.22.0
node_archive="node-v$node_version-darwin-arm64.tar.gz"
node_checksum=6a9724d9b50a5f22b4816cded441b5a8d9ddae546191a5e5b7efa5a5e2ee26d5
export LC_ALL=C
scratch="$(mktemp -d "${TMPDIR:-/tmp}/quickpos-mac.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT
archive="${QUICKPOS_MAC_NODE_ARCHIVE:-$scratch/$node_archive}"

if [[ -z "${QUICKPOS_MAC_NODE_ARCHIVE:-}" ]]; then
  curl --fail --silent --show-error --location --retry 2 \
    "https://nodejs.org/dist/v$node_version/$node_archive" --output "$archive"
fi
archive_checksum="$(shasum -a 256 < "$archive" | awk '{print $1}')"
if [[ "$archive_checksum" != "$node_checksum" ]]; then
  echo "The bundled Node.js archive did not match the official SHA-256." >&2
  exit 1
fi

tar -xzf "$archive" -C "$scratch"
node_dist="$scratch/node-v$node_version-darwin-arm64"
export PATH="$node_dist/bin:$PATH"
if [[ "$(node -p 'process.versions.node + " " + process.arch')" != "$node_version arm64" ]]; then
  echo "Expected Node.js $node_version for Apple Silicon." >&2
  exit 1
fi

DATABASE_ADAPTER=sqlite DATABASE_URL="file:$scratch/build.db" \
  QUICKPOS_MEDIA_DIR="$scratch/build-media" PAYLOAD_SECRET="$(openssl rand -hex 32)" \
  NEXT_TELEMETRY_DISABLED=1 QUICKPOS_SCHEMA_PUSH=0 QUICKPOS_MAC_BUILD=1 pnpm build

image="$scratch/image"
app="$image/QuickPOS.app"
resources="$app/Contents/Resources"
server="$resources/server"
mkdir -p "$app/Contents/MacOS" "$resources/runtime" "$server/.next"
ln -s /Applications "$image/Applications"

rsync -a --exclude='.env' --exclude='.env.*' \
  --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
  --exclude='/media' --exclude='/test-media' --exclude='/bd-test-media' \
  --exclude='/.next/cache' --exclude='/.next/dev' \
  .next/standalone/ "$server/"
rsync -a .next/static/ "$server/.next/static/"
rsync -a public/ "$server/public/"

install -m 755 "$node_dist/bin/node" "$resources/runtime/node"
install -m 644 "$node_dist/LICENSE" "$resources/runtime/NODE-LICENSE.txt"

sips -s format icns public/web-app-manifest-512x512.png --out "$resources/QuickPOS.icns" >/dev/null

cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>QuickPOS</string>
  <key>CFBundleIconFile</key><string>QuickPOS.icns</string>
  <key>CFBundleIdentifier</key><string>com.quickpos.desktop</string>
  <key>CFBundleName</key><string>QuickPOS</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$bundle_version</string>
  <key>CFBundleVersion</key><string>$bundle_version</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSMultipleInstancesProhibited</key><true/>
  <key>LSRequiresNativeExecution</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
plutil -lint "$app/Contents/Info.plist"

xcrun swiftc -O -target arm64-apple-macosx14.0 -module-cache-path "$scratch/swift-cache" \
  -framework AppKit -framework Security -lsqlite3 \
  scripts/macos/QuickPOSLauncher.swift scripts/macos/LocalServer.swift scripts/macos/Installation.swift \
  -o "$app/Contents/MacOS/QuickPOS"

(
  cd "$server"
  "$resources/runtime/node" --input-type=module -e '
    import { createRequire } from "node:module"
    const require = createRequire(import.meta.url)
    const Database = require("libsql")
    const database = new Database(":memory:")
    try {
      if (database.prepare("select 1 as ready").get().ready !== 1) process.exit(1)
    } finally {
      database.close()
    }
  '
)

while IFS= read -r -d '' binary; do
  if ! lipo -archs "$binary" | grep -qw arm64; then
    echo "Missing Apple Silicon code in $binary" >&2
    exit 1
  fi
  codesign --force --sign - "$binary"
done < <(find "$server" -type f \( -name '*.node' -o -name '*.dylib' \) -print0)

codesign --force --sign - "$resources/runtime/node"
codesign --force --sign - "$app"
codesign --verify --deep --strict "$app"

name="QuickPOS-$version-mac-arm64.dmg"
hdiutil create -fs HFS+ -format UDZO -volname "QuickPOS" -srcfolder "$image" "$scratch/$name"
hdiutil verify "$scratch/$name"

output="$repository/dist/macos"
mkdir -p "$output"
mv "$scratch/$name" "$output/$name"
(cd "$output" && shasum -a 256 "$name" > "$name.sha256")
printf 'Created %s\n' "$output/$name" "$output/$name.sha256"
