/**
 * Firebase Cloud Messaging (HTTP v1) helper.
 *
 * Uses the service-account JSON stored in the `FIREBASE_SERVICE_ACCOUNT`
 * environment secret to mint an OAuth access token via signed JWT, then sends
 * pushes through https://fcm.googleapis.com/v1/projects/<pid>/messages:send.
 *
 * Dead tokens (HTTP 404 / UNREGISTERED, or 400 with INVALID_ARGUMENT) are
 * removed from `push_tokens` by the caller after inspecting the returned
 * per-token result.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

let accessTokenCache: { token: string; expires_at: number } | null = null;
let cachedSa: ServiceAccount | null = null;

function getServiceAccount(): ServiceAccount {
  if (cachedSa) return cachedSa;
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env is not set');
  const sa = JSON.parse(raw) as ServiceAccount;
  // Support pasted-with-\n private keys.
  sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  cachedSa = sa;
  return sa;
}

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  if (accessTokenCache && accessTokenCache.expires_at > now + 60) {
    return { token: accessTokenCache.token, projectId: sa.project_id };
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const signingInput = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claim)))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  accessTokenCache = { token: json.access_token, expires_at: now + json.expires_in };
  return { token: json.access_token, projectId: sa.project_id };
}

export type FcmSendResult = { token: string; ok: boolean; error?: string; deadToken?: boolean };

/**
 * Send the same notification to many tokens. Returns per-token results so the
 * caller can prune dead tokens.
 */
export async function fcmSendToTokens(
  tokens: string[],
  notification: { title: string; body: string },
  data: Record<string, string> = {},
): Promise<FcmSendResult[]> {
  if (tokens.length === 0) return [];
  const { token: accessToken, projectId } = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const send = async (tok: string): Promise<FcmSendResult> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: tok,
            notification,
            data,
            webpush: { notification: { icon: '/app-icon.png', badge: '/app-icon.png' } },
            android: { priority: 'HIGH', notification: { sound: 'default' } },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      });
      if (res.ok) return { token: tok, ok: true };
      const errText = await res.text();
      let errCode = '';
      try { errCode = (JSON.parse(errText).error?.details ?? []).find((d: { errorCode?: string }) => d.errorCode)?.errorCode ?? ''; } catch { /* ignore */ }
      const deadToken =
        res.status === 404 ||
        errCode === 'UNREGISTERED' ||
        errCode === 'INVALID_ARGUMENT' ||
        errText.includes('registration-token-not-registered');
      return { token: tok, ok: false, error: `${res.status} ${errText}`, deadToken };
    } catch (e) {
      return { token: tok, ok: false, error: (e as Error).message };
    }
  };

  // Reasonable concurrency ~10 to avoid hammering FCM from a single function.
  const results: FcmSendResult[] = [];
  const queue = [...tokens];
  const workers = Array.from({ length: Math.min(10, queue.length) }, async () => {
    while (queue.length) {
      const t = queue.shift();
      if (t) results.push(await send(t));
    }
  });
  await Promise.all(workers);
  return results;
}
