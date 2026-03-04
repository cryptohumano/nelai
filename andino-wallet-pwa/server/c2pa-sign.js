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

// CORS: permitir peticiones desde el frontend (localhost:5173 en desarrollo)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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
    const result = builder.sign(s, inputAsset, outputAsset)

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

app.listen(PORT, () => {
  console.log(`[C2PA] Servidor en http://localhost:${PORT}`)
  console.log('[C2PA] POST /api/c2pa-sign - Embeber manifiesto en PDF')
  console.log('[C2PA] GET  /api/c2pa-health - Estado del servicio')
})
