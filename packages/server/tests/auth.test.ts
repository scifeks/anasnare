import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { HandshakeRegistry } from '../src/auth/handshake.js';
import { SessionStore } from '../src/auth/sessions.js';
import { csrfMiddleware, sessionMiddleware } from '../src/auth/middleware.js';

describe('HandshakeRegistry', () => {
  let registry: HandshakeRegistry;

  beforeEach(() => {
    registry = new HandshakeRegistry(300);
  });

  it('consumes a registered token once', () => {
    registry.register('abc123');
    expect(registry.consume('abc123')).toBe(true);
    expect(registry.consume('abc123')).toBe(false);
  });

  it('rejects unknown tokens', () => {
    expect(registry.consume('unknown')).toBe(false);
  });

  it('rejects expired tokens', () => {
    const reg = new HandshakeRegistry(0);
    reg.register('expired');
    expect(reg.consume('expired')).toBe(false);
  });
});

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it('creates a session with session ID and CSRF token', () => {
    const { sessionId, csrfToken } = store.create();
    expect(sessionId).toBeTruthy();
    expect(csrfToken).toBeTruthy();
    expect(sessionId).not.toBe(csrfToken);
  });

  it('verifies a valid session', () => {
    const { sessionId } = store.create();
    expect(store.verify(sessionId)).toBe(true);
  });

  it('rejects an unknown session', () => {
    expect(store.verify('nonexistent')).toBe(false);
  });

  it('verifies CSRF token', () => {
    const { sessionId, csrfToken } = store.create();
    expect(store.verifyCsrf(sessionId, csrfToken)).toBe(true);
    expect(store.verifyCsrf(sessionId, 'wrong')).toBe(false);
  });

  it('revokes a session', () => {
    const { sessionId } = store.create();
    store.revoke(sessionId);
    expect(store.verify(sessionId)).toBe(false);
  });
});

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    path: '/api/v1/something',
    method: 'GET',
    cookies: {},
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
  const res: Record<string, unknown> = { locals: {} };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res as unknown as Response;
}

describe('sessionMiddleware', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it('rejects uppercase API paths without a session', () => {
    const res = mockRes();
    const next = vi.fn();
    sessionMiddleware(store)(mockReq({ path: '/API/v1/something' }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets exempt paths through without a session', () => {
    const next = vi.fn();
    sessionMiddleware(store)(mockReq({ path: '/api/auth/exchange' }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('accepts a valid session and exposes its ID', () => {
    const { sessionId } = store.create();
    const res = mockRes();
    const next = vi.fn();
    sessionMiddleware(store)(mockReq({ cookies: { anasnare_session: sessionId } }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.sessionId).toBe(sessionId);
  });
});

describe('csrfMiddleware', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it('skips the CSRF check for safe methods', () => {
    const next = vi.fn();
    csrfMiddleware(store)(mockReq({ method: 'GET' }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects PUT without a CSRF token', () => {
    const { sessionId } = store.create();
    const res = mockRes();
    res.locals.sessionId = sessionId;
    const next = vi.fn();
    csrfMiddleware(store)(mockReq({ method: 'PUT' }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts POST with a valid CSRF token', () => {
    const { sessionId, csrfToken } = store.create();
    const res = mockRes();
    res.locals.sessionId = sessionId;
    const next = vi.fn();
    csrfMiddleware(store)(
      mockReq({ method: 'POST', headers: { 'x-csrf-token': csrfToken } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
