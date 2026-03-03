/**
 * Agente Guía — Servicio de explicación antes de acciones sensibles
 */

import type { GuideActionType } from '@/config/guideAgent'
import { GUIDE_TEMPLATES } from '@/config/guideAgentTemplates'

export interface GuideContext {
  actionType: GuideActionType
  fieldsToPublish?: string[]
  hasGeolocation?: boolean
  hasPersonalData?: boolean
}

export interface GuideResult {
  title: string
  content: string
  sections?: { heading: string; body: string }[]
}

/**
 * Obtiene el contenido explicativo para el Agente Guía (plantillas locales).
 */
export function getGuideContent(ctx: GuideContext): GuideResult {
  const template = GUIDE_TEMPLATES[ctx.actionType]
  if (!template) {
    return {
      title: 'Antes de continuar',
      content: 'Esta acción puede tener implicaciones de privacidad. Revisa qué datos se harán públicos.',
    }
  }
  return {
    title: template.title,
    content: template.content,
    sections: template.sections,
  }
}
