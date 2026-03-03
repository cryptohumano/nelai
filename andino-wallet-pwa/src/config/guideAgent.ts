/**
 * Configuración del Agente Guía (Nelai)
 */

export type GuideActionType =
  | 'publish-dkg'
  | 'register-emergency-onchain'
  | 'register-aviso-onchain'
  | 'sign-document'
  | 'sign-evidence'

export const GUIDE_AGENT_CONFIG = {
  /** Mostrar el modal de guía antes de acciones sensibles */
  enabled: true,
  /** Tipos de acción donde se muestra */
  enabledActions: [
    'publish-dkg',
    'register-emergency-onchain',
    'register-aviso-onchain',
    'sign-document',
  ] as GuideActionType[],
  /** Recordar "no volver a mostrar" por acción (localStorage) */
  rememberDismissed: true,
  /** Clave base localStorage para dismissed */
  dismissedStorageKey: 'nelai-guide-dismissed',
}

export function isGuideDismissed(actionType: GuideActionType): boolean {
  if (!GUIDE_AGENT_CONFIG.rememberDismissed) return false
  return localStorage.getItem(`${GUIDE_AGENT_CONFIG.dismissedStorageKey}-${actionType}`) === 'true'
}

export function setGuideDismissed(actionType: GuideActionType): void {
  if (GUIDE_AGENT_CONFIG.rememberDismissed) {
    localStorage.setItem(`${GUIDE_AGENT_CONFIG.dismissedStorageKey}-${actionType}`, 'true')
  }
}
