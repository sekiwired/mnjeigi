#!/usr/bin/env bash
# Updates HTML references for company logos from .png/.svg to .webp
# Run AFTER optimize-logos.sh has generated the .webp files.
#
# Usage: bash scripts/update-logo-refs.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

LOGOS=(
  thales loreal-w natixis-w total socgen orange axa sfr
  sanofi-w ca aon adp safran-w openwork meludia engie
  etap 104-w astrakhan-w cgi devoteam flubber nxtpop paulineservice
)

count=0
for name in "${LOGOS[@]}"; do
  webp="$ROOT/images/${name}.webp"
  if [[ ! -f "$webp" ]]; then
    echo "SKIP  $name — no .webp file found (svg logos stay as-is)"
    continue
  fi

  # Replace in all HTML files
  for ext in png; do
    old="images/${name}.${ext}"
    new="images/${name}.webp"
    # Find and replace in HTML files
    grep -rl "$old" "$ROOT/html/" "$ROOT/index.html" 2>/dev/null | while read -r file; do
      sed -i '' "s|${old}|${new}|g" "$file"
      echo "OK    $file: $old → $new"
      count=$((count + 1))
    done
  done
done

echo ""
echo "Done. Updated references in HTML files."
echo "You can now safely delete the original .png files for converted logos if the site looks correct."
