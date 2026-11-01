import type { DetectorModule } from '../types.js';
import { devtoolsDetector } from './devtools.js';
import { automationDetector } from './automation.js';
import { instrumentationDetector } from './instrumentation.js';
import { visibilityDetector } from './visibility.js';
import { fingerprintingDetector } from './fingerprinting.js';

export function getAllDetectors(): DetectorModule[] {
  return [
    devtoolsDetector,
    automationDetector,
    instrumentationDetector,
    visibilityDetector,
    fingerprintingDetector,
  ];
}
