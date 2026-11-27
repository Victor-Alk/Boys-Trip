#!/usr/bin/env node
/**
 * Bundles the Apps Script backend into ONE file that can be pasted into the spreadsheet's Apps Script editor.
 *
 *   npm run backend:bundle                     → backend/dist/ExpeditionBackend.gs + backend/dist/appsscript.json
 *   npm run backend:bundle -- --out <dir>      → write somewhere else (used by the tests)
 *   npm run backend:bundle -- --source <dir>   → bundle another copy of backend/apps-script (used by the tests)
 *   npm run backend:bundle -- --json           → print a machine-readable summary instead of the text report
 *
 * Order: BACKEND_SOURCE_FILES from backend/emulator/index.js (the order the tests and the demo load the files in):
 * constants first, then the destination registry, helpers, and the entry points (doPost / doGet) last.
 *
 * The order is "safe" by construction, and this script refuses to bundle when that is no longer true. Apps Script
 * runs every file's top-level code on every execution, in file order, in one shared global scope. The bundle is
 * accepted only if:
 *   - the set of .gs files in the source folder is exactly BACKEND_SOURCE_FILES (nothing silently left out);
 *   - every top-level statement is a `function` declaration or a `var` whose initialiser is a plain literal
 *     (no calls, no `new`, no reference to another binding) — so no file depends on another being loaded first;
 *   - no top-level name is declared twice (in one global scope the later declaration would silently win);
 *   - the result is valid JavaScript;
 *   - nothing in it looks like an access code or a PARTICIPANT_CREDENTIALS entry (secrets live in Script
 *     Properties only).
 *
 * Output is deterministic (no timestamps): the header carries a content hash ("bundle id") instead.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { BACKEND_SOURCE_FILES } from '../backend/emulator/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SOURCE_DIR = join(ROOT, 'backend', 'apps-script');
export const DEFAULT_OUT_DIR = join(ROOT, 'backend', 'dist');
export const BUNDLE_FILE = 'ExpeditionBackend.gs';
export const MANIFEST_FILE = 'appsscript.json';

/** A grouped 24-character Crockford code (Auth.gs format). The documented placeholder XXXX-… is allowed. */
const ACCESS_CODE_RE = /\b[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){5}\b/g;
/** A credential entry as printed by `npm run codes` (a 43-character base64url HMAC). */
const CREDENTIAL_RE = /"hash"\s*:\s*"[A-Za-z0-9_-]{43}"/;

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

class BundleError extends Error {}

