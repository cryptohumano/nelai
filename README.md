# Nelai

Capa de **agentes de explicación y verificación** + **firma criptográfica de metadata** sobre [Andino Wallet PWA](https://github.com/cryptohumano/andino-wallet-pwa), para el **iSAFE Hackathon 2026 — Track 2: Defend the Digital Citizen**.

---

## Qué es esto

- **Andino Wallet** ya ofrece: identidad Polkadot, bitácoras de montaña, emergencias on-chain, documentos firmados, PWA offline.
- **Nelai** añade:
  1. **Metadata firmada** para todo documento/archivo (qué se registró, quién, cuándo, integridad).
  2. **Agente Guía:** explica al usuario qué datos van on-chain / off-chain, riesgos de privacidad y verificabilidad antes de registrar.
  3. **Agente Verificador:** analiza metadata (y opcionalmente UAL de OriginTrail DKG) de contenido que te envían y devuelve un reporte claro.

Objetivo: que el ciudadano digital entienda y pueda **verificar** el origen e integridad de la información, alineado con [iSAFE](https://www.cyberchallenge.net/) y con trazabilidad vía [OriginTrail DKG](https://docs.origintrail.io/).

---

## Estructura del repo

```
nelai/
├── README.md                 # Este archivo
├── PLAN.md                   # Plan maestro: contexto, visión, arquitectura, roadmap
├── andino-wallet-pwa/        # Clone del repo base (listo para integrar Nelai)
└── docs/
    ├── SCHEMA_METADATA_FIRMA.md   # Esquema de metadata y flujo de firma/verificación
    ├── AGENTES_IMPLEMENTACION.md  # Cómo implementar Guía y Verificador (MVP + LLM)
    ├── INTEGRACION_ANDINO_ORIGINTRAIL.md  # Andino + DKG
    ├── SCOPE_NELAI_QUE_SALVAR.md  # Análisis: qué conservar/adaptar/diferir del scope estratégico
    ├── REVISION_RAMA_ASYNC_LOGBOOK.md  # Revisión de la rama feature/async-logbook y encaje con Nelai
    ├── PROXIMOS_PASOS.md  # Orden de implementación: firma metadata → Verificador → DKG → Guía → API Keys
    ├── NELAI_SIN_BLOCKCHAIN_Y_PERSISTENCIA.md  # Cripto, agentes y persistencia sin chain; offline, centralizado, descentralizado; redes sociales
    ├── CONTENT_CREDENTIALS_C2PA_VINCULACION.md  # Content Credentials/C2PA como estándar base + Polkadot; diseño dual y roadmap
    ├── ESTRATEGIA_GENERALIZACION_NELAI.md  # Nombres genéricos vs dominio (bitácoras, documentos); UI genérica; agente para crear/firmar documentos
    └── FLUJO_USUARIO_Y_CODIGO_NELAI.md  # Flujo de usuario (evidencias en bitácora) y zonas de código en Andino para Paso 1
```

**Andino** está clonado en `andino-wallet-pwa/` desde la rama **`feature/async-logbook`** ([origen](https://github.com/cryptohumano/andino-wallet-pwa/tree/feature/async-logbook)). Tras revisar el código, el documento **SCOPE_NELAI_QUE_SALVAR.md** resume qué salvar del scope hecho con otro agente (KILT, C2PA, Aura, etc.) y qué alinear con lo que Andino ya tiene.

---

## Referencias

- [iSAFE Hackathon 2026](https://www.cyberchallenge.net/) — Track 2
- [Andino Wallet PWA](https://github.com/cryptohumano/andino-wallet-pwa)
- [OriginTrail Docs](https://docs.origintrail.io/)
- [DKG JS Client (dkg.js)](https://docs.origintrail.io/dkg-v6-current-version/dkg-sdk/dkg-v6-js-client)

---

*Sesión de vibecoding — plan listo para pasar a implementación.*
