import type { SmtpProbeResult } from '../services/mail';

let lastProbe: SmtpProbeResult | null = null;

export function setSmtpProbeResult(result: SmtpProbeResult): void {
  lastProbe = result;
}

export function getSmtpProbeResult(): SmtpProbeResult | null {
  return lastProbe;
}
