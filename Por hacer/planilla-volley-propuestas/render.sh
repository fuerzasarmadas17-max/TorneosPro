#!/bin/bash
# Convierte los HTML de esta carpeta en PNG de 430x932 (pantalla de celular).
# Se renderiza al doble de tamaño para que el texto quede nítido.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in [123]-*.html; do
  out="${f%.html}.png"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --force-device-scale-factor=2 \
    --window-size=430,932 --screenshot="$out" "$f" >/dev/null 2>&1
  echo "listo: $out"
done
