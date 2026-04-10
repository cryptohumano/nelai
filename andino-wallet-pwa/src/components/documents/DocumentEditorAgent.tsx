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
const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'El más reciente y rápido' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Equilibrado y estable' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Inteligencia máxima' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'Versión estable 1.5' },
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Array<{ mimeType: string; data: string; fileName: string }>
}

const MAX_FILE_SIZE_MB = 15
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png,image/webp'

const SYSTEM_PROMPT = `Eres un asistente de Nelai experto en redacción académica y profesional. Ayudas al usuario a pulir y expandir sus documentos.

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

REGLAS DE ORO:
- El texto en [MODIFICAR] debe ser una coincidencia IDÉNTICA (incluyendo puntos y comas) de lo que aparece en el documento.
- No uses estas etiquetas para respuestas generales, solo cuando sugieras cambios aplicables.
- Si el usuario te pide escribir algo totalmente nuevo (que no existe aún), simplemente escríbelo sin etiquetas y el usuario lo insertará al final.
- Responde siempre en español, con un tono profesional y servicial.`

export function DocumentEditorAgent({
  open,
  onOpenChange,
  documentContext,
  editorApiRef,
  initialMessages = [],
  onMessagesChange,
  onContentChange,
  appliedMods = {},
  onAppliedModsChange,
}: DocumentEditorAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Array<{ mimeType: string; data: string; fileName: string }>>([])
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

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(messages)
    }
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

      // Sobrescribir el modelo con el seleccionado por el usuario en el chat
      const activeConfig = { ...config, model: selectedModel }

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

      const res = await chatCompletion(activeConfig, chatMessages, {
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

  // Parsear la respuesta para extraer bloques de modificación
  const parseResponse = (content: string) => {
    const modifications: Array<{ original: string; replacement: string }> = []
    const regex = /\[MODIFICAR\]([\s\S]*?)\[\/MODIFICAR\]\s*\[POR\]([\s\S]*?)\[\/POR\]/g
    let match
    while ((match = regex.exec(content)) !== null) {
      modifications.push({ original: match[1].trim(), replacement: match[2].trim() })
    }
    const cleanText = content.replace(/\[MODIFICAR\][\s\S]*?\[\/MODIFICAR\]\s*\[POR\][\s\S]*?\[\/POR\]/g, '').trim()
    return { modifications, cleanText }
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
              const { modifications, cleanText } = parseResponse(msg.content)
              const isUser = msg.role === 'user'
              if (!msg.content.trim() && modifications.length === 0) return null

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
                      isUser ? "bg-indigo-600 shadow-indigo-600/20" : "bg-zinc-800 border border-white/5"
                    )}>
                      {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
                      {isUser ? 'Tú' : 'Nelai AI'}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "relative p-4 shadow-2xl border transition-all duration-300 break-words overflow-hidden",
                      isUser 
                        ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none border-indigo-500/50 max-w-[85%]" 
                        : "bg-zinc-900/95 backdrop-blur-xl text-zinc-100 rounded-2xl rounded-tl-none border-zinc-800 max-w-[90%]"
                    )}
                  >
                    <div className="text-[13px] leading-relaxed">
                      <MarkdownContent 
                        content={cleanText || (modifications.length > 0 ? "" : msg.content)} 
                        size="sm" 
                        className={cn(
                          "select-text",
                          isUser ? "text-white [&_p]:text-white" : "text-zinc-100"
                        )}
                      />
                      
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

                      {msg.role === 'assistant' && !modifications.length && (
                        <div className="mt-5 pt-4 border-t border-white/5">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 text-[11px] w-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-white/5 transition-all active:scale-95"
                            onClick={() => handleInsert(stripMarkdown(msg.content))}
                          >
                            <Copy className="h-3.5 w-3.5 mr-2 text-primary" />
                            {'Insertar contenido'}
                          </Button>
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
                    <span className="text-[11px] font-medium text-muted-foreground">Generando respuesta...</span>
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
