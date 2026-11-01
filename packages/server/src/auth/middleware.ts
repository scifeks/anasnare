import type { RequestHandler } from 'express';
import type { SessionStore } from './sessions.js';

const EXEMPT_PATHS = new Set(['/api/auth/exchange', '/api/health']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sessionMiddleware(store: SessionStore): RequestHandler {
  return (req, res, next) => {
    const path = req.path.toLowerCase();
    if (!path.startsWith('/api/')) return next();
    if (EXEMPT_PATHS.has(path)) return next();
    const sessionId = req.cookies?.anasnare_session;
    if (!sessionId || !store.verify(sessionId)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    res.locals.sessionId = sessionId;
    next();
  };
}

export function csrfMiddleware(store: SessionStore): RequestHandler {
  return (req, res, next) => {
    const path = req.path.toLowerCase();
    if (!path.startsWith('/api/')) return next();
    if (EXEMPT_PATHS.has(path)) return next();
    if (SAFE_METHODS.has(req.method)) return next();
    const sessionId = res.locals.sessionId;
    const csrfToken = req.headers['x-csrf-token'] as string | undefined;
    if (!sessionId || !csrfToken || !store.verifyCsrf(sessionId, csrfToken)) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }
    next();
  };
}
