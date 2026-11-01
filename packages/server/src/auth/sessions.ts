import crypto from 'node:crypto';

interface SessionRecord {
  csrfToken: string;
  createdAt: number;
}

export class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  create(): { sessionId: string; csrfToken: string } {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    this.sessions.set(sessionId, { csrfToken, createdAt: Date.now() });
    return { sessionId, csrfToken };
  }

  verify(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getCsrfToken(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.csrfToken ?? null;
  }

  verifyCsrf(sessionId: string, token: string): boolean {
    const expected = this.getCsrfToken(sessionId);
    if (!expected) return false;
    const expectedBuffer = Buffer.from(expected);
    const tokenBuffer = Buffer.from(token);
    // timingSafeEqual throws on length mismatch
    if (expectedBuffer.length !== tokenBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
  }

  revoke(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
