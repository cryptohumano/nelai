# Aura Wallet x Nelai AI 🚀
### SoftServe AgentX Hackathon 2026 Entry

> **Note on Language:** While the documentation is in English, the **Nelai AI Agent** currently functions and communicates in **Spanish**.

**Aura Wallet** is an ambitious project for **Generalized Digital Identity**. For this hackathon, we present an advanced implementation using the technical structure of **Andino Wallet**, chosen for its maturity in security management, offline capabilities, and blockchain signatures.

Our vision is to transform legal interaction through the convergence of Self-Sovereign Identity (SSI), Blockchain, and AI Agents.

---

## 🤖 Nelai AI: The R&D Agentic Engine
Nelai is not just an assistant; it is an **R&D workspace** designed for generating technical knowledge and co-creating **legal contracts with technical validity**.

### 🛠️ Agentic Vision & LegalTech (Hackathon Focus)
- **Non-Repudiation Documents**: Nelai assists in creating documents directly linked to the user's blockchain identity. Currently, content verification is achieved by signing the payload with a **Substrate (Polkadot) signature** and generating a unique hash, which can be verified by third parties via QR codes by contrasting the metadata with the original document.
- **Dual Identity (User + Agent)**: We project a future where both the user and the Agent (Nelai) possess executive powers based on verifiable credentials.
- **Content Credentials & Origin Trail**: Future integration with **Origin Trail (Decentralized Knowledge Graphs - dKG)** is planned to anchor journalistic and scientific content on-chain, ensuring long-term verifiability.
- **Legal Compliance Pipeline (Researching)**: We are currently researching the pipeline to transform the agent into a daily assistant for lawyers. This includes a future **Reliability Score** to evaluate text validity before signing.
- **Hybrid Innovation & Privacy-First Backend**: Our "true backend" is the **Polkadot blockchain**, which handles assets and digital identity. The current Node.js server is intentionally minimal, designed solely to handle API keys securely. This PWA + minimal backend architecture prioritizes **User Privacy**, keeping sensitive data and private keys local to the user. We aim for a non-invasive implementation that serves as a **DIY implementation framework**, scalable for individual users running their own instances (e.g., via OpenClaw or n8n) or large-scale deployments.
- **Context Engineering**: Holistic processing of identity, document purpose, and technical data.
- **Reliable Editing Protocol**: `[MODIFICAR]/[POR]` system for controlled mutations.

---

## 🏔️ Base Infrastructure: Andino Wallet
We use Andino as the "transport layer" and "security host" for Nelai, leveraging its *offline-first* and mobile-first architecture to ensure digital identity is accessible anywhere. UI/UX patterns for complex blockchain verification are still being explored and refined.

---

## 📦 Installation & Execution

This project uses **Yarn** as the package manager:

```bash
# Install dependencies
yarn install

# Start development server
yarn dev
```

---

## 🇪🇸 Versión en Español

> **Nota sobre el idioma:** El **Agente Nelai AI** funciona y se comunica actualmente en **Español**.

**Aura Wallet** es un ambicioso proyecto de **Identidad Digital Generalizada**. Presentamos una implementación avanzada usando la estructura de **Andino Wallet** por su madurez técnica.

### 🤖 Nelai AI: El Motor Agéntico R&D
Nelai es un **entorno de trabajo R&D** para la co-creación de **contratos legales con validez técnica**.

#### 🛠️ Visión Agéntica y LegalTech
- **Documentos con No-Repudio**: Verificación mediante **firmas Substrate (Polkadot)** y hashes, contrastables via QR.
- **Content Credentials & Origin Trail**: Soporte futuro para **Origin Trail (dKG)** para contenido verificable.
- **Enfoque en Privacidad y Backend Minimalista**: Nuestro "verdadero backend" es la **blockchain de Polkadot**. El servidor actual es minimalista por diseño para proteger la **privacidad del usuario**, manteniendo las llaves privadas locales. 
- **Framework DIY**: Diseñado como un **framework de implementación Do It Yourself**, escalable para usuarios individuales (ej: corriendo en OpenClaw o n8n) o grandes organizaciones, permitiendo un manejo de datos no invasivo.

---

## 🛠️ Stack Tecnológico / Tech Stack
- **Vite 7** - Ultra-fast build tool
- **React 18** - UI Framework
- **TypeScript** - Full static typing
- **Tailwind CSS 4** - Modern CSS framework
- **Dedot** - JavaScript client for Polkadot
- **IndexedDB** - Encrypted local storage
- **Leaflet** - Interactive maps
- **WebAuthn API** - Biometric authentication

## 🛡️ Security / Seguridad
Andino Wallet is **non-custodial**. Your private keys never leave your device.
Andino Wallet es **no-custodial**. Tus llaves privadas nunca salen de tu dispositivo.

## 📝 License / Licencia
MIT
