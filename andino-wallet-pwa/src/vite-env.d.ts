/// <reference types="vite/client" />

declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly BASE_URL: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
