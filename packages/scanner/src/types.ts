export interface DetectionEvent {
  category: string;
  signal: string;
  weight: number;
  sourceScript?: string;
  stack?: string;
  sourceURLSpoofed?: boolean;
  timestamp: number;
  details: Record<string, unknown>;
  adContext?: {
    slotId?: string;
    creativeId?: string;
    advertiserId?: string;
    provider?: string;
  };
}

export interface AdSlotEvent {
  provider: string;
  slotId: string;
  creativeId?: string;
  advertiserId?: string;
  advertiserDomain?: string;
  lineItemId?: string;
  bidder?: string;
  bidPrice?: number;
  mediaUrl?: string;
  wrapperChain?: string[];
  scriptUrls: string[];
  timestamp: number;
}

export interface DetectorModule {
  category: string;
  getInjectionCode(reportFnName: string): string;
  getCDPHandlers?(): CDPHandler[];
}

export interface AdContextProvider {
  name: string;
  getInjectionCode(reportFnName: string): string;
}

export interface CDPHandler {
  event: string;
  handler: (params: Record<string, unknown>, detections: DetectionEvent[]) => void;
}

export interface ScanResult {
  siteId: number;
  pageUrl: string;
  detections: DetectionEvent[];
  adSlots: AdSlotEvent[];
  scriptInitiators: Record<string, string[]>;
  scriptsAnalyzed: number;
  error?: string;
}
