#!/bin/bash
# Convierte hoy.html en hoy.png. Se renderiza al doble para que el texto quede
# nítido. Mismo patrón que planilla-volley-propuestas/render.sh.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=2 \
  --window-size=430,932 --screenshot="hoy.png" "hoy.html" >/dev/null 2>&1
echo "listo: hoy.png"
