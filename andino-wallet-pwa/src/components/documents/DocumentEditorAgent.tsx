/**
 * Asistente IA para el editor de documentos
 * Permite al usuario interactuar con la IA y que la IA edite el documento
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Paperclip,
  X,
  Bot,
  ArrowUp,
  Copy,
  User,
  FileCheck,
  Shield,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MarkdownContent,
  stripMarkdown,
} from '@/components/ui/markdown-content'
import { getActiveLLMConfig } from '@/config/llmConfig'
import { chatCompletion } from '@/services/nelai/llmClient'
import { toast } from 'sonner'
import type { EditorApi } from './RichTextEditor'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

export interface DocumentEditorAgentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Al cambiar de documento o al recargar desde almacenamiento, hidrata el chat */
  documentId?: string
  chatSessionKey?: number
  documentContext: {
    title: string
    type: string
    description: string
    contentPlain: string
  }
  editorApiRef: React.RefObject<EditorApi | null>
  initialMessages?: ChatMessage[]
  onMessagesChange?: (messages: ChatMessage[]) => void
  onContentChange?: (content: string, description: string) => void
  appliedMods?: Record<string, number>
  onAppliedModsChange?: (mods: Record<string, number>) => void
}

/** Lista de modelos Gemini disponibles para el usuario según su cuota actual */
/** IDs deben coincidir con models/... en la API (p. ej. gemini-3.x suelen publicarse como *-preview). */
const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Inteligencia máxima de frontera y agentic coding' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Velocidad extrema y razonamiento avanzado' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Modelo avanzado estable para tareas complejas' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Excelente balance precio-rendimiento y baja latencia' },
]

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Array<{ mimeType: string; data: string; fileName: string }>
  /** Error de API (429, red, etc.): presentación distinta, sin insertar en documento */
  isError?: boolean
  /** El modelo cortó por límite de salida (MAX_TOKENS) */
  truncated?: boolean
}

/** Mensajes antiguos o sin flag: detectar errores por texto */
function isAssistantErrorMessage(content: string): boolean {
  const c = content.trim()
  if (c.startsWith('Error:')) return true
  if (c.startsWith('⚠️')) return true
  if (c.includes('Límite de solicitudes de la IA')) return true
  if (c.includes('No hay API de IA configurada')) return true
  if (/^API error \d+/i.test(c)) return true
  return false
}

const MIN_CHARS_FOR_INSERT = 320

/** Recordatorio solo en la petición a la API; no se muestra en la burbuja del usuario. */
const SCORE_API_REMINDER = `

[Recordatorio interno Nelai: en análisis de documento o PDF, coloca PRIMERO el bloque [SCORE_LEGAL]…[/SCORE_LEGAL] (puntuación 1–100, nivel ALTO|MEDIO|BAJO, resumen, riesgos con |), y DESPUÉS el análisis detallado. No omitas el bloque.]`

function shouldRequireLegalScore(
  userText: string,
  hasAttachments: boolean,
  documentHasPlainContent: boolean
): boolean {
  if (hasAttachments) return true
  const t = userText.trim().toLowerCase()
  if (!t) return false
  if (t.includes('analiza') || t.includes('análisis') || t.includes('analizar')) return true
  if (t.includes('revisa') || t.includes('revisar') || t.includes('revisión')) return true
  if (t.includes('evalúa') || t.includes('evaluar') || t.includes('evaluación')) return true
  if (t.includes('compliant') || (t.includes('cumplimiento') && t.includes('ley'))) return true
  if (t.includes('ley mexicana') || /\bmexican[ao]\b/.test(t)) return true
  if (t.includes('fallas') || t.includes('oportunidades de mejora')) return true
  if (t.includes('riesgo') && (t.includes('documento') || t.includes('contrato'))) return true
  if (
    documentHasPlainContent &&
    /\b(documento|contrato|texto|cláusula|acuerdo)\b/.test(t) &&
    /\b(qué|opinión|vale|correcto|válido|problema)\b/.test(t)
  ) {
    return true
  }
  if (/^(continúa|continua|sigue|continúe|continúa el análisis)\b/i.test(t)) return true
  return false
}

