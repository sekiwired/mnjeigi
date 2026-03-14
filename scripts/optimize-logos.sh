#!/usr/bin/env bash
# Converts company logo PNGs to WebP, resized for retina display.
#
# Max displayed size in CSS: 80×45px → at 3× retina: 240×135px
# We use 240px max width as the constraint (height follows aspect ratio).
#
# Usage: bash scripts/optimize-logos.sh
# Requires: cwebp (brew install webp)

set -euo pipefail

IMG_DIR="$(cd "$(dirname "$0")/../images" && pwd)"
MAX_WIDTH=240
QUALITY=80

# Only the logos referenced in the client-grid (not wallpaper, icons, etc.)
LOGOS=(
  thales loreal-w natixis-w total socgen orange axa sfr
  sanofi-w ca aon adp safran-w openwork meludia engie
  etap 104-w astrakhan-w cgi devoteam flubber nxtpop paulineservice
)

total_before=0
total_after=0

for name in "${LOGOS[@]}"; do
  src=""
  ext=""
  # find the source file (png or svg)
  if [[ -f "$IMG_DIR/${name}.png" ]]; then
    src="$IMG_DIR/${name}.png"
    ext="png"
  elif [[ -f "$IMG_DIR/${name}.svg" ]]; then
    src="$IMG_DIR/${name}.svg"
    ext="svg"
  else
    echo "SKIP  $name — source not found"
    continue
  fi

  dst="$IMG_DIR/${name}.webp"
  size_before=$(stat -f%z "$src")
  total_before=$((total_before + size_before))

  if [[ "$ext" == "svg" ]]; then
    # SVGs are already tiny and vector — keep as-is
    echo "SKIP  $name.svg (vector, $(( size_before / 1024 ))KB)"
    continue
  fi

  # Get current width
  cur_width=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')

  if (( cur_width > MAX_WIDTH )); then
    # Resize then convert
    # Use a temp file to avoid touching the original
    tmp="/tmp/logo_resize_$$.png"
    sips --resampleWidth "$MAX_WIDTH" "$src" --out "$tmp" >/dev/null 2>&1
    cwebp -q "$QUALITY" "$tmp" -o "$dst" >/dev/null 2>&1
    rm -f "$tmp"
  else
    # Just convert format, no resize needed
    cwebp -q "$QUALITY" "$src" -o "$dst" >/dev/null 2>&1
  fi

  size_after=$(stat -f%z "$dst")
  total_after=$((total_after + size_after))
  pct=$(( (size_before - size_after) * 100 / size_before ))
  echo "OK    ${name}.png $(( size_before / 1024 ))KB → ${name}.webp $(( size_after / 1024 ))KB  (-${pct}%)"
done

echo ""
echo "Total before: $(( total_before / 1024 ))KB"
echo "Total after:  $(( total_after / 1024 ))KB"
echo "Saved:        $(( (total_before - total_after) / 1024 ))KB"
echo ""
echo "Next steps:"
echo "  1. Review the .webp files in images/"
echo "  2. Run: bash scripts/update-logo-refs.sh   to update HTML references"
