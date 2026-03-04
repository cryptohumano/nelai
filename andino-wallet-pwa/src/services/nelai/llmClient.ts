/**
 * Cliente LLM para agentes Nelai — OpenAI, Anthropic y Gemini
 */

import type { LLMApiConfig } from '@/config/llmConfig'

export interface ChatMessageAttachment {
  mimeType: string
  data: string // base64
  fileName?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** Adjuntos (PDF, imágenes). Solo Gemini los procesa nativamente. */
  attachments?: ChatMessageAttachment[]
}

export interface LLMResponse {
  content: string
  error?: string
  /** true si la respuesta se cortó por límite de tokens */
  truncated?: boolean
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone?: (truncated?: boolean) => void
}

/**
 * 429: Gemini limita por RPM (requests/min), TPM, RPD.
 * No reintentar agresivamente: cada retry cuenta contra el límite.
 * Ver https://ai.google.dev/gemini-api/docs/rate-limits
 */
const RETRY_DELAY_MS = 60_000 // 1 min para RPM
const MAX_RETRIES_429 = 1

/** Reintentos para errores de red transitorios (ERR_HTTP2_PROTOCOL_ERROR, Failed to fetch) */
const MAX_RETRIES_NETWORK = 2
const NETWORK_RETRY_DELAY_MS = 3000

/** Contador de solicitudes por sesión (para depuración de límites) */
let sessionRequestCount = 0

/**
 * Sanitiza un valor para usarlo en cabeceras HTTP.
 * Las cabeceras solo aceptan ISO-8859-1; caracteres fuera de ese rango causan
 * "Failed to read 'headers' from RequestInit: String contains non ISO-8859-1 code point".
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\u0000-\u00FF]/g, '').trim()
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries429 = MAX_RETRIES_429,
  retriesNetwork = MAX_RETRIES_NETWORK
): Promise<Response> {
  sessionRequestCount += 1
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (retriesNetwork > 0 && (err instanceof TypeError || err instanceof Error)) {
      console.warn(`[LLM] Error de red (${err instanceof Error ? err.message : 'Failed to fetch'}). Reintentando en ${NETWORK_RETRY_DELAY_MS / 1000}s (${retriesNetwork} restantes)`)
      await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAY_MS))
      return fetchWithRetry(url, init, retries429, retriesNetwork - 1)
    }
    throw err
  }
  console.log(`[LLM] Solicitud #${sessionRequestCount} → ${res.status} ${res.ok ? '✓' : '✗'}`)
  if (res.status !== 429 || retries429 <= 0) return res
  const retryAfter = res.headers.get('Retry-After')
  const parsed = parseInt(retryAfter || '', 10)
  const delayMs = retryAfter && !isNaN(parsed) ? Math.min(parsed * 1000, 120_000) : RETRY_DELAY_MS
  console.warn(`[LLM] 429 Rate limit. Esperando ${delayMs / 1000}s antes de reintentar (${retries429} restantes)`)
  await new Promise((r) => setTimeout(r, delayMs))
  return fetchWithRetry(url, init, retries429 - 1, retriesNetwork)
}

export interface ChatCompletionOptions {
  maxTokens?: number
  temperature?: number
  /** Solo Gemini: habilita Google Search (grounding). Si falla, fallback sin búsqueda. */
  googleSearch?: boolean
}

/**
 * Llama a la API de chat. Soporta OpenAI, Anthropic y Gemini.
 * Los adjuntos (PDF, imágenes) solo funcionan con Gemini.
 */
