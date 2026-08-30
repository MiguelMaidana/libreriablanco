#!/usr/bin/env python3
"""UserPromptSubmit: captura etiquetas de tarea/complejidad/ticket del mensaje."""

import json, re, sys
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
except Exception as exc:
    print(json.dumps({"continue": True,
                      "systemMessage": f"tsoft-kit/user_prompt_submit: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)

RE_TAREA      = re.compile(r"#tarea:([a-zA-Z0-9_\-]+)", re.IGNORECASE)
RE_COMPLEJIDAD = re.compile(r"#complejidad:(baja|media|alta)", re.IGNORECASE)
RE_TICKET     = re.compile(r"#ticket:([A-Z0-9\-]+)", re.IGNORECASE)


def main() -> int:
    datos      = ml.leer_stdin_json()
    session_id = datos.get("session_id") or "sin-sesion"
    raiz       = ml.raiz_kit(datos.get("cwd"))
    prompt     = datos.get("prompt") or ""

    estado = ml.leer_estado(session_id, raiz) or {}
    estado["turnos"] = estado.get("turnos", 0) + 1

    m = RE_TAREA.search(prompt)
    if m:
        estado["tarea_declarada"] = m.group(1).lower()

    m = RE_COMPLEJIDAD.search(prompt)
    if m:
        estado["complejidad_declarada"] = m.group(1).lower()

    m = RE_TICKET.search(prompt)
    if m:
        estado["ticket"] = m.group(1).upper()

    ml.escribir_estado(session_id, estado, raiz)
    print(json.dumps({"continue": True}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"continue": True,
                          "systemMessage": f"tsoft-kit/user_prompt_submit: {exc}"}))
        sys.exit(0)