/** Checks one file's top level; returns the names it declares. Throws BundleError with every problem found. */
function inspectTopLevel(name, code) {
  const sf = ts.createSourceFile(name, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const problems = [];
  const declared = [];
  const where = (node) => `${name}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;

  /** Literal-only initialiser: objects, arrays, strings, numbers, booleans, null, regexes, unary minus. */
  const checkLiteral = (node) => {
    const visit = (n) => {
      if (ts.isCallExpression(n) || ts.isNewExpression(n) || ts.isTaggedTemplateExpression(n)) {
        problems.push(`${where(n)}: top-level code calls something (${n.getText(sf).slice(0, 40)}…); move it into a function`);
        return;
      }
      if (ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isClassExpression(n)) return; // not run at load
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        const isKey = (ts.isPropertyAssignment(p) && p.name === n) || (ts.isPropertyAccessExpression(p) && p.name === n);
        if (!isKey && n.text !== 'undefined') {
          problems.push(`${where(n)}: top-level initialiser refers to "${n.text}", which makes the file order matter`);
        }
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  };

  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      declared.push(st.name.text);
    } else if (ts.isVariableStatement(st)) {
      const flags = st.declarationList.flags;
      if (flags & ts.NodeFlags.Let || flags & ts.NodeFlags.Const) {
        problems.push(`${where(st)}: use "var" at the top level (let/const would break when files are re-ordered or split)`);
      }
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) {
          problems.push(`${where(d)}: destructuring at the top level is not allowed`);
          continue;
        }
        declared.push(d.name.text);
        if (d.initializer) checkLiteral(d.initializer);
      }
    } else if (!ts.isEmptyStatement(st)) {
      problems.push(`${where(st)}: only function declarations and literal "var" constants may appear at the top level`);
    }
  }
  return { declared, problems };
}

/**
 * Builds the bundle in memory. Returns { code, manifest, info }. Throws BundleError when the sources are unsafe.
 */
export function buildBundle({ sourceDir = DEFAULT_SOURCE_DIR } = {}) {
  const problems = [];
  const present = readdirSync(sourceDir).filter((f) => f.endsWith('.gs')).sort();
  for (const f of BACKEND_SOURCE_FILES) if (!present.includes(f)) problems.push(`missing source file ${f}`);
  for (const f of present) {
    if (!BACKEND_SOURCE_FILES.includes(f)) {
      problems.push(`${f} is not in the bundle order (add it to BACKEND_SOURCE_FILES in backend/emulator/index.js)`);
    }
  }
  if (problems.length) throw new BundleError(problems.join('\n'));

  const files = BACKEND_SOURCE_FILES.map((name) => {
    const code = readFileSync(join(sourceDir, name), 'utf8').replace(/\r\n?/g, '\n');
    return { name, code: code.endsWith('\n') ? code : `${code}\n`, sha: sha256(code).slice(0, 12) };
  });

  const owner = new Map();
  for (const f of files) {
    const r = inspectTopLevel(f.name, f.code);
    problems.push(...r.problems);
    for (const n of r.declared) {
      if (owner.has(n)) problems.push(`"${n}" is declared in both ${owner.get(n)} and ${f.name}`);
      else owner.set(n, f.name);
    }
    for (const m of f.code.matchAll(ACCESS_CODE_RE)) {
      if (!/^[X-]+$/.test(m[0])) problems.push(`${f.name}: contains something that looks like an access code — secrets belong in Script Properties`);
    }
    if (CREDENTIAL_RE.test(f.code)) problems.push(`${f.name}: contains a credential hash — PARTICIPANT_CREDENTIALS belongs in Script Properties`);
  }
  if (problems.length) throw new BundleError(problems.join('\n'));

  // Both files are literal-only at the top level (checked above), so evaluating them runs no code.
  const read = (file, expr) => vm.runInNewContext(`${files.find((f) => f.name === file).code}\n;${expr}`, {}, { timeout: 1000 });
  const backendVersion = String(read('Configuration.gs', 'BACKEND_VERSION'));
  const registry = read('Destinations.gs', 'DESTINATION_REGISTRY') || {};
  const ids = Object.keys(registry).sort();
  const pending = ids.filter((id) => registry[id] && registry[id].pending);

  const body = files.map((f) => [
    '',
    `// ${'='.repeat(110)}`,
    `// ${f.name}`,
    `// ${'='.repeat(110)}`,
    '',
    f.code.trimEnd(),
    '',
  ].join('\n')).join('');
  const bundleId = sha256(body).slice(0, 12);

  const wrap = (text, width = 112) => {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      if (line && (line + ' ' + word).length > width) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const registryLine = pending.length
    ? `Destination registry: ${ids.length - pending.length} of ${ids.length} with research data; pending: ${pending.join(', ')}. Pending destinations can be evaluated but are never ranking-eligible. When research is finished, run \`npm run backend:registry\` and \`npm run backend:bundle\` again, paste the new file over this one and deploy a new version.`
    : `Destination registry: all ${ids.length} destinations have research data.`;

  const header = [
    '/**',
    ' * ExpeditionBackend.gs — The Great Expedition 2027 · voting backend for Google Apps Script.',
    ' *',
    ' * GENERATED by scripts/bundle-backend.mjs (`npm run backend:bundle`). Do not edit this file: edit',
    ' * backend/apps-script/*.gs, then bundle again.',
    ' *',
    ` * Backend version ${backendVersion} · bundle id ${bundleId}`,
    ...wrap(`Built from, in this order: ${files.map((f) => `${f.name} (${f.sha.slice(0, 8)})`).join(', ')}.`).map((l) => ` * ${l}`),
    ' *',
    ...wrap(registryLine).map((l) => ` * ${l}`),
    ' *',
    ' * INSTALL (full step-by-step guide: docs/deployment/apps-script.md)',
    ' *   1. Open the spreadsheet › Extensions › Apps Script.',
    ' *   2. This must be the ONLY script file in the project. Select everything in Code.gs, paste this whole file',
    ' *      over it and save. Delete any other .gs file (for example Auth.gs from an earlier install).',
    ` *   3. Project Settings › tick "Show "appsscript.json" manifest file in editor"; replace that file with`,
    ' *      backend/dist/appsscript.json and save.',
    ' *   4. Reload the spreadsheet › Expedition admin › Set up (tabs + session secret).',
    ' *   5. Deploy › New deployment › Web app · Execute as: Me · Who has access: Anyone.',
    ' *      Later updates: Deploy › Manage deployments › Edit › Version: New version › Deploy (same /exec URL).',
    ' *',
    ' * This file contains no secrets. Access-code hashes, SESSION_SECRET and private data live only in',
    ' * Project Settings › Script Properties.',
    ' */',
  ].join('\n');

  const code = `${header}\n${body}`;
  try {
    new vm.Script(code, { filename: BUNDLE_FILE });
  } catch (e) {
    throw new BundleError(`the bundle is not valid JavaScript: ${e.message}`);
  }

  const manifestText = readFileSync(join(sourceDir, MANIFEST_FILE), 'utf8');
  try {
    JSON.parse(manifestText);
  } catch (e) {
    throw new BundleError(`${MANIFEST_FILE} is not valid JSON: ${e.message}`);
  }

  return {
    code,
    manifest: manifestText,
    info: {
      backendVersion,
      bundleId,
      files: files.map((f) => ({ name: f.name, sha: f.sha })),
      functions: Array.from(owner.keys()).filter((n) => !/_$/.test(n)).sort(),
      destinations: { total: ids.length, withData: ids.length - pending.length, pending },
      bytes: Buffer.byteLength(code, 'utf8'),
    },
  };
}

