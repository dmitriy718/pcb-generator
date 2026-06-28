/// <reference types="vite/client" />

import type { PcbEnclosureApi } from '../../preload';

declare global {
  interface Window {
    pcbEnclosure: PcbEnclosureApi;
  }
}
