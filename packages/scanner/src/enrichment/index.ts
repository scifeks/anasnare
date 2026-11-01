import type { AdContextProvider } from '../types.js';
import { prebidProvider } from './prebid.js';
import { gptProvider } from './gpt.js';
import { vastProvider } from './vast.js';

export function getAllProviders(): AdContextProvider[] {
  return [prebidProvider, gptProvider, vastProvider];
}
