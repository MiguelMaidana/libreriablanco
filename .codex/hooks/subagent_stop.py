#!/usr/bin/env python3
"""SubagentStop: cierra el registro de un subagente y lo escribe en el ledger.

Reemplaza la atribucion por frase en prosa (que el propio kit documenta con
58% de fallo) por el evento del runtime, que trae agent_type y el transcript
propio del subagente.

Escribe una linea autocontenida con evento="subagente". No modifica el estado
de la sesion padre, para no competir con otros subagentes en paralelo.
"""

import json, re, sys, time
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
except Exception as exc:
    print(json.dumps({"continue": True,
                      "systemMessage": f"tsoft-kit/subagent_stop: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)

RE_INSEGURO = re.compile(r"[^A-Za-z0-9_.-]")


def ruta_marcador(agent_id: str, raiz: Path) -> Path:
    seguro = RE_INSEGURO.sub("_", agent_id or "sin-agente")[:80]
    destino = raiz / "tsoft-dev/metrics/sesiones" / f"sub-{seguro}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    return destino


def leer_marcador(ruta: Path) -> dict:
    if not ruta.exists():
        return {}
    try:
        with ruta.open(encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def main() -> int:
    datos    = ml.leer_stdin_json()
    raiz     = ml.raiz_kit(datos.get("cwd"))
    config   = ml.cargar_config(raiz)
    agent_id = datos.get("agent_id") or "sin-agente"

    ruta      = ruta_marcador(agent_id, raiz)
    marcador  = leer_marcador(ruta)

    # El evento manda el transcript propio del subagente: ahi estan SUS tokens,
    # no los del padre. Es la pieza que hace posible la atribucion real.
    transcript = datos.get("agent_transcript_path")
    uso        = ml.extraer_tokens(transcript)
    modelo     = datos.get("model") or marcador.get("modelo") or ""
    costo      = ml.costo_usd(uso, modelo, config)

    inicio_epoch = marcador.get("inicio_epoch")
    duracion_h   = round((time.time() - inicio_epoch) / 3600, 4) if inicio_epoch else None

    registro = {
        "evento":           "subagente",
        "session_id":       datos.get("session_id") or marcador.get("session_id_padre") or "sin-sesion",
        "agent_id":         agent_id,
        "agent_type":       (datos.get("agent_type") or
                             marcador.get("agent_type") or "desconocido"),
        "turn_id":          datos.get("turn_id") or marcador.get("turn_id"),
        "modelo":           modelo,
        "inicio":           marcador.get("inicio"),
        "fin":              ml.ahora_iso(),
        "duracion_h":       duracion_h,
        "tokens":           uso,
        "costo":            costo,
        "transcript":       transcript,
        "marcador_hallado": bool(marcador),
    }

    ml.append_ledger(registro, raiz)

    try:
        ruta.unlink()
    except Exception:
        pass

    # SubagentStop exige JSON en stdout cuando sale con 0: texto plano es invalido.
    print(json.dumps({"continue": True}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"continue": True,
                          "systemMessage": f"tsoft-kit/subagent_stop: {exc}"}))
        sys.exit(0)
