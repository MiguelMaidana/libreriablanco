---
name: reporte-html
description: Genera el reporte HTML de consumo por feature con el diseno TSOFT, en tsoft-dev/reportes/features.html. Usa esta skill cuando el usuario pida el reporte en HTML, un reporte presentable, el reporte para el gerente, el reporte de la semana o el consumo por feature en formato visual.
---

# Reporte HTML de consumo por feature

Genera `tsoft-dev/reportes/features.html` con el diseno TSOFT, al lado del
`features.md`.

**Nunca escribas cifras a mano.** Ejecuta los comandos y presenta lo que
devuelven. Si un numero no salio del script, no va en el reporte.

## Los dos comandos, en este orden

```powershell
py tsoft-dev/scripts/reconciliador.py
py tsoft-dev/scripts/reporte_features.py --semana --html
```

El primero lee los rollouts que Codex escribe en `~/.codex/sessions/` y arma
`tsoft-dev/metrics/features.jsonl`. El segundo lo lee y genera los reportes.

Sin el primer comando el segundo no tiene nada que leer: `features.jsonl` no
existe hasta que el reconciliador corre. No es un error, es el orden.

## Salidas

| Archivo | Que es |
| --- | --- |
| `tsoft-dev/reportes/features.html` | El reporte con el diseno TSOFT |
| `tsoft-dev/reportes/features.md` | El mismo dato en Markdown, se genera siempre |

`--html` agrega el HTML; el Markdown sale igual con o sin el flag.

## Periodo

| Comando | Que contesta |
| --- | --- |
| `--semana --html` | Que paso en los ultimos 7 dias |
| `--html` | Cuanto costo cada feature en total, desde que se instalo el kit |

Las dos lecturas son validas y ninguna reemplaza a la otra. **Preguntale al
usuario cual quiere** si no lo aclaro; si insiste en que elijas, usa
`--semana`, que es el corte de gestion.

Otras variantes:

```powershell
py tsoft-dev/scripts/reporte_features.py --semana --fecha 2026-08-15 --html
py tsoft-dev/scripts/reporte_features.py --desde 2026-08-01 --hasta 2026-08-15 --html
py tsoft-dev/scripts/reporte_features.py --diario --html
```

## Que trae el HTML

| Seccion | Contiene |
| --- | --- |
| Encabezado | titulo, periodo declarado y fecha de generacion |
| Indicadores | features, tokens totales, equivalente en USD y pico de cuota |
| Consumo por feature | feature, estado, tokens, tiempo activo, turnos, conversaciones, USD y origen |
| Avisos | los que correspondan segun los datos (ver abajo) |
| Detalle por conversacion | una linea por conversacion de Codex |

## Como leerlo, y que aclarar siempre

- **El USD no es gasto.** Con plan `team` o `plus` no se paga por token, se paga
  una suscripcion fija. El numero es el equivalente a precios de API y sirve
  para dimensionar. El reporte ya lo aclara; no lo contradigas.
- **El limite real es la cuota semanal.** Al 100% el trabajo queda bloqueado
  hasta que la ventana se reinicia. La cuota se reporta como **pico**, nunca
  sumada: es un porcentaje de una ventana movil y una misma conversacion puede
  aparecer en dos features.
- **`sin-feature` no es un error.** Es consumo real que no pertenece a ninguna
  feature: consultas sueltas, exploracion, mantenimiento. Que aparezca
  separado es la señal de que la atribucion funciona.
- **Una feature partida entre dos semanas** muestra en el reporte semanal solo
  la parte de esa ventana. El reporte lo avisa por nombre. Para el total,
  correr sin filtro.
- **El tiempo activo** descarta las pausas de mas de 30 minutos
  (`umbral_inactividad_min` en `tsoft-dev/config/celula.json`).

## Estilo

El diseno vive embutido en `tsoft-dev/scripts/plantilla_html.py` y el CSS sale
inline en el HTML: el reporte es un archivo solo y se puede mandar por mail.

**No busques ninguna plantilla HTML en el repo, no existe.** Si el equipo quiere
otra marca, puede dejar su CSS en `tsoft-dev/config/estilos-reporte.css` y ese
reemplaza al default. No hay que tocar Python para cambiar el estilo.

## Si el reporte sale vacio

1. ¿Corriste `reconciliador.py` primero? Es la causa mas comun.
2. ¿Existe `tsoft-dev/metrics/features.jsonl` con al menos una linea?
3. Si existe y el HTML igual sale vacio, es el filtro de periodo: probá sin
   `--semana` para ver si hay datos de otras fechas.
4. Si `reconciliador.py` dice `Registros: 0`, ninguna conversacion quedo
   asociada a este proyecto. Verificá que abriste Codex en la carpeta del
   proyecto.
