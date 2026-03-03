# Nelai — Plan de proyecto iSAFE Hackathon 2026 · Track 2

**Defend the Digital Citizen: AI for Protection and Empowerment**

Documento de planificación para una sesión de vibecoding. Objetivo: combinar **Andino Wallet PWA** (identidad Polkadot, bitácoras, emergencias), **firma criptográfica de metadata**, **agentes de explicación y verificación** y **OriginTrail DKG** para un ciudadano digital más informado y seguro.

---

## 1. Contexto

### 1.1 iSAFE Hackathon · Track 2

- **Track:** Defend the Digital Citizen — AI for Protection and Empowerment  
- **Enfoque:** Herramientas GenAI que eduquen, guíen y protejan a usuarios frente a estafas, fraude y desinformación.  
- **Criterios (resumen):** Innovación técnica 30%, Trust & Safety 25%, Impacto y usabilidad 20%, Escalabilidad/localización 15%, Presentación y ética 10%.  
- **Enlaces:** [CyberChallenge / iSAFE](https://www.cyberchallenge.net/), registros hasta 31 marzo 2026.

### 1.2 Base técnica: Andino Wallet PWA

- **Repo:** [cryptohumano/andino-wallet-pwa](https://github.com/cryptohumano/andino-wallet-pwa)  
- **Qué aporta:**
  - Identidad y firma con cuentas Polkadot (sr25519/ed25519), People Chain, multi-cadena.
  - PWA offline-first, bitácoras de montaña, evidencias fotográficas, avisos de salida, emergencias on-chain.
  - Documentos y credenciales con firma digital (identidad blockchain) y exportación PDF.
  - WebAuthn, cifrado local, wallet no custodial.
- **Gap a cubrir:** API Keys de servicios externos (puede no estar funcional); capa de **agentes** que expliquen y verifiquen; **firma sistemática de metadata** de todo documento/archivo.

### 1.3 OriginTrail DKG

- **Qué es:** Decentralized Knowledge Graph — memoria colectiva verificable para AI.  
- **Docs:** [OriginTrail Docs](https://docs.origintrail.io/)  
- **Uso en Nelai:**
  - Publicar **Knowledge Assets** (provenance de evidencias, bitácoras, documentos) con JSON-LD/Schema.org.
  - Trazabilidad y verificación: UAL (Uniform Asset Locator), assertions públicas/privadas.
  - **dkg.js** en frontend/Node para crear/consultar assets y (opcional) integrar con agentes que “lean” el grafo.
- **Referencia SDK:** [DKG JS Client](https://docs.origintrail.io/dkg-v6-current-version/dkg-sdk/dkg-v6-js-client), [Basic KA operations](https://docs.origintrail.io/getting-started/basic-knowledge-asset-operations).

---

## 2. Visión del producto: Nelai

**Nelai** = capa de agentes + firma de metadata sobre Andino Wallet, orientada a:

1. **Inmutabilidad y verificación:** Todo documento/archivo (bitácora, foto, aviso de salida, emergencia) tiene metadata firmada criptográficamente; opcionalmente anclada en DKG/blockchain.
2. **Educación del usuario:** Un agente **Guía** explica qué datos van on-chain, cuáles off-chain, riesgos de privacidad y verificabilidad.
3. **Verificación de terceros:** Un agente **Verificador** analiza metadata (y/o UAL/DKG) de contenido que “te mandan” y devuelve un reporte claro: dónde está la data, quién firmó, si es verificable.

Así se alinea con el Track 2: **proteger y empoderar** al ciudadano digital con explicabilidad y verificación, no solo con almacenamiento seguro.

---

## 3. Firma criptográfica de metadata

### 3.1 Principio

- **Cualquier** documento o archivo creado en la app debe tener **metadata firmada** antes de considerarse “registro oficial”.
- La firma usa la **identidad Polkadot** del usuario (keyring de Andino): mismo par de claves que ya se usa para emergencias/transacciones.
- Payload firmado: hash (o estructura canónica) de la metadata (tipo, fecha, autor, hash del contenido, coordenadas si aplica, etc.).

### 3.2 Contenido de la metadata a firmar (ejemplo)

- `version`, `type` (documento / foto / bitácora / aviso de salida / emergencia).
- `contentHash` (SHA-256 del contenido del archivo).
- `createdAt`, `author` (address o DID derivado de la cuenta Polkadot).
- `geolocation` (opcional), `relatedIds` (bitácora, emergencia).
- Cualquier campo que después el **Verificador** vaya a inspeccionar.

### 3.3 Flujo técnico (alto nivel)

1. Usuario crea/edita documento o sube archivo (foto, PDF, etc.).  
2. App construye objeto de metadata en formato canónico (ej. JSON ordenado o JSON-LD).  
3. Se calcula `contentHash` del blob y se añade a la metadata.  
4. Se pide firma al keyring (sr25519/ed25519) sobre el hash de la metadata (ej. blake2/sha256).  
5. Se guarda: `metadata + signature + publicKey` (y opcionalmente `blockchain + block/tx` si se ancla on-chain o en DKG).  
6. En flujos “registro on-chain” o “publicar en DKG”, el agente **Guía** puede explicar qué parte de esa metadata irá on-chain/DKG y qué riesgos implica.

### 3.4 Dónde encaja en Andino

- Reutilizar **Polkadot.js Keyring** y flujo de “sign payload” ya usado en la wallet.  
- Añadir un módulo `metadata-signing` que: normalice metadata → hash → firma → adjunte signature al objeto.  
- Persistir en IndexedDB (como el resto de Andino) la tripla `(documento/archivo, metadata, signature)`.

---

## 4. Agentes

### 4.1 Agente Guía (“¿Qué va dónde?”)

- **Objetivo:** Explicar al usuario, en lenguaje claro, qué pasa cuando hace un “registro on-chain” (o publicación en DKG) con su identidad digital.  
- **Insumos:** Tipo de acción (ej. “registrar aviso de salida”, “publicar evidencia en DKG”, “firmar bitácora”), datos que se van a incluir (campos de metadata).  
- **Salidas:**
  - Qué datos son **on-chain** (públicos, inmutables, visibles por quien escanee la chain).  
  - Qué datos son **off-chain** (solo en tu dispositivo, en DKG privado, etc.).  
  - Riesgos de **privacidad** (ej. coordenadas o nombres en chain).  
  - Qué implica **verificabilidad** (cualquiera con tu address y la firma puede comprobar autenticidad).  
- **Implementación:**  
  - Opción A: prompts + LLM (API key en Andino o backend propio) con contexto fijo (Schema.org, Polkadot, DKG).  
  - Opción B: flujos rule-based + plantillas de texto, sin LLM, para MVP.  
  - La **API Keys** de Andino (si se hace funcional) puede servir para configurar el endpoint del modelo o del backend del agente.

### 4.2 Agente Verificador (“Reporte de lo que te mandan”)

- **Objetivo:** El usuario recibe algo (archivo, enlace a UAL, JSON con metadata). El agente revisa la metadata (y opcionalmente DKG) y devuelve un **reporte legible**.  
- **Insumos:** Archivo o metadata + firma (o UAL de un Knowledge Asset).  
- **Salidas (reporte):**
  - **Dónde está la data:** solo local, solo chain, DKG (y UAL), mix.  
  - **Quién firmó:** address/DID si está disponible; si la firma verifica contra el payload.  
  - **Integridad:** si `contentHash` coincide con el archivo actual.  
  - **Resumen de riesgos:** datos sensibles expuestos on-chain, etc.  
- **Implementación:**  
  - Parser de metadata + verificación criptográfica (signature vs payload) en cliente.  
  - Si hay UAL: usar **dkg.js** `asset.get(UAL)` y resumir assertions en lenguaje natural (con o sin LLM).  
  - Opcional: pequeño backend que reciba solo hashes/UALs (sin PII) y devuelva resumen para no cargar el cliente.

---

## 5. Integración con OriginTrail DKG

- **Publicación:** Cuando el usuario “protege” una evidencia o bitácora en el grafo, la app puede crear un **Knowledge Asset** (JSON-LD, Schema.org) con:  
  - Referencia al `contentHash`, autor (address o DID), tipo de recurso, fecha.  
  - Assertions **públicas** (lo mínimo para verificación) vs **privadas** (solo en tu nodo).  
- **Verificación:** El Verificador, dado un UAL, usa `dkg.asset.get(UAL)` y traduce el resultado a un reporte (origen, autor, integridad).  
- **Requisitos:** Conexión a un **gateway DKG** (local o hospedado); en browser puede usarse dkg.js con endpoint configurado (y, si hace falta, API key de Andino para el gateway).  
- **Privacidad:** Diseñar qué va en assertions públicas (evitar PII en chain/DKG salvo que el usuario lo acepte explícitamente tras la explicación del Guía).

---

## 6. API Keys y servicios externos (Andino)

- Andino menciona configuración de APIs para servicios externos; si hoy no está funcional, el plan incluye **hacer funcional** un módulo de API Keys (guardado seguro en IndexedDB, cifrado con la misma capa que el resto de la wallet).  
- Uso previsto:  
  - Clave para backend/LLM del **Agente Guía** (o del Verificador si se usa LLM para resumir).  
  - Clave o endpoint para **OriginTrail** (gateway DKG o OT-Node hospedado).  
- Las keys no deben salir del dispositivo sino usarse en requests que haga el cliente (o un backend propio que el usuario configure).

---

## 7. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NELAI (capa sobre Andino)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Agente Guía              │  Agente Verificador                         │
│  (explicar on/off-chain,  │  (reporte de metadata + firma + UAL)          │
│   riesgos, verificabilidad)│                                              │
├───────────────────────────┴──────────────────────────────────────────────┤
│  Metadata signing layer                                                  │
│  (metadata canónica → hash → firma Polkadot → persistencia)              │
├─────────────────────────────────────────────────────────────────────────┤
│  Andino Wallet PWA                                                       │
│  (Keyring Polkadot, bitácoras, emergencias, documentos, PWA, WebAuthn)   │
├─────────────────────────────────────────────────────────────────────────┤
│  Persistencia (IndexedDB)  │  Opcional: DKG (dkg.js) / Chain (Dedot)     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Firma:** siempre en cliente (keyring).  
- **DKG:** cliente con dkg.js + gateway; opcional backend proxy si se quiere ocultar keys o hacer caching.  
- **Agentes:** cliente + (opcional) backend con LLM para respuestas más ricas.

---

## 8. Entregables sugeridos (iSAFE)

- **Código:** Fork o módulos sobre [andino-wallet-pwa](https://github.com/cryptohumano/andino-wallet-pwa) con:  
  - Módulo de firma de metadata.  
  - Integración dkg.js (crear/obtener Knowledge Assets).  
  - Flujos UI para Agente Guía y Agente Verificador.  
  - API Keys funcionales para servicios externos.  
- **Demo:** Video 3–5 min mostrando: crear documento → firma de metadata → explicación del Guía → verificación de un archivo/UAL con el Verificador.  
- **Documentación:** README de Nelai, alineación con Track 2 (protección y empoderamiento del ciudadano digital), uso de identidad y verificación.

---

## 9. Roadmap (orden sugerido)

| Fase | Qué hacer |
|------|-----------|
| **1. Base** | Clonar/explorar andino-wallet-pwa; levantar entorno; identificar dónde se firma hoy y dónde está la config de API keys. |
| **2. Metadata signing** | Diseñar esquema de metadata (JSON/JSON-LD); implementar normalización, hash y firma con keyring; guardar signature junto a cada documento/archivo. |
| **3. Agente Verificador (MVP)** | Sin LLM: parsear metadata + firma, verificar firma y contentHash, generar reporte fijo (dónde está la data, quién firmó, integridad). |
| **4. DKG** | Integrar dkg.js; flujo “publicar evidencia como Knowledge Asset”; en Verificador, si hay UAL, llamar `get(UAL)` y mostrar resumen. |
| **5. Agente Guía** | Flujos “antes de registrar on-chain / publicar en DKG”: texto explicativo (plantillas o LLM) sobre qué va dónde, riesgos y verificabilidad. |
| **6. API Keys** | Hacer funcional el almacenamiento y uso de API keys para LLM y/o gateway DKG. |
| **7. Pulido** | UX, copy en español, documentación y video para el hackathon. |

---

## 10. Referencias

- [iSAFE Hackathon 2026](https://www.cyberchallenge.net/) — Track 2.  
- [Andino Wallet PWA](https://github.com/cryptohumano/andino-wallet-pwa).  
- [OriginTrail Docs](https://docs.origintrail.io/).  
- [DKG JS Client (dkg.js)](https://docs.origintrail.io/dkg-v6-current-version/dkg-sdk/dkg-v6-js-client).  
- [Basic Knowledge Asset operations](https://docs.origintrail.io/getting-started/basic-knowledge-asset-operations).  

---

*Documento vivo para sesión de vibecoding. Próximo paso: elegir Fase 1 (base) y empezar por clonar/explorar Andino y definir el esquema de metadata.*
