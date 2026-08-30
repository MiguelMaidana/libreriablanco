#!/usr/bin/env python3
"""PostToolUse: registra archivos tocados, comandos y subagentes invocados."""

import json, re, sys
from pathlib import Path

try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tsoft-dev" / "scripts"))
    import metrics_lib as ml
except Exception as exc:
    print(json.dumps({"systemMessage": f"tsoft-kit/post_tool_use: no pude importar metrics_lib: {exc}"}, ensure_ascii=False))
    sys.exit(0)

# apply_patch manda el parche completo en tool_input.command, no la ruta suelta.
# Verificado contra Codex 0.149.1 con un hook espia.
RE_ARCHIVOS_PATCH = re.compile(
    r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.MULTILINE
)


def main() -> int:
    datos      = ml.leer_stdin_json()
    session_id = datos.get("session_id") or "sin-sesion"
    raiz       = ml.raiz_kit(datos.get("cwd"))
    # Codex manda tool_name / tool_input. Las claves "tool" / "input" no existen.
    herramienta = datos.get("tool_name")  or ""
    entrada     = datos.get("tool_input") or {}

    estado = ml.leer_estado(session_id, raiz) or {}

    if herramienta in ("apply_patch", "Edit", "Write"):
        cmd      = entrada.get("command") or ""
        archivos = RE_ARCHIVOS_PATCH.findall(cmd)

        # Respaldo por si algun camino manda la ruta suelta en vez del parche.
        if not archivos:
            suelto = (entrada.get("path") or
                      entrada.get("file_path") or
                      entrada.get("filename") or "")
            if suelto:
                archivos = [suelto]

        tocados = estado.setdefault("archivos_tocados", [])
        for archivo in archivos:
            archivo = archivo.strip()
            if archivo and archivo not in tocados:
                tocados.append(archivo)

        # Cuenta archivos, no llamadas: un parche de 5 archivos suma 5.
        estado["ediciones"] = estado.get("ediciones", 0) + max(len(archivos), 1)

    elif herramienta in ("Bash", "shell_command"):
        cmd = entrada.get("command") or entrada.get("cmd") or ""
        if cmd:
            comandos = estado.setdefault("comandos", [])
            comando_seguro = ml.redactar_secretos(cmd)[:120]
            if comando_seguro not in comandos:
                comandos.append(comando_seguro)

    elif herramienta in ("spawn_agent", "Agent", "Task",
                         "parallel", "multi_tool_use.parallel"):
        agente = (entrada.get("agent_type") or
                  entrada.get("name") or
                  entrada.get("agent") or "subagente")
        subagentes = estado.setdefault("subagentes", [])
        if agente not in subagentes:
            subagentes.append(agente)

    elif herramienta.startswith("mcp__"):
        subagentes = estado.setdefault("subagentes", [])
        if herramienta not in subagentes:
            subagentes.append(herramienta)

    ml.escribir_estado(session_id, estado, raiz)
    print(json.dumps({}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"systemMessage": f"tsoft-kit/post_tool_use: {exc}"}))
        sys.exit(0)