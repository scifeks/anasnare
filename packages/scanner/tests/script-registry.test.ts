import { describe, it, expect } from 'vitest';
import { ScriptRegistry } from '../src/script-registry.js';

describe('ScriptRegistry', () => {
  it('resolves a network-loaded script by scriptId', () => {
    const reg = new ScriptRegistry();
    reg.register({ scriptId: '1', url: 'https://cdn.example.com/ad.js', hasSourceURL: false });
    expect(reg.resolve('1')).toEqual({ url: 'https://cdn.example.com/ad.js', spoofed: false });
  });

  it('returns unknown for unregistered scriptId', () => {
    const reg = new ScriptRegistry();
    expect(reg.resolve('999')).toEqual({ url: 'inline/unknown', spoofed: false });
  });

  it('walks eval chain to network-loaded parent', () => {
    const reg = new ScriptRegistry();
    reg.register({ scriptId: '1', url: 'https://cdn.example.com/loader.js', hasSourceURL: false });
    reg.register({ scriptId: '2', url: '', hasSourceURL: false, parentScriptId: '1' });
    expect(reg.resolve('2')).toEqual({ url: 'https://cdn.example.com/loader.js', spoofed: false });
  });

  it('walks multi-level eval chain', () => {
    const reg = new ScriptRegistry();
    reg.register({ scriptId: '1', url: 'https://cdn.example.com/root.js', hasSourceURL: false });
    reg.register({ scriptId: '2', url: '', hasSourceURL: false, parentScriptId: '1' });
    reg.register({ scriptId: '3', url: '', hasSourceURL: false, parentScriptId: '2' });
    expect(reg.resolve('3')).toEqual({ url: 'https://cdn.example.com/root.js', spoofed: false });
  });

  it('flags sourceURL pragma as spoofed', () => {
    const reg = new ScriptRegistry();
    reg.register({
      scriptId: '1',
      url: 'https://evil.com/malware.js',
      hasSourceURL: true,
      sourceURL: 'https://cdn.doubleverify.com/dvtp.js',
    });
    expect(reg.resolve('1')).toEqual({ url: 'https://evil.com/malware.js', spoofed: true });
  });

  it('flags spoofed when any script in eval chain has sourceURL', () => {
    const reg = new ScriptRegistry();
    reg.register({
      scriptId: '1',
      url: 'https://evil.com/loader.js',
      hasSourceURL: true,
      sourceURL: 'https://cdn.doubleverify.com/dvtp.js',
    });
    reg.register({ scriptId: '2', url: '', hasSourceURL: false, parentScriptId: '1' });
    expect(reg.resolve('2')).toEqual({ url: 'https://evil.com/loader.js', spoofed: true });
  });

  it('breaks infinite loops in circular parentScriptId chains', () => {
    const reg = new ScriptRegistry();
    reg.register({ scriptId: '1', url: '', hasSourceURL: false, parentScriptId: '2' });
    reg.register({ scriptId: '2', url: '', hasSourceURL: false, parentScriptId: '1' });
    expect(reg.resolve('1')).toEqual({ url: 'inline/unknown', spoofed: false });
  });
});