export type ReferenceAttachment = { mimeType: string; data: string; fileName: string }

function mergeReferenceFiles(prev: ReferenceAttachment[], incoming: ReferenceAttachment[]): ReferenceAttachment[] {
  const byName = new Map<string, ReferenceAttachment>()
  for (const f of prev) byName.set(f.fileName, f)
  for (const f of incoming) byName.set(f.fileName, f)
  return Array.from(byName.values())
}

function collectAttachmentsFromMessages(msgs: ChatMessage[]): ReferenceAttachment[] {
  const byName = new Map<string, ReferenceAttachment>()
  for (const m of msgs) {
    if (m.role !== 'user' || !m.attachments?.length) continue
    for (const a of m.attachments) {
      const name = a.fileName?.trim() || 'adjunto'
      byName.set(name, { mimeType: a.mimeType, data: a.data, fileName: name })
    }
  }
  return Array.from(byName.values())
}

const MAX_FILE_SIZE_MB = 15
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png,image/webp'

/** Mensajes del hilo que se envían al modelo (sin contar system ni el turno actual). */
const RECENT_MESSAGE_WINDOW = 20

/**
 * Caracteres del documento en texto plano incluidos en el system prompt.
 * Alineado con ventanas de contexto grandes de Gemini 2.5+ (el modelo trunca si excede su límite).
 */
const DOC_CONTEXT_MAX_CHARS = 48_000

/**
 * Tokens de salida (maxOutputTokens) según familia de modelo, para no cortar respuestas largas (MAX_TOKENS).
 * Flash suele tener techo menor que Pro en la API de Google.
 */
function maxOutputTokensForAgentModel(modelId: string): number {
  const id = modelId.toLowerCase()
  if (id.includes('flash')) return 8192
  if (id.includes('2.5-pro') || id.includes('3.1-pro')) return 32_768
  return 16_384
}

