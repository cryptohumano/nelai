# Aura Wallet x Nelai AI 🚀
### SoftServe AgentX Hackathon 2026 Entry

> **Language Note:** While this documentation is in English, the **Nelai AI Agent** currently operates and communicates in **Spanish**.

**Aura Wallet** is a generalized Digital Identity project. For this hackathon, we present an advanced implementation using the **Andino Wallet** technical infrastructure, chosen for its maturity in security, offline capabilities, and blockchain signatures.

---

## 🤖 Nelai AI: The R&D Agentic Engine
Nelai is an **R&D workspace** designed for technical knowledge generation and the co-creation of **technically valid legal contracts**.

### 🛠️ Agentic Vision & LegalTech (Hackathon Focus)
- **Non-Repudiation Documents**: Content verification is achieved by signing payloads with **Substrate (Polkadot) signatures** and unique hashes, verifiable via QR codes.
- **Dual Identity (User + Agent)**: We envision a future where both users and Agents (Nelai) possess executive powers based on verifiable credentials and delegated authority.
- **Content Credentials & Origin Trail**: Future integration with **Origin Trail (Decentralized Knowledge Graphs - dKG)** to anchor journalistic and scientific content on-chain for long-term verifiability.
- **Legal Compliance Pipeline**: We are researching the transformation of the agent into a daily assistant for lawyers, including a future **Reliability Score (Legal Compliance)** for pre-signing evaluation.
- **Hybrid & Privacy-First Architecture**: Our "true backend" is the **Polkadot blockchain**. The Node.js server is minimal to ensure **User Privacy**, keeping sensitive data local. This serves as a **DIY framework** for individual or enterprise scaling (e.g., via n8n or OpenClaw).

---

## 🏔️ Base Infrastructure: Andino Wallet
We leverage Andino as the "transport layer" and "security host" for Nelai, using its *offline-first* and mobile-first architecture to make digital identity accessible anywhere.

---

## 📂 Repository Structure

```
nelai/
├── README.md                 # This file (Master Overview)
├── andino-wallet-pwa/        # Main application (PWA + Nelai Agent)
│   ├── src/                  # React + TypeScript source code
│   ├── README.md             # PWA specific documentation
│   └── package.json          # Dependencies (Vite 7, Dedot, etc.)
└── docs/                     # Technical specifications and roadmap
```

---

## 📦 Getting Started

```bash
# Navigate to the app directory
cd andino-wallet-pwa

# Install dependencies
yarn install

# Start the environment
yarn dev:all
```

---

## 🇪🇸 Versión en Español

**Aura Wallet** es un proyecto de **Identidad Digital Generalizada**. Presentamos una implementación avanzada usando la estructura de **Andino Wallet**.

### 🤖 Nelai AI: El Motor Agéntico R&D
- **Documentos con No-Repudio**: Verificación mediante **firmas Substrate (Polkadot)** y hashes (QR).
- **Origin Trail**: Soporte futuro para **dKG** en contenido verificable.
- **Identidad Dual (User + Agent)**: Facultades ejecutivas delegadas.
- **Privacidad y Backend Minimalista**: El backend real es la **blockchain de Polkadot**. Privacidad local del usuario garantizada.

---

## 📝 License
MIT
