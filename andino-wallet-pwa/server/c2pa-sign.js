/**
 * Servidor para embeber manifiestos C2PA en PDFs.
 * Usa certificados de prueba (solo desarrollo).
 *
 * Ejecutar: node server/c2pa-sign.js
 * O: yarn c2pa-server
 */

import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import { Builder, LocalSigner } from '@contentauth/c2pa-node'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = join(__dirname, 'certs')
const PORT = process.env.C2PA_PORT || 3456

const app = express()

// CORS: permitir peticiones desde el frontend (localhost, GitHub Pages, etc.)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID, x-request-id, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, x-request-id')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json({ limit: '50mb' }))

let signer = null

function getSigner() {
  if (signer) return signer
  const certPath = join(CERTS_DIR, 'es256.pub')
  const keyPath = join(CERTS_DIR, 'es256.pem')
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error('Certificados C2PA no encontrados. Ejecuta: node server/download-certs.js')
  }
  const cert = fs.readFileSync(certPath)
  const key = fs.readFileSync(keyPath)
  signer = LocalSigner.newSigner(cert, key, 'es256')
  return signer
}

/**
 * Crea un Builder con el manifiesto C2PA para el documento.
 * Incluye contentHash, author, createdAt y assertion org.nelai.polkadot
 */
function createBuilder(metadata) {
  const builder = Builder.new({
    verify: {
      verify_after_sign: false,
      verify_trust: false,
    },
  })

  builder.setIntent({
    create: 'http://cv.iptc.org/newscodes/digitalsourcetype/composite',
  })

  // Assertion c2pa.actions (creado) - formato C2PA
  const actionsAssertion = {
    actions: [
      {
        action: 'c2pa.created',
        when: metadata.createdAt || new Date().toISOString(),
        software_agent: metadata.claimGenerator || 'Nelai Andino Wallet',
      },
    ],
  }
  builder.addAssertion('c2pa.actions', actionsAssertion, 'Cbor')

  // Assertion c2pa.hash.data (contentHash - hard binding)
  const contentHash = (metadata.contentHash || '').replace(/^0x/, '')
  if (contentHash) {
    const hashAssertion = {
      alg: 'sha256',
      hash: contentHash,
    }
    builder.addAssertion('c2pa.hash.data', hashAssertion, 'Cbor')
  }

  // Assertion custom org.nelai.polkadot (Polkadot identity + metadata)
  const polkadotAssertion = {
    address: metadata.author || '',
    signature: metadata.signature || '',
    contentHash: metadata.contentHash || '',
    createdAt: metadata.createdAt || new Date().toISOString(),
    title: metadata.title || '',
    documentId: metadata.documentId || '',
    claimGenerator: metadata.claimGenerator || 'Nelai Andino Wallet',
    ...(metadata.exifData && { exifData: metadata.exifData }),
  }
  builder.addAssertion('org.nelai.polkadot', polkadotAssertion, 'Json')

  return builder
}

app.post('/api/c2pa-sign', async (req, res) => {
  try {
    const { pdfBase64, metadata } = req.body
    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 es requerido' })
    }

    const buffer = Buffer.from(
      pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64,
      'base64'
    )

    const inputAsset = { buffer, mimeType: 'application/pdf' }
    const outputAsset = { buffer: null }

    const builder = createBuilder(metadata || {})
    const s = getSigner()
    const result = await builder.sign(s, inputAsset, outputAsset)

    const signedBase64 = result.toString('base64')
    res.json({ pdfBase64: signedBase64, success: true })
  } catch (err) {
    console.error('[C2PA] Error:', err)
    res.status(500).json({
      error: err.message || 'Error al firmar con C2PA',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })
  }
})

app.get('/api/c2pa-health', (_req, res) => {
  try {
    getSigner()
    res.json({ ok: true, c2pa: true })
  } catch (e) {
    res.status(503).json({ ok: false, c2pa: false, error: e.message })
  }
})

/**
 * Proxy para Gemini API — evita CORS en navegador.
 */
app.post('/api/llm-proxy', async (req, res) => {
  llmRequestCount++;
  const requestId = req.header('X-Request-ID') || 'internal-' + Date.now();
  const { apiKey, model, body } = req.body;
  const timestamp = new Date().toLocaleTimeString();
  
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-LLM-Total-Requests', llmRequestCount.toString());

  if (!apiKey) {
    console.error(`[${timestamp}] [LLM Proxy] [${requestId}] Error: Falta API Key`);
    return res.status(400).json({ error: 'API Key es requerida' });
  }

  const targetModel = model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

  console.log(`[${timestamp}] [LLM Proxy] [#${llmRequestCount}] [${requestId}] 🚀 Forwarding to Google: ${targetModel}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[${timestamp}] [LLM Proxy] [${requestId}] ❌ Google Error (${response.status})`);
      
      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Cuota de IA agotada en Google Cloud. Por favor espera 60s.',
          details: data
        });
      }
      return res.status(response.status).json(data);
    }

    console.log(`[${timestamp}] [LLM Proxy] [${requestId}] ✅ Success`);
    res.json(data);
  } catch (error) {
    console.error(`[${timestamp}] [LLM Proxy] [${requestId}] 🔥 Connection Error:`, error.message);
    res.status(500).json({ error: 'Error interno en el proxy de Nelai' });
  }
});

// Alias para evitar 404 si hay barras invertidas o inconsistencias
app.post('/api/llm-proxy/', (req, res) => res.redirect(307, '/api/llm-proxy'));
app.get('/api/llm-proxy-health', (req, res) => res.json({ status: 'ok', requests: llmRequestCount }));

/**
 * Lista los modelos disponibles en Google AI Studio para la API Key proporcionada.
 * GET /api/llm-models?key=TU_API_KEY
 */
app.get('/api/llm-models', async (req, res) => {
  const apiKey = req.query.key;
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key es requerida como query parameter (?key=...)' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    // Filtrar solo los que soportan generateContent para que sea más legible
    const chatModels = data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')) || [];
    
    res.json({
      total: data.models?.length || 0,
      chatModelsCount: chatModels.length,
      chatModels: chatModels.map(m => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar modelos' });
  }
});

app.listen(PORT, () => {
  console.log(`[C2PA] Servidor en http://localhost:${PORT}`)
  console.log('[C2PA] POST /api/c2pa-sign - Embeber manifiesto en PDF')
  console.log('[C2PA] POST /api/llm-proxy - Proxy Gemini (evita CORS)')
  console.log('[C2PA] GET  /api/c2pa-health - Estado del servicio')
})
