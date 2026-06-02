import { getDatabaseStatus } from '../config/db';
import { isBrevoConfigured, isGeminiConfigured, loadEnv } from '../config/env';
import { getSmtpProbeResult } from '../config/smtpStatus';
import { getEmailProvider, isOutboundEmailConfigured } from './emailDelivery';

const PROBE_TIMEOUT_MS = 5000;

export interface ServiceProbe {
  ok: boolean;
  latencyMs: number;
  label: string;
  detail?: string;
  url?: string;
}

async function probeUrl(url: string, method: 'HEAD' | 'GET' = 'HEAD'): Promise<ServiceProbe> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
    });
    const latencyMs = Date.now() - start;
    return {
      ok: response.ok || response.status < 500,
      latencyMs,
      label: 'Vercel frontend',
      url,
      detail: response.ok ? 'Reachable' : `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      label: 'Vercel frontend',
      url,
      detail: err instanceof Error ? err.message : 'Unreachable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInfrastructureHealth() {
  const env = loadEnv();
  const dbStatus = getDatabaseStatus();
  const emailProbe = getSmtpProbeResult();
  const provider = getEmailProvider(env);
  const renderStart = Date.now();

  const vercel = await probeUrl(env.CLIENT_URL);

  const mongodb = {
    ok: dbStatus === 'connected',
    latencyMs: 0,
    label: 'MongoDB Atlas',
    detail: dbStatus === 'connected' ? 'Connected' : `Status: ${dbStatus}`,
  };

  const brevo = {
    ok: emailProbe?.ok === true,
    latencyMs: 0,
    label: provider === 'brevo' ? 'Brevo email' : provider === 'smtp' ? 'SMTP email' : 'Email',
    detail: emailProbe?.ok
      ? 'Ready'
      : isBrevoConfigured(env)
        ? emailProbe?.error ?? 'Brevo configured but not ready'
        : isOutboundEmailConfigured(env)
          ? emailProbe?.error ?? 'Not ready'
          : 'Not configured',
  };

  const render = {
    ok: true,
    latencyMs: Date.now() - renderStart,
    label: 'Render API',
    detail: 'API process responding',
  };

  const gemini = {
    ok: isGeminiConfigured(env),
    latencyMs: 0,
    label: 'Gemini AI assistant',
    detail: isGeminiConfigured(env) ? 'API key configured (see superadmin health for live probe)' : 'Not configured',
  };

  return {
    render,
    vercel,
    mongodb,
    brevo,
    gemini,
    checkedAt: new Date().toISOString(),
    environment: env.NODE_ENV,
  };
}
