#!/bin/bash
# Convierte las maquetas en PNG, al doble para que el texto quede nítido.
# Las de envivo van a 500 de ancho: Chrome headless no baja de ~500 y una
# página que se adapta al ancho se corta si se le pide menos.
# Cada captura con su propio perfil y un vigilante de 30 segundos, porque
# Chrome headless a veces saca la foto y no se cierra.
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
captura() { # $1 = salida, $2 = tamaño, $3 = archivo y parámetros
  perfil=$(mktemp -d)
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --user-data-dir="$perfil" \
    --force-device-scale-factor=2 --window-size="$2" \
    --screenshot="$PWD/$1" "file://$PWD/$3" >/dev/null 2>&1 &
  pid=$!
  for _ in $(seq 1 30); do kill -0 $pid 2>/dev/null || break; sleep 1; done
  kill $pid 2>/dev/null; rm -rf "$perfil"
  echo "listo: $1"
}
captura hoy.png          430,932  hoy.html
captura envivo-aviso.png 500,1000  envivo.html
captura envivo-hoja.png  500,1000  "envivo.html?hoja=1"
captura envivo-escritorio.png 1280,860 "envivo.html?hoja=1"
