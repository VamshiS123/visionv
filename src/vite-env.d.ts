/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OVERSHOOT_API_URL?: string;
  readonly VITE_OVERSHOOT_API_KEY?: string;
  readonly VITE_MURF_API_KEY?: string;
  readonly VITE_MURF_VOICE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