const SYSTEM_PROMPT = `Eres un asistente legal y de redacción de Nelai, especializado en **leyes mexicanas** y redacción profesional/académica. Tienes conocimiento profundo de:
- Código Civil Federal y de los estados
- Código de Comercio
- Ley Federal del Trabajo
- Ley General de Sociedades Mercantiles
- Ley Federal de Protección al Consumidor
- Ley de Propiedad Industrial
- Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)
- NOM aplicables a contratos y documentos legales
- Jurisprudencia del SCJN y tribunales colegiados relevantes

CAPACIDADES DE EDICIÓN (FUNDAMENTAL):
Para proponer cambios que el usuario pueda aplicar con un click, DEBES usar este formato exacto:

1. PARA REEMPLAZAR:
[MODIFICAR]texto antiguo exacto[/MODIFICAR]
[POR]nuevo texto mejorado[/POR]

2. PARA INSERTAR TEXTO NUEVO EN UNA POSICIÓN ESPECÍFICA:
Identifica la frase anterior a donde quieres insertar. Úsala como ancla.
[MODIFICAR]frase de referencia[/MODIFICAR]
[POR]frase de referencia. NUEVO TEXTO AQUÍ.[/POR]

3. PARA ELIMINAR:
[MODIFICAR]texto a borrar[/MODIFICAR]
[POR][/POR]

4. PARA CONTENIDO NUEVO INSERTABLE:
Si el usuario pide que generes texto nuevo (cláusulas, párrafos, secciones) que NO es una modificación de texto existente, envuélvelo en:
[CONTENIDO]
El texto completo que el usuario puede insertar en su documento.
[/CONTENIDO]
Esto permite al usuario insertar SOLO el contenido útil, sin tus comentarios explicativos.

ANÁLISIS DE DOCUMENTOS (contratos, escritos, políticas, etc.):
Si el usuario sube un archivo, pide analizar/revisar/evaluar el documento del editor, o pide cumplimiento con la ley mexicana, evalúa al menos:
1. Validez formal (partes, objeto, causa, forma) cuando aplique
2. Cláusulas abusivas o leoninas (si es contrato)
3. Cumplimiento con legislación mexicana aplicable
4. Protección de datos personales (LFPDPPP) si hay datos personales
5. Jurisdicción y resolución de controversias cuando conste

PUNTUACIÓN LEGAL — OBLIGATORIA EN ANÁLISIS (SIEMPRE AL INICIO):
Cuando analices un PDF adjunto, el texto del editor o ambos, tu PRIMER bloque de contenido (antes de cualquier sección «ANÁLISIS» o explicación larga) debe ser exactamente este formato:
[SCORE_LEGAL]
puntuación: <número del 1 al 100>
nivel: <ALTO|MEDIO|BAJO>
resumen: <resumen de 1-2 líneas sobre la confianza legal>
riesgos: <lista separada por | de los riesgos encontrados>
[/SCORE_LEGAL]
Después del cierre [/SCORE_LEGAL], desarrolla el análisis detallado (validez, cláusulas, riesgos, etc.). No en saludos ni en correcciones puntuales de un solo párrafo sin evaluar el conjunto.
Si el usuario pide «continuar» el análisis, puedes omitir repetir [SCORE_LEGAL] en ese mensaje si solo amplías un punto; si reevalúas el documento, actualiza el score al inicio otra vez.

REGLAS DE ORO:
- El texto en [MODIFICAR] debe ser una coincidencia IDÉNTICA (incluyendo puntos y comas) de lo que aparece en el documento.
- No uses estas etiquetas para respuestas generales, solo cuando sugieras cambios aplicables.
- Usa [CONTENIDO]...[/CONTENIDO] para todo texto nuevo que el usuario debería poder insertar con un click.
- NUNCA mezcles tus comentarios conversacionales dentro de las etiquetas [CONTENIDO]. Los comentarios van FUERA.
- Responde siempre en español, con un tono profesional y servicial.
- Cuando cites artículos de ley, sé específico (ej: "Art. 2248 del Código Civil Federal").
- Si no estás seguro de un punto legal, indícalo claramente y recomienda consultar un abogado.
- En el primer mensaje de análisis sobre un documento/PDF o el contenido del editor, el bloque [SCORE_LEGAL] es obligatorio y debe ir al principio de la respuesta, antes del resto del texto.`

