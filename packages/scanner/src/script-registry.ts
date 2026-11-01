export interface ScriptParsedEvent {
  scriptId: string;
  url: string;
  hasSourceURL: boolean;
  sourceURL?: string;
  parentScriptId?: string;
}

export interface ScriptInfo {
  scriptId: string;
  url: string;
  hasSourceURL: boolean;
  sourceURL?: string;
  parentScriptId?: string;
}

export interface ResolvedAttribution {
  url: string;
  spoofed: boolean;
}

export class ScriptRegistry {
  private scripts = new Map<string, ScriptInfo>();

  register(parsed: ScriptParsedEvent): void {
    this.scripts.set(parsed.scriptId, {
      scriptId: parsed.scriptId,
      url: parsed.url,
      hasSourceURL: parsed.hasSourceURL,
      sourceURL: parsed.sourceURL,
      parentScriptId: parsed.parentScriptId,
    });
  }

  resolve(scriptId: string): ResolvedAttribution {
    const visited = new Set<string>();
    let current = scriptId;
    let spoofed = false;

    while (current && !visited.has(current)) {
      visited.add(current);
      const info = this.scripts.get(current);
      if (!info) return { url: 'inline/unknown', spoofed };

      if (info.hasSourceURL) spoofed = true;

      if (info.url) return { url: info.url, spoofed };

      if (info.parentScriptId) {
        current = info.parentScriptId;
      } else {
        return { url: 'inline/unknown', spoofed };
      }
    }

    return { url: 'inline/unknown', spoofed };
  }
}
