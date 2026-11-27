import { describe, expect, it } from 'vitest';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { base64Decode, base64EncodeWebSafe, hmacSha256, sha256, toSignedArray } from '../../backend/emulator/crypto.js';
import { createAppsScriptEmulator } from '../../backend/emulator/index.js';
import { createTestBackend } from './helpers';

const hex = (u8: Uint8Array) => Buffer.from(u8).toString('hex');

describe('emulator crypto (pure JS) matches node:crypto', () => {
  it('SHA-256 for padding edge cases and Unicode', () => {
    for (const len of [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 1000]) {
      const data = randomBytes(len);
      expect(hex(sha256(new Uint8Array(data))), `length ${len}`).toBe(createHash('sha256').update(data).digest('hex'));
    }
    expect(hex(sha256(new Uint8Array(Buffer.from('abc'))))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const unicode = 'Évaluation — 🌍 Oaxaca';
    expect(hex(sha256(new TextEncoder().encode(unicode)))).toBe(createHash('sha256').update(unicode, 'utf8').digest('hex'));
  });

  it('HMAC-SHA256 for short, block-size and long keys', () => {
    for (const keyLen of [0, 1, 16, 63, 64, 65, 200]) {
      const key = randomBytes(keyLen);
      const msg = randomBytes(77);
      expect(hex(hmacSha256(new Uint8Array(key), new Uint8Array(msg))), `key ${keyLen}`).toBe(createHmac('sha256', key).update(msg).digest('hex'));
    }
  });

  it('web-safe base64 round-trips and matches Buffer', () => {
    for (const len of [0, 1, 2, 3, 31, 32, 33]) {
      const data = randomBytes(len);
      const enc = base64EncodeWebSafe(new Uint8Array(data));
      expect(enc).toBe(data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_'));
      expect(Buffer.from(base64Decode(enc)).equals(data)).toBe(true);
    }
  });

  it('Utilities returns signed bytes like Apps Script', () => {
    const emu = createAppsScriptEmulator({
      sources: ['function digest(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s); }\n' +
        'function mac(v, k) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(v, k)); }'],
    });
    const bytes: number[] = emu.call('digest', 'abc');
    expect(bytes).toHaveLength(32);
    expect(bytes.every((b) => Number.isInteger(b) && b >= -128 && b <= 127)).toBe(true);
    expect(bytes.some((b) => b < 0)).toBe(true);
    expect(bytes).toEqual(toSignedArray(new Uint8Array(createHash('sha256').update('abc').digest())));
    expect(emu.call('mac', 'message', 'key')).toBe(createHmac('sha256', 'key').update('message').digest('base64url') + '=');
  });
});

describe('Auth.gs helpers', () => {
  it('Crockford encoding and normalisation agree with the generator algorithm', () => {
    const b = createTestBackend();
    expect(b.emu.call('crockfordEncode_', [0xff, 0x00, 0x10])).toBe('ZW010'); // 11111 11100 00000 00001 0000(0)
    expect(b.emu.call('normalizeAccessCode_', ' abcd-efgh ijkl-mnop o0il ')).toBe('ABCDEFGH1JK1MN0P0011');
    const code: string = b.emu.call('generateAccessCode_');
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/);
    const codes = new Set(Array.from({ length: 50 }, () => b.emu.call('generateAccessCode_')));
    expect(codes.size).toBe(50);
  });

  it('buildCredential_ produces the same hash as node:crypto', () => {
    const b = createTestBackend();
    const salt = 'a-fixed-salt-of-22-chr';
    const cred = b.emu.call('buildCredential_', 'victor', 'abcd-efgh', salt);
    const expected = createHmac('sha256', salt).update('ge-access-v1:victor:ABCDEFGH').digest('base64url');
    expect(cred).toEqual({ salt, hash: expected });
  });

  it('constantTimeEquals_ compares exactly', () => {
    const b = createTestBackend();
    expect(b.emu.call('constantTimeEquals_', 'abc', 'abc')).toBe(true);
    expect(b.emu.call('constantTimeEquals_', 'abc', 'abd')).toBe(false);
    expect(b.emu.call('constantTimeEquals_', 'abc', 'abcd')).toBe(false);
    expect(b.emu.call('constantTimeEquals_', '', '')).toBe(true);
    expect(b.emu.call('constantTimeEquals_', '', 'a')).toBe(false);
  });
});
