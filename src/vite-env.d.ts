/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** `true` serves the API from the in-browser fake backend (development only). */
  readonly VITE_API_MOCKING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
