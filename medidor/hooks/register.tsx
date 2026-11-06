import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, SessionContextUsage, SessionCost } from 'claude-code'

import type { Lectura, Ventana } from '../types'

const lectura = atom({ plugin: 'medidor', key: 'lectura' } as const, null, { shape: 'lectura-1' })
// Avisos ya mostrados en esta sesión, para no repetirlos.
const avisos = atom({ plugin: 'medidor', key: 'avisos' } as const, [])

const ventana = (limits: readonly SessionRateLimit[], kind: string): Ventana | null => {
  const w = limits.find(l => l.kind === kind)
  return w ? { pct: w.percentUsed, resetsAt: w.resetsAt ?? null } : null
}

const leer = (
  context: SessionContextUsage,
  rateLimits: readonly SessionRateLimit[],
  cost: SessionCost | undefined,
): Lectura => ({
  cincoHoras: ventana(rateLimits, 'five_hour'),
  semana: ventana(rateLimits, 'seven_day'),
  contexto: context.percent ?? null,
  costo: cost?.usd ?? null,
})

const faltan = (resetsAt: string | null, ahora: number): string => {
  if (resetsAt === null) return ''
  const min = Math.max(0, Math.round((Date.parse(resetsAt) - ahora) / 60000))
  if (min >= 60 * 24) return ` · se reinicia en ${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`
  if (min >= 60) return ` · se reinicia en ${Math.floor(min / 60)} h ${min % 60} min`
  return ` · se reinicia en ${min} min`
}

const color = (pct: number) => (pct >= 80 ? 'error' : pct >= 50 ? 'warning' : 'success')

const consejo = (ctx: number | null): { texto: string; pct: number } => {
  if (ctx === null) return { texto: 'Conversación: aún sin datos', pct: 0 }
  if (ctx >= 75) return { texto: `Conversación ${ctx}% llena → ABRE UNA NUEVA: cada mensaje aquí gasta mucho más`, pct: 90 }
  if (ctx >= 50) return { texto: `Conversación ${ctx}% llena → si cambias de tema, abre una nueva`, pct: 60 }
  return { texto: `Conversación ${ctx}% llena → puedes seguir aquí`, pct: ctx }
}

async function avisarUnaVez($: EngineInterface, id: string, texto: string) {
  const ya = await read($, avisos)
  if (ya.includes(id)) return
  await update($, avisos, l => [...l, id])
  $.ui.toast(texto)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    try {
      const u = await $.session.usage()
      await update($, lectura, () => leer(u.context, u.rateLimits, u.cost))
    } catch {
      // Sin datos todavía: la primera respuesta los traerá.
    }
    return ran
  })

  on('session.measure', async ($, e, next) => {
    const l = leer(e.context, e.rateLimits, e.cost)
    await update($, lectura, () => l)
    if (l.contexto !== null && l.contexto >= 75) {
      await avisarUnaVez($, 'ctx75', 'Esta conversación ya está muy cargada: abre una nueva para gastar menos.')
    }
    if (l.cincoHoras && l.cincoHoras.pct >= 80) {
      await avisarUnaVez($, 'cinco80', `Llevas el ${l.cincoHoras.pct}% de tu límite de 5 horas.`)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const l = await read($, lectura)
    const { Box, Text } = $.ui.resolve(e)
    const ahora = await $.clock.now()
    const c = consejo(l?.contexto ?? null)
    // La franja admite un solo dibujo: se incluye debajo lo que dibujen otros mods.
    const otros = await next(e).catch(() => null)

    return (
      <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box>
          <Text bold>Límite 5 h: </Text>
          {l?.cincoHoras ? (
            <Text color={color(l.cincoHoras.pct)}>
              {l.cincoHoras.pct}% gastado ({Math.round(100 - l.cincoHoras.pct)}% libre){faltan(l.cincoHoras.resetsAt, ahora)}
            </Text>
          ) : (
            <Text dimColor>sin datos aún (aparece tras la primera respuesta)</Text>
          )}
        </Box>
        {l?.semana && (
          <Box>
            <Text bold>Límite semanal: </Text>
            <Text color={color(l.semana.pct)}>
              {l.semana.pct}% gastado{faltan(l.semana.resetsAt, ahora)}
            </Text>
          </Box>
        )}
        <Box>
          <Text color={color(c.pct)}>{c.texto}</Text>
          {l?.costo != null && <Text dimColor> · equivale a ${l.costo.toFixed(2)}</Text>}
        </Box>
      </Box>
      {otros}
      </Box>
    )
  })
}
