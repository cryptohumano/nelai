# Servidor C2PA para Content Credentials

Este servidor embebe manifiestos **Content Credentials (C2PA)** en los PDFs firmados, permitiendo que cualquier validador estándar (p. ej. extensión Content Credentials, Adobe) pueda verificar la procedencia.

## Requisitos

- Node.js 18+
- Certificados de prueba en `server/certs/` (ver abajo)

## Uso

```bash
# En una terminal, iniciar el servidor
yarn c2pa-server
```

El servidor escucha en `http://localhost:3456` por defecto. Para cambiar el puerto:

```bash
C2PA_PORT=4000 yarn c2pa-server
```

## Certificados de prueba

Los certificados están en `server/certs/`:

- `es256.pem` - Clave privada (desarrollo)
- `es256.pub` - Cadena de certificados

Se obtienen del repositorio [c2pa-rs](https://github.com/contentauth/c2pa-rs/tree/main/sdk/tests/fixtures/certs).

**Importante:** Estos certificados son solo para desarrollo. En producción debes usar certificados X.509 válidos según el [modelo de confianza C2PA](https://opensource.contentauthenticity.org/docs/signing/get-cert).

## API

### POST /api/c2pa-sign

Embebe un manifiesto C2PA en un PDF.

**Body:**
```json
{
  "pdfBase64": "base64-del-pdf",
  "metadata": {
    "contentHash": "0x...",
    "author": "5GrwvaEF...",
    "signature": "0x...",
    "createdAt": "2025-03-04T...",
    "title": "Mi documento",
    "documentId": "uuid",
    "claimGenerator": "Nelai Andino Wallet"
  }
}
```

**Respuesta:**
```json
{
  "pdfBase64": "base64-del-pdf-con-manifiesto",
  "success": true
}
```

### GET /api/c2pa-health

Comprueba si el servicio está disponible y los certificados cargados.

### POST /api/llm-proxy

**Proxy para Gemini API** — evita CORS cuando la PWA está desplegada (p. ej. GitHub Pages). La API de Google no soporta CORS desde el navegador.

**Body:**
```json
{
  "apiKey": "tu-api-key-de-google",
  "model": "gemini-2.0-flash",
  "body": { "contents": [...], "generationConfig": {...} }
}
```

Configura en la PWA: Configuración > IA > Proxy URL = `https://tu-servidor.com/api/llm-proxy`

## Integración con la PWA

La PWA llama al servidor cuando el usuario firma un documento (si está disponible). Si el servidor no está corriendo, la firma funciona igual pero sin manifiesto C2PA embebido.

Configuración opcional en `.env`:
```
VITE_C2PA_API_URL=http://localhost:3456
```
