export type Ventana = { pct: number; resetsAt: string | null }
export type Lectura = {
  cincoHoras: Ventana | null
  semana: Ventana | null
  contexto: number | null
  costo: number | null
}

declare module 'claude-code' {
  interface PluginState {
    medidor: { lectura: Shaped<Lectura | null>; avisos: string[] }
  }
}
