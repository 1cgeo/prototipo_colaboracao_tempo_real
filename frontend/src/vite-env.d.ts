// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_SOCKET_SERVER: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }