#!/bin/bash
# Convierte los HTML de esta carpeta en PNG, de pie (430x932), al doble para
# que el texto quede nítido.
#
# Cada captura corre con su propio perfil de Chrome y un vigilante de 30
# segundos: Chrome en modo headless a veces saca la foto y no se cierra, y sin
# el vigilante el script se queda colgado para siempre.
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in [0-9]-*.html; do
  out="${f%.html}.png"
  perfil=$(mktemp -d)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --user-data-dir="$perfil" \
    --force-device-scale-factor=2 --window-size=430,932 \
    --screenshot="$PWD/$out" "file://$PWD/$f" >/dev/null 2>&1 &
  pid=$!
  for _ in $(seq 1 30); do kill -0 $pid 2>/dev/null || break; sleep 1; done
  kill $pid 2>/dev/null
  rm -rf "$perfil"
  echo "listo: $out"
done
