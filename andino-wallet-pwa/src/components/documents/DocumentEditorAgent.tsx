/**
 * Asistente IA para el editor de documentos
 * Permite al usuario interactuar con la IA y que la IA edite el documento
 */

import { useState, useRef, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bot, Send, Loader2, Copy, Paperclip, X } from 'lucide-react'
import { MarkdownContent, stripMarkdown } from '@/components/ui/markdown-content'
import { getActiveLLMConfig } from '@/config/llmConfig'
import { chatCompletion } from '@/services/nelai/llmClient'
import { toast } from 'sonner'
import type { EditorApi } from './RichTextEditor'

export interface DocumentEditorAgentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentContext: {
    title: string
    type: string
    description: string
    contentPlain: string
  }
  editorApiRef: React.RefObject<EditorApi | null>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Array<{ mimeType: string; data: string; fileName: string }>
}

const MAX_FILE_SIZE_MB = 15
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png,image/webp'

const SYSTEM_PROMPT = `Eres un asistente de Nelai que ayuda a crear y editar documentos. Tienes acceso al contenido actual del documento (título, tipo, descripción y texto). El usuario también puede adjuntar archivos (PDF, imágenes) para que los analices. Responde en español, de forma concisa y útil. Puedes:
- Sugerir mejoras al texto
- Expandir o resumir secciones
- Añadir cláusulas o párrafos
- Corregir redacción
- Explicar términos legales o técnicos
- Analizar documentos o imágenes adjuntos (resumir, extraer información, comparar)

Cuando el usuario pida que añadas o modifiques algo, responde con el texto listo para insertar en el documento. Si es una explicación o análisis, no incluyas texto para insertar.`

export function DocumentEditorAgent({
  open,
  onOpenChange,
  documentContext,
  editorApiRef,
}: DocumentEditorAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Array<{ mimeType: string; data: string; fileName: string }>>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasLLM, setHasLLM] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false) // Bloquea key repeat: Enter mantenido = 1 sola llamada

  useEffect(() => {
    getActiveLLMConfig().then((cfg) => setHasLLM(!!cfg?.apiKey))
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildContext = () => {
    const parts: string[] = []
    if (documentContext.title) parts.push(`Título: ${documentContext.title}`)
    if (documentContext.type) parts.push(`Tipo: ${documentContext.type}`)
    if (documentContext.description) parts.push(`Descripción: ${documentContext.description}`)
    if (documentContext.contentPlain) {
      const preview = documentContext.contentPlain.slice(0, 4000)
      parts.push(`Contenido actual del documento:\n${preview}${documentContext.contentPlain.length > 4000 ? '\n...' : ''}`)
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
    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userContent,
        attachments: attachments.length ? attachments.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName })) : undefined,
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

      const contextBlock = buildContext()
      const chatMessages = [
        { role: 'system' as const, content: SYSTEM_PROMPT + contextBlock },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          attachments: m.attachments,
        })),
        {
          role: 'user' as const,
          content: userContent,
          attachments: attachments.length ? attachments.map((a) => ({ mimeType: a.mimeType, data: a.data })) : undefined,
        },
      ]

      const res = await chatCompletion(config, chatMessages, {
        maxTokens: 2048,
        temperature: 0.7,
        googleSearch: config.provider === 'gemini', // Búsqueda web si el tier lo permite; fallback automático si no
      })

      if (res.error) {
        const is429 = res.error.includes('429')
        const msg = is429
          ? 'Límite de solicitudes alcanzado (429). Espera unos segundos e intenta de nuevo.'
          : `Error: ${res.error}`
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
        if (is429) toast.error('Demasiadas solicitudes. Espera un momento.')
        sendingRef.current = false
        return
      }

      if (res.truncated) {
        toast.warning('La respuesta se cortó por límite de tokens. Puedes pedir que continúe.')
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Error desconocido'}` },
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
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Asistente IA
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 mt-4">
          <ScrollArea className="flex-1 min-w-0 pr-4">
            <div className="space-y-4 min-w-0">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Puedo ayudarte a:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Expandir o mejorar párrafos</li>
                    <li>Añadir cláusulas o secciones</li>
                    <li>Resumir o simplificar texto</li>
                    <li>Corregir redacción</li>
                  <li>Analizar PDFs o imágenes que adjuntes</li>
                  </ul>
                  <p className="pt-2">Escribe tu solicitud, adjunta archivos si quieres que los analice, y usa &quot;Insertar&quot; para añadir mi respuesta al documento.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 min-w-0 overflow-hidden ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground ml-4' : 'bg-muted mr-4'
                  }`}
                >
                  <div className="min-w-0 break-words">
                    <MarkdownContent content={msg.content} size="sm" />
                    {msg.attachments?.length ? (
                      <p className="mt-2 text-xs opacity-80">
                        📎 {msg.attachments.length} archivo(s) adjunto(s)
                      </p>
                    ) : null}
                  </div>
                  {msg.role === 'assistant' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 text-xs"
                      onClick={() => handleInsert(stripMarkdown(msg.content))}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Insertar en documento
                    </Button>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                  <span className="text-xs opacity-80">
                    Puede incluir búsqueda web si tu cuenta está habilitada
                  </span>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="mt-4 space-y-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                  >
                    {a.fileName}
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="rounded p-0.5 hover:bg-muted-foreground/20"
                      aria-label="Quitar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Adjuntar PDF o imagen"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pide ayuda o adjunta un archivo para analizar..."
                rows={2}
                className="resize-none flex-1 min-w-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button
                variant="default"
                size="icon"
                onClick={handleSend}
                disabled={loading || (!input.trim() && attachments.length === 0)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
