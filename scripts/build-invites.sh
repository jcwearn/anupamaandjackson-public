#!/usr/bin/env bash
# Regenerate public/invites/ from finalized PNG sources.
# Produces AVIF (primary) and JPEG (fallback) at 2x retina resolution.
#
# Requirements: sips (macOS), avifenc.
#   brew install libavif

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source PNGs are not committed (author-only). Override SRC_BRIDE / SRC_GROOM
# via env to point at your own copies.
SRC_BRIDE="${SRC_BRIDE:-$HOME/Documents/wedding/invites/Anupama & Jackson Wedding Invite}"
SRC_GROOM="${SRC_GROOM:-$HOME/Documents/wedding/invites/Jackson & Anupama Wedding Invite}"
DEST="$REPO_ROOT/public/invites"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

AVIF_LONGEST_SIDE=3200   # 2x retina for the primary path (source ~2271x3250)
JPEG_LONGEST_SIDE=1600   # 1x retina for the rare fallback path; keeps it cellular-friendly
JPEG_QUALITY=80
AVIF_QUALITY=50

# The downloadable PDFs. Larger than the web JPEGs because these get saved and
# sometimes printed, but the whole 6-page file still has to open on cellular in
# India — and Cloudflare Pages refuses any asset over 25 MiB.
PDF_LONGEST_SIDE=2000
PDF_QUALITY=82

# Each entry: <output-name>|<source-png-path>
ENTRIES=(
  "cover-page|$SRC_BRIDE/cover-page.png"
  "edurukolu|$SRC_BRIDE/edurukolu.png"
  "muhurtham|$SRC_BRIDE/muhurtham.png"
  "reception|$SRC_BRIDE/reception.png"
  "rsvp|$SRC_BRIDE/rsvp.png"
  "invite-tadanki|$SRC_BRIDE/invite-tadanki.png"
  "invite-wearn|$SRC_GROOM/invite-wearn.png"
)

mkdir -p "$DEST"

for entry in "${ENTRIES[@]}"; do
  name="${entry%%|*}"
  src="${entry#*|}"
  echo "==> $name (from $src)"
  if [[ ! -f "$src" ]]; then
    echo "    MISSING: $src" >&2
    exit 1
  fi

  resized_avif="$TMP/${name}-avif.png"
  sips -Z "$AVIF_LONGEST_SIDE" "$src" --out "$resized_avif" >/dev/null

  resized_jpeg="$TMP/${name}-jpeg.png"
  sips -Z "$JPEG_LONGEST_SIDE" "$src" --out "$resized_jpeg" >/dev/null

  echo "  -> ${name}.jpeg"
  sips -s format jpeg -s formatOptions "$JPEG_QUALITY" \
    "$resized_jpeg" --out "$DEST/${name}.jpeg" >/dev/null

  echo "  -> ${name}.avif"
  avifenc -q "$AVIF_QUALITY" --speed 4 \
    "$resized_avif" "$DEST/${name}.avif" >/dev/null

  # Page source for the downloadable PDFs, assembled after the loop.
  resized_pdf="$TMP/${name}-pdf-src.png"
  sips -Z "$PDF_LONGEST_SIDE" "$src" --out "$resized_pdf" >/dev/null
  sips -s format jpeg -s formatOptions "$PDF_QUALITY" \
    "$resized_pdf" --out "$TMP/${name}.jpeg" >/dev/null
done

# Page order mirrors fullSequence() in src/data/invites.ts — the two PDFs are
# the same invite the site shows, so they share every card but the second.
# Nothing enforces the two lists agree; change them together.
for side in tadanki wearn; do
  echo "==> invite-${side}.pdf"
  node "$REPO_ROOT/scripts/build-invite-pdfs.js" "$DEST/invite-${side}.pdf" \
    "$TMP/cover-page.jpeg" \
    "$TMP/invite-${side}.jpeg" \
    "$TMP/edurukolu.jpeg" \
    "$TMP/muhurtham.jpeg" \
    "$TMP/reception.jpeg" \
    "$TMP/rsvp.jpeg"
done

echo
echo "Done. Generated files:"
ls -lh "$DEST" | awk '{print $5, $9}' | sort
