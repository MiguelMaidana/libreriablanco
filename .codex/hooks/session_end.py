#!/usr/bin/env python3
"""SessionEnd: marca el cierre de la sesion. Presupuesto: 1 segundo."""

import json, sys
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
except Exception as exc:
    print(json.dumps({"systemMessage": f"tsoft-kit/session_end: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)


def main() -> int:
    datos      = ml.leer_stdin_json()
    session_id = datos.get("session_id") or "sin-sesion"
    raiz       = ml.raiz_kit(datos.get("cwd"))

    estado = ml.leer_estado(session_id, raiz) or {}
    if not estado.get("fin"):
        estado["fin"] = ml.ahora_iso()
        ml.escribir_estado(session_id, estado, raiz)

    print(json.dumps({}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"systemMessage": f"tsoft-kit/session_end: {exc}"}))
        sys.exit(0)
