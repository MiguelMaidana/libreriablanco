---
name: reporte-ejecucion
description: Genera el reporte Markdown de una ejecucion o el consolidado del periodo, con consumo de tokens por ejecucion, costo referencial, duracion y clasificacion de tarea. Usa esta skill SIEMPRE que el usuario pida un reporte, un informe, metricas, consumo de tokens, cuantos tokens se gastaron, duracion de sesiones o un resumen de lo trabajado.
---

# Reporte de ejecucion

Los reportes se generan a partir del ledger que llenan los hooks del
TSOFT AI Dev Kit.

Nunca escribas cifras a mano: ejecuta el script y presenta su salida.

## Reporte HTML (consumo por feature)

Para el reporte visual de consumo por feature, usar la skill
`reporte-html` — ese es el generador real, `reporte_features.py --html`
via `.\generar-reportes.ps1`. Esta skill (`reporte-ejecucion`) cubre los
reportes Markdown de sesion/consolidado que siguen abajo.

## Reporte de una ejecucion

```bash
python tsoft-dev/scripts/reporte.py ejecucion --session-id <session_id>
```

Salida:

- `tsoft-dev/reportes/ejecuciones/<session_id>.md`

Si no conoces el `session_id`, listalos:

```bash
python tsoft-dev/scripts/reporte.py listar
```

## Reporte consolidado

```bash
python tsoft-dev/scripts/reporte.py consolidado
python tsoft-dev/scripts/reporte.py consolidado --desde 2026-07-01
```

Salida:

- `tsoft-dev/reportes/consolidado.md`

## Contenido real del reporte por ejecucion

| Seccion | Contiene |
| --- | --- |
| 1. Resumen general | session id, ticket, feature, inicio, fin, duracion, modelo |
| 2. Tarea | tipo, complejidad y origen de clasificacion (metadato descriptivo, no hay formula de horas) |
| 3. Tokens y costo | input, output, total, fuente, costo USD y costo CLP |
| 4. Evidencia | archivos tocados, ediciones, comandos, subagentes y turnos |

## Interpretacion honesta

- Campo `fuente` en tokens:
  - `jsonl:event_msg.token_count[...]` -> dato real leido desde transcript JSONL.
  - `transcript:...` -> dato real leido desde otra estructura del transcript.
  - `estimacion` -> no hubo lectura exacta; avisalo explicitamente al presentar.
- Si el modelo no tiene tarifa cargada, el costo sale en `0` con aviso.
  Revisar `tsoft-dev/config/celula.json`.
- El kit no calcula horas-hombre ahorradas: se descarto a proposito (no hay
  forma no sesgada de saber cuanto tardaria una tarea a mano en un equipo
  que ya trabaja con el kit desde el dia 0). Tipo y complejidad son metadato
  descriptivo para agrupar consumo, no una promesa de ahorro en horas.
- El consumo dentro de una misma sesion es acumulado. Para una ejecucion,
  el reporte toma la ultima linea del `ledger` para ese `session_id`.

## Si el reporte sale vacio

1. Verifica que el proyecto este marcado como confiable en `~/.codex/config.toml`.
2. Ejecuta `/hooks` y confirma que los hooks del proyecto esten activos.
3. Confirma que existe `tsoft-dev/metrics/ledger.jsonl` con al menos una linea.
4. Si el problema es en VS Code, confirma que la sesion visual este quedando
   asociada al runtime local del proyecto.

## Notas importantes para este repo

- No uses rutas `celula/...` en este proyecto. La raiz operativa real es
  `tsoft-dev/...`.
- No uses `--hasta` porque el script actual no lo soporta.
- No refieras `diagnostico.py` salvo que exista de verdad en el repo.
- No prometas secciones que hoy no genera `reporte.py`, como skills usadas o
  transcript path explicito, salvo que primero se implementen.