export function DocumentEditorAgent({
  open,
  onOpenChange,
  documentId,
  chatSessionKey = 0,
  documentContext,
  editorApiRef,
  initialMessages = [],
  onMessagesChange,
  onContentChange,
  appliedMods = {},
  onAppliedModsChange,
}: DocumentEditorAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const lastChatHydrateRef = useRef<{ doc: string; key: number }>({ doc: '', key: -1 })
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Array<{ mimeType: string; data: string; fileName: string }>>([])
  /** Archivos del hilo reenviados en cada petición (evita tener que volver a subirlos). */
  const [referenceFiles, setReferenceFiles] = useState<ReferenceAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasLLM, setHasLLM] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendingRef = useRef(false) // Bloquea key repeat: Enter mantenido = 1 sola llamada

  useEffect(() => {
    if (open) {
      document.body.classList.add('agent-open')
    } else {
      document.body.classList.remove('agent-open')
    }
    return () => document.body.classList.remove('agent-open')
  }, [open])

  useEffect(() => {
    getActiveLLMConfig().then((cfg) => setHasLLM(!!cfg?.apiKey))
  }, [open])

  /** Hidratar chat y adjuntos desde el documento al cargar o al cambiar de documento (no en cada actualización del padre). */
  useEffect(() => {
    const doc = documentId ?? ''
    if (lastChatHydrateRef.current.doc === doc && lastChatHydrateRef.current.key === chatSessionKey) {
      return
    }
    lastChatHydrateRef.current = { doc, key: chatSessionKey }
    setMessages(initialMessages)
    const merged = collectAttachmentsFromMessages(initialMessages)
    setReferenceFiles(merged.length > 0 ? merged : [])
  }, [documentId, chatSessionKey, initialMessages])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(messages)
    }
  }, [messages])

  const buildContext = (threadRefFiles?: ReferenceAttachment[]) => {
    const parts: string[] = []
    const ref = threadRefFiles ?? referenceFiles
    if (documentContext.title) parts.push(`Título: ${documentContext.title}`)
    if (documentContext.type) parts.push(`Tipo: ${documentContext.type}`)
    if (documentContext.description) parts.push(`Descripción: ${documentContext.description}`)
    if (ref.length) {
      parts.push(
        `Archivos adjuntos en contexto del chat (aplican a todo el hilo; no hace falta volver a subirlos): ${ref.map((f) => f.fileName).join(', ')}`
      )
    }
    if (documentContext.contentPlain) {
      const plain = documentContext.contentPlain
      const preview = plain.slice(0, DOC_CONTEXT_MAX_CHARS)
      parts.push(
        `Contenido actual del documento:\n${preview}${plain.length > DOC_CONTEXT_MAX_CHARS ? '\n[... documento truncado en contexto por longitud ...]' : ''}`
      )
    }
    return parts.length ? `\n\nContexto del documento:\n${parts.join('\n')}` : ''
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024
    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        toast.error(`${file.name} supera ${MAX_FILE_SIZE_MB} MB`)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.includes(',') ? result.split(',')[1] : result
        setAttachments((prev) => [...prev, { mimeType: file.type, data: base64, fileName: file.name }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const removeReferenceFile = (fileName: string) => {
    setReferenceFiles((prev) => prev.filter((f) => f.fileName !== fileName))
    toast.info('Archivo quitado del contexto del chat')
  }

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || loading || sendingRef.current) return
    sendingRef.current = true

    if (!hasLLM) {
      toast.error('Configura una API de IA en Configuración > IA (LLM)')
      sendingRef.current = false
      return
    }

    const userContent = text || 'Analiza este documento o archivo.'
    const hasAttachments = attachments.length > 0
    const userContentForApi =
      shouldRequireLegalScore(userContent, hasAttachments, !!documentContext.contentPlain?.trim())
        ? userContent + SCORE_API_REMINDER
        : userContent

    const incomingRef: ReferenceAttachment[] = hasAttachments
      ? attachments.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }))
      : []
    const effectiveRef = mergeReferenceFiles(referenceFiles, incomingRef)
    setReferenceFiles(effectiveRef)

    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userContent,
        attachments: hasAttachments ? attachments.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName })) : undefined,
      },
    ])
    setAttachments([])
    setLoading(true)

    try {
      const config = await getActiveLLMConfig()
      if (!config?.apiKey) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'No hay API de IA configurada. Ve a Configuración > IA (LLM).' }])
        sendingRef.current = false
        return
      }

      // Sobrescribir el modelo con el seleccionado por el usuario en el chat
      const activeConfig = { ...config, model: selectedModel }

      const contextBlock = buildContext(effectiveRef)

      // Historial solo texto: los adjuntos del hilo van en el último turno para no duplicar ni romper el alternado user/model.
      const recentThread = messages.slice(-RECENT_MESSAGE_WINDOW).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: undefined,
      }))

      const chatMessages = [
        { role: 'system' as const, content: SYSTEM_PROMPT + contextBlock },
        ...recentThread,
        {
          role: 'user' as const,
          content: userContentForApi,
          attachments:
            effectiveRef.length > 0
              ? effectiveRef.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }))
              : undefined,
        },
      ]

      const hasFileAttachments = chatMessages.some((m) => m.attachments?.length)
      const res = await chatCompletion(activeConfig, chatMessages, {
        maxTokens: maxOutputTokensForAgentModel(selectedModel),
        temperature: 0.7,
        // Grounding + PDF/imagen a veces devuelve 400 o comportamiento raro; sin archivos sí tiene sentido
        googleSearch: config.provider === 'gemini' && !hasFileAttachments,
      })

      if (res.error) {
        const is429 = res.error.includes('429') || res.content?.includes('Demasiadas solicitudes') || res.content?.includes('Cuota de IA')
        
        let msg = `Error: ${res.error}`
        if (is429) {
          msg = '⚠️ **Límite de solicitudes de la IA alcanzado (429).**\n\nEste modelo tiene límites estrictos en el nivel gratuito. Por favor:\n1. Espera **60 segundos**.\n2. Evita enviar archivos muy pesados repetidamente.\n3. Asegúrate de que el servidor proxy esté funcionando.'
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: msg, isError: true }])
        
        if (is429) {
          toast.error('Límite excedido (Rate Limit)', {
            description: 'Google Cloud ha limitado temporalmente tus peticiones. Espera 1 minuto.',
            duration: 8000
          })
        }
        sendingRef.current = false
        return
      }

      if (res.truncated) {
        toast.warning('La respuesta se cortó por límite de tokens. Puedes pedir que continúe.')
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.content, truncated: !!res.truncated },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
      sendingRef.current = false
    }
  }

  const handleInsert = (content: string) => {
    const api = editorApiRef?.current
    if (!api) {
      toast.error('El editor no está listo')
      return
    }
    api.insertAtCursor(content)
    toast.success('Texto insertado en el documento')
    
    if (onContentChange) {
      onContentChange(api.getContent(), 'Texto insertado por IA')
    }
  }

  const handleReplace = (original: string, replacement: string, msgKey: string, modIdx: number) => {
    const api = editorApiRef?.current
    if (!api) {
      toast.error('El editor no está listo')
      return
    }
    const success = api.replaceText(original, replacement)
    if (success) {
      toast.success('Texto modificado correctamente')
      
      // Registrar que esta mod fue aplicada con timestamp
      if (onAppliedModsChange) {
        onAppliedModsChange({
          ...appliedMods,
          [`${msgKey}-${modIdx}`]: Date.now()
        })
      }

      if (onContentChange) {
        onContentChange(api.getContent(), 'Sugerencia de IA aplicada')
      }
    } else {
      toast.error('No se encontró el texto original en el documento')
    }
  }

  // Parsear la respuesta para extraer bloques de modificación, contenido insertable y scores legales
  const parseResponse = (content: string) => {
    const modifications: Array<{ original: string; replacement: string }> = []
    const modRegex = /\[MODIFICAR\]([\s\S]*?)\[\/MODIFICAR\]\s*\[POR\]([\s\S]*?)\[\/POR\]/g
    let match
    while ((match = modRegex.exec(content)) !== null) {
      modifications.push({ original: match[1].trim(), replacement: match[2].trim() })
    }

    // Extraer bloques [CONTENIDO]...[/CONTENIDO]
    const insertableBlocks: string[] = []
    const contentRegex = /\[CONTENIDO\]([\s\S]*?)\[\/CONTENIDO\]/g
    while ((match = contentRegex.exec(content)) !== null) {
      const block = match[1].trim()
      if (block) insertableBlocks.push(block)
    }

    // Extraer score legal si existe
    let legalScore: { score: number; level: string; summary: string; risks: string[] } | null = null
    const scoreRegex = /\[SCORE_LEGAL\]([\s\S]*?)\[\/SCORE_LEGAL\]/
    const scoreMatch = scoreRegex.exec(content)
    if (scoreMatch) {
      const scoreBlock = scoreMatch[1]
      const scoreNum = scoreBlock.match(/puntuación:\s*(\d+)/)
      const level = scoreBlock.match(/nivel:\s*(\S+)/)
      const summary = scoreBlock.match(/resumen:\s*(.+)/)
      const risks = scoreBlock.match(/riesgos:\s*(.+)/)
      if (scoreNum && level) {
        legalScore = {
          score: parseInt(scoreNum[1], 10),
          level: level[1],
          summary: summary?.[1]?.trim() ?? '',
          risks: risks?.[1]?.split('|').map(r => r.trim()).filter(Boolean) ?? [],
        }
      }
    }

    // Limpiar tags del texto visible
    const cleanText = content
      .replace(/\[MODIFICAR\][\s\S]*?\[\/MODIFICAR\]\s*\[POR\][\s\S]*?\[\/POR\]/g, '')
      .replace(/\[CONTENIDO\][\s\S]*?\[\/CONTENIDO\]/g, '')
      .replace(/\[SCORE_LEGAL\][\s\S]*?\[\/SCORE_LEGAL\]/g, '')
      .trim()
    return { modifications, insertableBlocks, legalScore, cleanText }
  }

  return (
    <div className="flex flex-col h-full w-full bg-background border-l relative animate-in slide-in-from-right duration-300 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b shrink-0 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-foreground">Asistente IA</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 text-[10px] w-[130px] bg-muted/50 border-none transition-all hover:bg-muted">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-[10px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-[9px] opacity-60 line-clamp-1">{m.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" 
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {referenceFiles.length > 0 && (
        <div className="shrink-0 border-b border-primary/15 bg-primary/5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold text-foreground leading-tight">
                Documento en contexto (la IA lo usa en cada mensaje)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {referenceFiles.map((f) => (
                  <span
                    key={f.fileName}
                    className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[10px] border border-border text-foreground"
                  >
                    <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="max-w-[min(100%,14rem)] truncate">{f.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeReferenceFile(f.fileName)}
                      className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      title="Quitar del contexto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">
                No hace falta volver a adjuntar el mismo archivo en cada pregunta.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <ScrollArea className="flex-1 w-full overflow-hidden">
          <div className="flex flex-col gap-8 p-4 sm:p-6 w-full max-w-full overflow-x-hidden">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4 px-6 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/10 rotate-3">
                  <Bot className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="font-bold text-foreground text-base tracking-tight">¿En qué puedo ayudarte?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                  Prueba diciendo: "Mejora este párrafo", "Cambia el tono" o "Revisa la ortografía".
                </p>
              </div>
            )}
            
            {messages.map((msg, i) => {
              const { modifications, insertableBlocks, legalScore, cleanText } = parseResponse(msg.content)
              const isUser = msg.role === 'user'
              const isErr = !isUser && (msg.isError || isAssistantErrorMessage(msg.content))
              if (!msg.content.trim() && modifications.length === 0) return null

              const visibleMarkdown = cleanText || (modifications.length > 0 ? '' : msg.content)
              const plainForInsert = stripMarkdown(visibleMarkdown || msg.content).trim()

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col w-full animate-in slide-in-from-bottom-4 duration-500",
                    isUser ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2 mb-2 px-1",
                    isUser ? "flex-row-reverse" : "flex-row"
                  )}>
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shadow-md",
                      isUser ? "bg-indigo-600 shadow-indigo-600/20" : isErr
                        ? "bg-amber-950 border border-amber-500/40"
                        : "bg-zinc-800 border border-white/5"
                    )}>
                      {isUser ? (
                        <User className="h-4 w-4 text-white" />
                      ) : isErr ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Bot className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
                      {isUser ? 'Tú' : isErr ? 'Aviso del sistema' : 'Nelai AI'}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "relative p-4 shadow-2xl border transition-all duration-300 break-words overflow-hidden",
                      isUser 
                        ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none border-indigo-500/50 max-w-[85%]" 
                        : isErr
                          ? "bg-amber-950/50 backdrop-blur-xl text-amber-50 rounded-2xl rounded-tl-none border-amber-500/35 max-w-[90%]"
                          : "bg-zinc-900/95 backdrop-blur-xl text-zinc-100 rounded-2xl rounded-tl-none border-zinc-800 max-w-[90%]"
                    )}
                  >
                    <div className="text-[13px] leading-relaxed">
                      {!isUser && legalScore && !isErr && (
                        <div
                          className="mb-4 p-4 rounded-xl border shadow-lg"
                          style={{
                            background:
                              legalScore.score >= 70
                                ? 'rgba(34,197,94,0.07)'
                                : legalScore.score >= 40
                                  ? 'rgba(234,179,8,0.07)'
                                  : 'rgba(239,68,68,0.07)',
                            borderColor:
                              legalScore.score >= 70
                                ? 'rgba(34,197,94,0.2)'
                                : legalScore.score >= 40
                                  ? 'rgba(234,179,8,0.2)'
                                  : 'rgba(239,68,68,0.2)',
                          }}
                        >
                          <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                            Puntuación del documento
                          </p>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="relative w-14 h-14 shrink-0">
                              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.05)"
                                  strokeWidth="3"
                                />
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke={legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444'}
                                  strokeWidth="3"
                                  strokeDasharray={`${legalScore.score}, 100`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span
                                className="absolute inset-0 flex items-center justify-center text-sm font-black"
                                style={{
                                  color:
                                    legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444',
                                }}
                              >
                                {legalScore.score}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Shield
                                  className="h-4 w-4"
                                  style={{
                                    color:
                                      legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444',
                                  }}
                                />
                                <span
                                  className="text-[11px] font-black uppercase tracking-widest"
                                  style={{
                                    color:
                                      legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444',
                                  }}
                                >
                                  Confianza {legalScore.level}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">{legalScore.summary}</p>
                            </div>
                          </div>
                          {legalScore.risks.length > 0 && (
                            <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5">
                              <p className="text-[9px] uppercase tracking-widest font-black text-zinc-500">Riesgos detectados</p>
                              {legalScore.risks.map((risk, ri) => (
                                <div key={ri} className="flex items-start gap-2 text-[11px] text-zinc-400">
                                  <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                                  <span>{risk}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <MarkdownContent 
                        content={visibleMarkdown} 
                        size="sm" 
                        className={cn(
                          "select-text",
                          isUser ? "text-white [&_p]:text-white" : isErr ? "text-amber-50 [&_p]:text-amber-50 [&_strong]:text-amber-200" : "text-zinc-100"
                        )}
                      />

                      {isUser && msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
                          {msg.attachments.map((a, ai) => (
                            <span
                              key={`${a.fileName}-${ai}`}
                              className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[10px] font-medium text-white/95 border border-white/20"
                            >
                              <Paperclip className="h-3 w-3 shrink-0 opacity-90" />
                              <span className="max-w-[200px] truncate">{a.fileName}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.truncated && !isErr && (
                        <div
                          role="status"
                          className="mt-3 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-[11px] leading-snug text-amber-100/95"
                        >
                          <span className="font-semibold text-amber-300">Respuesta incompleta. </span>
                          El modelo alcanzó el límite de longitud. Escribe «continúa» o divide la pregunta para obtener el resto del análisis.
                        </div>
                      )}
                      
                      {modifications.length > 0 && (
                        <div className="mt-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <p className="text-[9px] uppercase tracking-widest font-black text-primary/80">Ediciones propuestas</p>
                            <div className="h-[1px] flex-1 bg-white/5" />
                          </div>
                          {modifications.map((mod, j) => {
                            const appliedTimestamp = appliedMods[`${i}-${j}`]
                            return (
                              <div 
                                key={j} 
                                className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] shadow-lg group/mod transition-all hover:border-primary/20"
                              >
                                <div className="flex items-start gap-1.5 mb-2 text-zinc-500 italic px-1 text-[10px] line-through opacity-50">
                                  &quot;{mod.original}&quot;
                                </div>
                                <div className="font-medium text-zinc-100 mb-4 leading-relaxed px-4 py-3 bg-zinc-800/50 rounded-lg border-l-2 border-primary shadow-inner">
                                  {mod.replacement}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={appliedTimestamp ? "outline" : "default"}
                                    size="sm"
                                    className={cn(
                                      "h-9 text-[11px] flex-1 font-bold transition-all shadow-md active:scale-95",
                                      !appliedTimestamp && "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    )}
                                    onClick={() => handleReplace(mod.original, mod.replacement, i.toString(), j)}
                                  >
                                    <Bot className="h-4 w-4 mr-2" />
                                    {appliedTimestamp ? 'Re-aplicar' : 'Aplicar cambio'}
                                  </Button>
                                  {appliedTimestamp && (
                                    <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20 shadow-lg shadow-green-500/5">
                                      <span className="text-[10px] text-green-500 font-black">✓</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Bloques de contenido insertable */}
                      {insertableBlocks.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <p className="text-[9px] uppercase tracking-widest font-black text-emerald-500/80">Contenido para insertar</p>
                            <div className="h-[1px] flex-1 bg-white/5" />
                          </div>
                          {insertableBlocks.map((block, bi) => (
                            <div key={bi} className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-500/10 text-[12px] leading-relaxed text-zinc-200">
                              <MarkdownContent content={block} size="sm" className="text-zinc-200 mb-3" />
                              <Button
                                variant="default"
                                size="sm"
                                className="h-9 text-[11px] w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-500/10 active:scale-95"
                                onClick={() => handleInsert(stripMarkdown(block))}
                              >
                                <FileCheck className="h-3.5 w-3.5 mr-2" />
                                Insertar en documento
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Acciones secundarias: copiar siempre en respuestas útiles; insertar solo si hay texto sustancial */}
                      {msg.role === 'assistant' && !isErr && !modifications.length && insertableBlocks.length === 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] text-zinc-400 hover:text-zinc-100"
                            onClick={() => {
                              void navigator.clipboard.writeText(plainForInsert || msg.content)
                              toast.success('Copiado al portapapeles')
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copiar
                          </Button>
                          {plainForInsert.length >= MIN_CHARS_FOR_INSERT && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] border-zinc-600 bg-zinc-800/40 hover:bg-zinc-800"
                              onClick={() => handleInsert(stripMarkdown(msg.content))}
                            >
                              <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                              Insertar en documento
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            
            {loading && (
              <div className="flex flex-col gap-2 self-start animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">Nelai AI</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl rounded-tl-none shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Generando respuesta…</span>
                      <span className="text-[10px] text-muted-foreground/70 leading-snug">
                        Si acabas de subir un PDF o el texto es muy largo, puede tardar un poco.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} className="h-4 shrink-0" />
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background/80 backdrop-blur-md sticky bottom-0 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="space-y-3">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-primary/5 px-2 py-1 text-[10px] border border-primary/10 text-primary-foreground font-medium">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[100px] truncate">{a.fileName}</span>
                    <button onClick={() => removeAttachment(i)} className="ml-1 p-0.5 hover:text-destructive bg-background rounded-full">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 bg-muted/30 p-1 rounded-2xl border border-muted-foreground/10 focus-within:border-primary/30 transition-all shadow-inner">
              <input 
                ref={fileInputRef} 
                type="file" 
                multiple 
                className="hidden" 
                onChange={handleFileSelect} 
                accept={ACCEPTED_TYPES}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl hover:bg-primary/5 text-muted-foreground transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta algo sobre el documento..."
                className="resize-none min-h-[40px] max-h-[150px] bg-transparent border-none shadow-none focus-visible:ring-0 text-[13px] py-1.5 placeholder:text-muted-foreground/50 transition-all font-medium"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button 
                onClick={handleSend} 
                disabled={loading || !input.trim()} 
                size="icon" 
                className={`h-10 w-10 shrink-0 rounded-xl transition-all shadow-md ${
                  input.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20' : 'bg-muted'
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[9px] text-center text-muted-foreground/40 font-medium">
              Nelai AI puede cometer errores. Verifica el contenido generado.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