export async function chatCompletion(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<LLMResponse> {
  const hasAttachments = messages.some((m) => m.attachments?.length)
  if (hasAttachments && config.provider !== 'gemini') {
    return {
      content: '',
      error: 'El análisis de archivos (PDF, imágenes) solo está disponible con Gemini. Cambia el proveedor en Configuración > IA (LLM).',
    }
  }

  console.log('[LLM] chatCompletion', config.provider, config.model, 'msgs:', messages.length)
  if (config.provider === 'anthropic') {
    return anthropicChat(config, messages, options)
  }
  if (config.provider === 'gemini') {
    return geminiChat(config, messages, options)
  }
  return openAIChat(config, messages, options)
}

/**
 * Chat con streaming (modo agente). Solo Gemini por ahora.
 * Muestra la respuesta progresivamente y detecta truncación.
 */
export async function chatCompletionStream(
  config: LLMApiConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: ChatCompletionOptions
): Promise<{ content: string; error?: string; truncated?: boolean }> {
  if (config.provider === 'gemini' && config.proxyUrl) {
    // Con proxy no hay streaming; usar chatCompletion y simular
    const res = await chatCompletion(config, messages, options)
    if (res.error) return res
    callbacks.onChunk(res.content)
    callbacks.onDone?.(res.truncated)
    return res
  }
  if (config.provider === 'gemini') {
    return geminiChatStream(config, messages, callbacks, options)
  }
  // Fallback: llamada normal y simular streaming con el contenido completo
  const res = await chatCompletion(config, messages, options)
  if (res.error) return res
  callbacks.onChunk(res.content)
  callbacks.onDone?.(res.truncated)
  return res
}

async function openAIChat(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<LLMResponse> {
  const baseUrl = config.endpoint?.trim() || 'https://api.openai.com/v1'
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`

  const body = {
    model: config.model || 'gpt-4o-mini',
    messages,
    max_tokens: options?.maxTokens ?? 500,
    temperature: options?.temperature ?? 0.7,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sanitizeHeaderValue(config.apiKey)}`,
  }

  try {
    const res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    return content ? { content } : { content: '', error: 'Formato de respuesta no reconocido' }
  } catch (err) {
    console.error('[LLM] Error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

async function anthropicChat(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<LLMResponse> {
  const baseUrl = config.endpoint?.trim() || 'https://api.anthropic.com'
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: config.model || 'claude-3-5-haiku-20241022',
    max_tokens: options?.maxTokens ?? 500,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  }
  if (systemMsg) body.system = systemMsg.content
  if (options?.temperature != null) body.temperature = options.temperature

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': sanitizeHeaderValue(config.apiKey),
    'anthropic-version': '2023-06-01',
  }

  try {
    const res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const content = data.content?.[0]?.text
    return content ? { content } : { content: '', error: 'Formato de respuesta no reconocido' }
  } catch (err) {
    console.error('[LLM] Error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

async function geminiChat(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<LLMResponse> {
  const useGoogleSearch = options?.googleSearch === true
  const model = config.model || 'gemini-2.0-flash'
  const proxyUrl = config.proxyUrl?.trim()

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')

  const contents = chatMsgs.map((m) => {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
    if (m.content) parts.push({ text: m.content })
    if (m.attachments?.length) {
      for (const att of m.attachments) {
        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } })
      }
    }
    if (parts.length === 0) parts.push({ text: '(archivo adjunto)' })
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })

  const buildBody = (withTools: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 500,
        temperature: options?.temperature ?? 0.7,
      },
    }
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] }
    }
    if (withTools) {
      body.tools = [{ google_search: {} }]
    }
    return body
  }

  const doRequest = (withTools: boolean) => {
    const body = buildBody(withTools)
    if (proxyUrl) {
      // Usar proxy para evitar CORS (la API de Gemini no soporta CORS desde navegador)
      const url = proxyUrl.replace(/\/$/, '')
      return fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: config.apiKey, model, body }),
      })
    }
    const baseUrl = config.endpoint?.trim() || 'https://generativelanguage.googleapis.com/v1beta'
    const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent`
    return fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': sanitizeHeaderValue(config.apiKey),
      },
      body: JSON.stringify(body),
    })
  }

  try {
    let res = useGoogleSearch ? await doRequest(true) : await doRequest(false)

    // Si falló con google_search (400, 403, etc.), reintentar sin tools
    if (!res.ok && useGoogleSearch) {
      console.warn('[LLM] Google Search no disponible, usando modo estándar')
      res = await doRequest(false)
    }

    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
    }
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text
    const truncated = candidate?.finishReason === 'MAX_TOKENS'
    return text ? { content: text, truncated } : { content: '', error: 'Formato de respuesta no reconocido' }
  } catch (err) {
    console.error('[LLM] Error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

async function geminiChatStream(
  config: LLMApiConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: ChatCompletionOptions
): Promise<{ content: string; error?: string; truncated?: boolean }> {
  const baseUrl = config.endpoint?.trim() || 'https://generativelanguage.googleapis.com/v1beta'
  const model = config.model || 'gemini-2.0-flash'
  const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:streamGenerateContent`

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    },
  }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }
  if (options?.googleSearch) {
    body.tools = [{ google_search: {} }]
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-goog-api-key': sanitizeHeaderValue(config.apiKey),
  }

  try {
    let res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok && options?.googleSearch) {
      delete body.tools
      res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    }
    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }

    const reader = res.body?.getReader()
    if (!reader) return { content: '', error: 'Stream no disponible' }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let truncated = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]' || trimmed === 'data:') continue
        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
        try {
          const json = JSON.parse(jsonStr) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> }
              finishReason?: string
            }>
          }
          const candidate = json.candidates?.[0]
          const text = candidate?.content?.parts?.[0]?.text
          if (text) {
            fullContent += text
            callbacks.onChunk(text)
          }
          if (candidate?.finishReason === 'MAX_TOKENS') truncated = true
        } catch {
          // Ignorar líneas JSON inválidas
        }
      }
    }

    callbacks.onDone?.(truncated)
    return { content: fullContent, truncated }
  } catch (err) {
    console.error('[LLM] Stream error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}
