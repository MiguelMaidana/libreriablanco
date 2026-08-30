#!/usr/bin/env python3
"""SessionStart: abre el registro de la ejecucion e inyecta el contexto operativo."""

import json, os, sys, time
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
except Exception as exc:
    print(json.dumps({"systemMessage": f"tsoft-kit/session_start: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)


def main() -> int:
    datos      = ml.leer_stdin_json()
    session_id = datos.get("session_id") or "sin-sesion"
    raiz       = ml.raiz_kit(datos.get("cwd"))

    estado = ml.leer_estado(session_id, raiz) or {}
    estado.setdefault("inicio_epoch", time.time())
    estado.setdefault("inicio",       ml.ahora_iso())
    estado.setdefault("archivos_tocados", [])
    estado.setdefault("comandos",     [])
    estado.setdefault("subagentes",   [])
    estado.setdefault("ediciones",    0)
    estado.setdefault("turnos",       0)
    estado["session_id"]       = session_id
    estado["cwd"]              = datos.get("cwd")
    estado["modelo"]           = datos.get("model")
    estado["permission_mode"]  = datos.get("permission_mode")
    estado["transcript_path"]  = datos.get("transcript_path")
    ml.escribir_estado(session_id, estado, raiz)

    contexto = (
        "TSOFT AI Dev Kit activo. Reglas:\n"
        "1. Toda feature parte por $orquestador [nombre-feature].\n"
        "2. El desarrollador nunca corre sin aprobacion explicita del plan (design.md).\n"
        "3. Al cerrar cada feature, el Orquestador escribe:\n"
        "   TAREA = [tipo] | COMPLEJIDAD = [baja|media|alta] | FEATURE = [nombre]\n"
        "   para que la clasificacion del consumo sea precisa.\n"
        "4. Si no se declara, el tipo se infiere por los archivos tocados.\n"
        "5. Los reportes se generan en tsoft-dev/reportes/ejecuciones/."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": contexto,
        }
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"systemMessage": f"tsoft-kit/session_start: {exc}"}))
        sys.exit(0)
