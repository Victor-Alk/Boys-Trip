#!/usr/bin/env node
/**
 * Generates individual access codes for the four participants.
 *
 *   npm run codes                       → new codes for everyone
 *   npm run codes -- --participant paco → a new code for one participant (merge the printed entry by hand)
 *   npm run codes -- --json             → machine-readable output (codes + credentials JSON) on stdout
 *
 * Each code is 24 Crockford base32 characters (120 bits from node:crypto), shown as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.
 * Only salted hashes go into the Script Property PARTICIPANT_CREDENTIALS, in exactly the format that
 * backend/apps-script/Auth.gs verifies:
 *   hash = base64url_nopad(HMAC_SHA256(key = salt (UTF-8), message = "ge-access-v1:" + id + ":" + normalisedCode))
 *   normalisedCode = upper-case, spaces/hyphens removed, O→0, I/L→1.
 *
 * The codes are printed ONCE to stdout and never written to disk. Do not redirect the output into a file inside
 * the repository; send each friend their own code through a private channel.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PARTICIPANTS = [
  { id: 'paco', name: 'Paco' },
  { id: 'gaetan', name: 'Gaetan' },
  { id: 'alvarinn', name: 'Alvarinn' },
  { id: 'victor', name: 'Victor' },
];

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CONTEXT = 'ge-access-v1';
export const CODE_BYTES = 15; // 120 bits → 24 characters

export function crockfordEncode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

export function generateCode() {
  return crockfordEncode(randomBytes(CODE_BYTES)).match(/.{1,4}/g).join('-');
}

export function normalizeCode(code) {
  return String(code).toUpperCase().replace(/[\s\-_.]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function credentialFor(participantId, code, salt = randomBytes(16).toString('base64url')) {
  const hash = createHmac('sha256', salt).update(`${CONTEXT}:${participantId}:${normalizeCode(code)}`).digest('base64url');
  return { salt, hash };
}

function main(argv) {
  const json = argv.includes('--json');
  const pIndex = argv.indexOf('--participant');
  let selected = PARTICIPANTS;
  if (pIndex !== -1) {
    const id = String(argv[pIndex + 1] || '').toLowerCase();
    selected = PARTICIPANTS.filter((p) => p.id === id);
    if (!selected.length) {
      console.error(`Unknown participant "${id}". Use one of: ${PARTICIPANTS.map((p) => p.id).join(', ')}`);
      process.exit(1);
    }
  }
  const codes = {};
  const credentials = {};
  for (const p of selected) {
    codes[p.id] = generateCode();
    credentials[p.id] = credentialFor(p.id, codes[p.id]);
  }
  if (json) {
    process.stdout.write(`${JSON.stringify({ codes, credentials })}\n`);
    return;
  }
  const line = '─'.repeat(64);
  console.log(line);
  console.log('ACCESS CODES — shown once, not saved anywhere. Send each person only their own code.');
  console.log(line);
  for (const p of selected) console.log(`  ${p.name.padEnd(10)} ${codes[p.id]}`);
  console.log(line);
  if (selected.length === PARTICIPANTS.length) {
    console.log('Script Property PARTICIPANT_CREDENTIALS (paste the whole line as the value):\n');
    console.log(JSON.stringify(credentials));
  } else {
    const id = selected[0].id;
    console.log(`Replace the "${id}" entry inside PARTICIPANT_CREDENTIALS with:\n`);
    console.log(`"${id}":${JSON.stringify(credentials[id])}`);
    console.log('\nThen run Expedition admin › Sign one participant out… for this participant.');
  }
  console.log(`\n${line}`);
  console.log('Clear your terminal scrollback after copying (e.g. Cmd+K in Terminal).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
