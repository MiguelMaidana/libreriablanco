#!/usr/bin/env python3
"""Stop: cierra el turno, mide tokens y clasifica el consumo, escribe ledger y genera reporte MD."""

import json, re, sys, time
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
    import reporte as rep
except Exception as exc:
    print(json.dumps({"continue": True,
                      "systemMessage": f"tsoft-kit/turn_stop: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)

RE_TAREA_FINAL      = re.compile(r"TAREA\s*=\s*([a-zA-Z0-9_\-]+)", re.IGNORECASE)
RE_COMPLEJIDAD_FINAL = re.compile(r"COMPLEJIDAD\s*=\s*(baja|media|alta)", re.IGNORECASE)
RE_FEATURE_FINAL    = re.compile(r"FEATURE\s*=\s*([^\s|]+)", re.IGNORECASE)


def main() -> int:
    datos      = ml.leer_stdin_json()
    session_id = datos.get("session_id") or "sin-sesion"
    raiz       = ml.raiz_kit(datos.get("cwd"))
    config     = ml.cargar_config(raiz)
    baselines  = ml.cargar_baselines(raiz)

    estado = ml.leer_estado(session_id, raiz) or {}
    estado["fin_epoch"]       = time.time()
    estado["fin"]             = ml.ahora_iso()
    estado["transcript_path"] = (datos.get("transcript_path") or
                                 estado.get("transcript_path"))
    estado["modelo"]          = (datos.get("model") or
                                 estado.get("modelo"))

    eventos_transcript = ml._leer_eventos_transcript(estado.get("transcript_path"))
    evidencia_transcript = ml.extraer_evidencia_transcript(
        estado.get("transcript_path"), eventos=eventos_transcript
    )
    for clave in ("archivos_tocados", "comandos", "subagentes"):
        existentes = estado.setdefault(clave, [])
        for valor in evidencia_transcript.get(clave, []):
            if valor not in existentes:
                existentes.append(valor)
    estado["ediciones"] = max(
        estado.get("ediciones", 0),
        evidencia_transcript.get("ediciones", 0),
    )

    # Capturar etiquetas del mensaje final del Orquestador
    final = datos.get("last_assistant_message") or ""
    if not estado.get("tarea_declarada"):
        m = RE_TAREA_FINAL.search(final)
        if m:
            estado["tarea_declarada"] = m.group(1).lower()
    if not estado.get("complejidad_declarada"):
        m = RE_COMPLEJIDAD_FINAL.search(final)
        if m:
            estado["complejidad_declarada"] = m.group(1).lower()
    if not estado.get("feature"):
        m = RE_FEATURE_FINAL.search(final)
        if m:
            estado["feature"] = m.group(1)

    uso           = ml.extraer_tokens(estado.get("transcript_path"), eventos=eventos_transcript)
    clasificacion = ml.clasificacion_normalizada(estado, baselines)
    duracion      = ml.duracion_sesion(estado)
    costo         = ml.costo_usd(uso, estado.get("modelo") or "", config)

    registro = {
        "evento":          "ejecucion",
        "session_id":      session_id,
        "feature":         estado.get("feature"),
        "ticket":          estado.get("ticket"),
        "inicio":          estado.get("inicio"),
        "fin":             estado.get("fin"),
        "modelo":          estado.get("modelo"),
        "permission_mode": estado.get("permission_mode"),
        "tokens":          uso,
        "costo":           costo,
        "clasificacion":   clasificacion,
        "duracion_h":            duracion["duracion_h"],
        "duracion_confiable":    duracion["duracion_confiable"],
        "evidencia": {
            "archivos_tocados": estado.get("archivos_tocados", []),
            "comandos":         estado.get("comandos", []),
            "subagentes":       estado.get("subagentes", []),
            "ediciones":        estado.get("ediciones", 0),
            "turnos":           estado.get("turnos", 0),
        },
    }
    ml.append_ledger(registro, raiz)
    ml.escribir_estado(session_id, estado, raiz)
    ledger_actual = ml.leer_ledger(raiz)

    mensajes = []
    try:
        ruta = rep.generar_ejecucion(session_id, raiz, ledger=ledger_actual)
        if ruta:
            mensajes.append(f"Reporte: {ruta.name}")
    except Exception as exc:
        mensajes.append(f"Reporte no generado: {exc}")

    if config.get("consolidado_automatico", True):
        try:
            rep.generar_consolidado(raiz=raiz, ledger=ledger_actual)
        except Exception:
            pass

    mensajes.append(
        f"Tokens={uso.get('total', 0):,} ({uso.get('fuente', '?')}) | "
        f"Duracion={duracion['duracion_h']:.2f}h | "
        f"Tipo={clasificacion.get('tipo_tarea', '?')} [{clasificacion.get('origen', '?')}]"
    )
    print(json.dumps({"continue": True,
                      "systemMessage": " | ".join(mensajes)},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"continue": True,
                          "systemMessage": f"tsoft-kit/turn_stop: {exc}"}))
        sys.exit(0)
