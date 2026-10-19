/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOATCOUNTER_CODE?: string;
  /** 3단계 비전 LLM 프록시 주소 (proxy/README.md) */
  readonly VITE_LLM_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
