#!/usr/bin/env node
/**
 * Create the admin key used to process destination proposals.
 *   npm run admin-key -- https://script.google.com/macros/s/…/exec
 *
 * Writes private/admin.json (git-ignored, readable only by you) with the backend URL and the key, and prints
 * the ADMIN_KEY_HASH value to paste into Apps Script › Project Settings › Script properties. The key itself is
 * never printed and never leaves this Mac; the backend only stores a salted hash.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';

const url = process.argv[2] || process.env.APPS_SCRIPT_URL;
if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
  console.error('usage: npm run admin-key -- https://script.google.com/macros/s/<id>/exec');
  process.exit(2);
}
const adminKey = randomBytes(32).toString('base64url');
const salt = randomBytes(12).toString('base64url');
const hash = `${salt}:${createHmac('sha256', salt).update(adminKey).digest('base64url')}`;
mkdirSync('private', { recursive: true });
writeFileSync('private/admin.json', `${JSON.stringify({ url, adminKey }, null, 2)}\n`);
chmodSync('private/admin.json', 0o600);
console.log('Saved the key to private/admin.json (git-ignored).\n');
console.log('Add this Script Property in Apps Script › Project Settings › Script properties:');
console.log('  Property: ADMIN_KEY_HASH');
console.log(`  Value:    ${hash}`);
