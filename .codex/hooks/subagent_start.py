#!/usr/bin/env python3
"""SubagentStart: abre el registro de un subagente para medir su consumo.

Cada subagente escribe SU PROPIO archivo marcador, identificado por agent_id.
No toca el estado de la sesion: los hooks de subagente reciben el session_id
del PADRE, asi que dos subagentes en paralelo (max_threads > 1) se pisarian
entre si al leer-modificar-escribir el mismo JSON.
"""

import json, re, sys
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
except Exception as exc:
    print(json.dumps({"systemMessage": f"tsoft-kit/subagent_start: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)

RE_INSEGURO = re.compile(r"[^A-Za-z0-9_.-]")


def ruta_marcador(agent_id: str, raiz: Path) -> Path:
    seguro = RE_INSEGURO.sub("_", agent_id or "sin-agente")[:80]
    destino = raiz / "tsoft-dev/metrics/sesiones" / f"sub-{seguro}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    return destino


def main() -> int:
    import time

    datos      = ml.leer_stdin_json()
    raiz       = ml.raiz_kit(datos.get("cwd"))
    agent_id   = datos.get("agent_id") or "sin-agente"

    marcador = {
        "agent_id":          agent_id,
        "agent_type":        datos.get("agent_type") or "desconocido",
        "session_id_padre":  datos.get("session_id") or "sin-sesion",
        "turn_id":           datos.get("turn_id"),
        "modelo":            datos.get("model"),
        "inicio":            ml.ahora_iso(),
        "inicio_epoch":      time.time(),
    }

    ruta = ruta_marcador(agent_id, raiz)
    with ruta.open("w", encoding="utf-8") as fh:
        json.dump(marcador, fh, ensure_ascii=False, indent=2)

    print(json.dumps({}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"systemMessage": f"tsoft-kit/subagent_start: {exc}"}))
        sys.exit(0)