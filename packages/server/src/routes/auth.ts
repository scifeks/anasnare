import { Router } from 'express';
import type { HandshakeRegistry } from '../auth/handshake.js';
import type { SessionStore } from '../auth/sessions.js';

export function authRouter(registry: HandshakeRegistry, store: SessionStore): Router {
  const router = Router();

  router.post('/exchange', (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Token required' });
      return;
    }
    if (!registry.consume(token)) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    const { sessionId, csrfToken } = store.create();
    res.cookie('anasnare_session', sessionId, { httpOnly: true, sameSite: 'strict', secure: false, path: '/' });
    res.cookie('anasnare_csrf', csrfToken, { httpOnly: false, sameSite: 'strict', secure: false, path: '/' });
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    const sessionId = req.cookies?.anasnare_session;
    if (sessionId) store.revoke(sessionId);
    res.clearCookie('anasnare_session', { path: '/' });
    res.clearCookie('anasnare_csrf', { path: '/' });
    res.json({ ok: true });
  });

  router.get('/whoami', (_req, res) => {
    res.json({ authenticated: true });
  });

  return router;
}
