export type Consejo = {
  ideal: 'Haiku' | 'Sonnet' | 'Opus'
  motivo: string
  actual: string
}

declare module 'claude-code' {
  interface PluginState {
    'asesor-modelo': { consejo: Shaped<Consejo | null>; oculto: boolean }
  }
}
