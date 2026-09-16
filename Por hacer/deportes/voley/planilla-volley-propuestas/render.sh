#!/bin/bash
# Convierte los HTML de esta carpeta en PNG.
#
# El tamaño sale del nombre del archivo: los que terminan en "-horizontal" se
# renderizan acostados (932x430) y el resto de pie (430x932). Se renderiza al
# doble para que el texto quede nítido.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in [123]-*.html; do
  out="${f%.html}.png"
  case "$f" in
    *-horizontal.html) tam="932,430" ;;
    *)                 tam="430,932" ;;
  esac
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --force-device-scale-factor=2 \
    --window-size="$tam" --screenshot="$out" "$f" >/dev/null 2>&1
  echo "listo: $out  ($tam)"
done
