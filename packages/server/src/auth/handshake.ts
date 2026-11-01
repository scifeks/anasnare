export class HandshakeRegistry {
  private tokens = new Map<string, number>();

  constructor(private ttlMs: number = 300_000) {}

  register(token: string): void {
    this.tokens.set(token, Date.now() + this.ttlMs);
  }

  consume(token: string): boolean {
    const expiresAt = this.tokens.get(token);
    this.tokens.delete(token);
    if (expiresAt === undefined) return false;
    return Date.now() < expiresAt;
  }
}
