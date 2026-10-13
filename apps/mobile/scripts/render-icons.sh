#!/usr/bin/env bash
# Renders the app's icon and splash art from the SVGs in assets/source/.
# Needs rsvg-convert (`brew install librsvg`). Run from apps/mobile after changing an SVG,
# then look at every PNG before committing. The art carries the platform palette's primary
# (#30577D); code never does -- see src/theme/.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=assets/source
OUT=assets/images
ICON=assets/Aimtrue.icon/Assets

command -v rsvg-convert >/dev/null || { echo "rsvg-convert not found: brew install librsvg" >&2; exit 1; }

render() { rsvg-convert -w "$3" -h "$3" "$SRC/$1" -o "$2"; }

# The 1024 app icon: opaque, no alpha channel (rsvg writes RGB when nothing is transparent).
render icon.svg "$OUT/icon.png" 1024
# Android adaptive icon layers (108dp canvas) and the themed (monochrome) icon.
render android-foreground.svg "$OUT/android-icon-foreground.png" 1024
render android-background.svg "$OUT/android-icon-background.png" 1024
render android-foreground.svg "$OUT/android-icon-monochrome.png" 1024
# The splash: the mark alone, shown on the platform primary.
render splash.svg "$OUT/splash-icon.png" 1024
# The Icon Composer layer (iOS 26+; Xcode renders the older sizes from it).
cp "$SRC/aimtrue-mark.svg" "$ICON/aimtrue-mark.svg"

if file "$OUT/icon.png" | grep -q RGBA; then
  echo "icon.png has an alpha channel; the App Store refuses it" >&2
  exit 1
fi
echo "Rendered: $(ls "$OUT")"
