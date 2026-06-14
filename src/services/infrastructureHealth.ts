import { getDatabaseStatus, pingDatabaseLatencyMs } from '../config/db';
import { isGeminiConfigured, loadEnv } from '../config/env';
import { getEmailProvider, isOutboundEmailConfigured } from './emailDelivery';
import { probeBrevo } from './brevo';
import { probeSmtp } from './mail';

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

async function probeEmailProvider(env: ReturnType<typeof loadEnv>): Promise<{
  ok: boolean;
  latencyMs: number;
  detail: string;
}> {
  const provider = getEmailProvider(env);
  if (!isOutboundEmailConfigured(env)) {
    return { ok: false, latencyMs: 0, detail: 'Not configured' };
  }

  if (provider === 'brevo') {
    const probe = await probeBrevo(env);
    return {
      ok: probe.ok,
      latencyMs: probe.latencyMs ?? 0,
      detail: probe.ok ? 'Ready' : probe.error,
    };
  }

  const probe = await probeSmtp(env);
  return {
    ok: probe.ok,
    latencyMs: probe.latencyMs ?? 0,
    detail: probe.ok ? 'Ready' : probe.error,
  };
}

export async function getInfrastructureHealth() {
  const syncStart = Date.now();
  const env = loadEnv();
  const dbStatus = getDatabaseStatus();
  const provider = getEmailProvider(env);
  const renderLatencyMs = Math.max(1, Date.now() - syncStart);

  const [mongoLatencyMs, emailProbe, vercel] = await Promise.all([
    pingDatabaseLatencyMs(),
    probeEmailProvider(env),
    probeUrl(env.CLIENT_URL),
  ]);

  const mongodb = {
    ok: dbStatus === 'connected',
    latencyMs: mongoLatencyMs ?? 0,
    label: 'MongoDB Atlas',
    detail: dbStatus === 'connected' ? 'Connected' : `Status: ${dbStatus}`,
  };

  const brevo = {
    ok: emailProbe.ok,
    latencyMs: emailProbe.latencyMs,
    label: provider === 'brevo' ? 'Brevo email' : provider === 'smtp' ? 'SMTP email' : 'Email',
    detail: emailProbe.detail,
  };

  const render = {
    ok: true,
    latencyMs: renderLatencyMs,
    label: 'Render API',
    detail: 'API process responding',
  };

  const gemini = {
    ok: isGeminiConfigured(env),
    latencyMs: 0,
    label: 'Gemini AI assistant',
    detail: isGeminiConfigured(env) ? 'API key configured (see superadmin health for live probe)' : 'Not configured',
  };

  const speechToText = {
    ok: true,
    latencyMs: 0,
    label: 'Browser speech-to-text',
    detail: 'Web Speech API · Assistant & Messages · English (PK), Urdu, English (US)',
  };

  return {
    render,
    vercel,
    mongodb,
    brevo,
    gemini,
    speechToText,
    checkedAt: new Date().toISOString(),
    environment: env.NODE_ENV,
  };
}