/** Builds and writes ExpeditionBackend.gs and appsscript.json into outDir. Returns the paths and the info. */
export function writeBundle({ sourceDir = DEFAULT_SOURCE_DIR, outDir = DEFAULT_OUT_DIR } = {}) {
  const { code, manifest, info } = buildBundle({ sourceDir });
  mkdirSync(outDir, { recursive: true });
  const bundlePath = join(outDir, BUNDLE_FILE);
  const manifestPath = join(outDir, MANIFEST_FILE);
  writeFileSync(bundlePath, code);
  writeFileSync(manifestPath, manifest);
  return { bundlePath, manifestPath, info };
}

function main(argv) {
  const opt = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1];
  };
  const sourceDir = resolve(opt('--source') || DEFAULT_SOURCE_DIR);
  const outDir = resolve(opt('--out') || DEFAULT_OUT_DIR);
  let result;
  try {
    result = writeBundle({ sourceDir, outDir });
  } catch (e) {
    if (e instanceof BundleError) {
      console.error(`Bundle NOT written. Fix these problems first:\n${e.message.split('\n').map((l) => `  · ${l}`).join('\n')}`);
      process.exit(1);
    }
    throw e;
  }
  const { bundlePath, manifestPath, info } = result;
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ bundlePath, manifestPath, ...info })}\n`);
    return;
  }
  const rel = (p) => {
    const r = relative(process.cwd(), p);
    return r && !r.startsWith('..') ? r : p;
  };
  console.log(`Wrote ${rel(bundlePath)} (${Math.round(info.bytes / 1024)} KB, backend ${info.backendVersion}, bundle id ${info.bundleId})`);
  console.log(`Wrote ${rel(manifestPath)}`);
  console.log(`Destinations: ${info.destinations.withData}/${info.destinations.total} with research data` +
    (info.destinations.pending.length ? `; pending: ${info.destinations.pending.join(', ')}` : ''));
  if (info.destinations.pending.length) {
    console.log('  (Run `npm run backend:registry` first if research has changed, then bundle again.)');
  }
  console.log('Paste ExpeditionBackend.gs as the ONLY .gs file of the Apps Script project, and appsscript.json as the manifest.');
  console.log('Guide: docs/deployment/apps-script.md');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
