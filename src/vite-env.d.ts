/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOATCOUNTER_CODE?: string;
  readonly VITE_ENABLE_AI_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
