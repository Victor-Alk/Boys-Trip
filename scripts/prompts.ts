/**
 * Process destination proposals ("prompts") from the Prompts tab. Runbook: docs/prompts/README.md
 *
 *   npm run prompts                          list proposals waiting to be researched (status "new")
 *   npm run prompts -- all                   list every proposal
 *   npm run prompts -- next-id               print the next free destination id (D21, D22, …)
 *   npm run prompts -- claim P1A2B3C4D5      mark a proposal "processing" (nobody else will pick it up)
 *   npm run prompts -- done P1A2B3C4D5 D21   register D21 with the backend (votes accepted) and mark it "done"
 *   npm run prompts -- decline P1A2B3C4D5 "reason shown to the group"
 *   npm run prompts -- register D25             register a destination added on direct request (no proposal row)
 *   npm run prompts -- novelty                  upload private/novelty.json to the NOVELTY_DATA Script Property
 *
 * Needs private/admin.json from `npm run admin-key`. A proposal is only ever claimed while it is "new", so it
 * cannot be researched twice; "done" is final.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Destination } from '../src/types/destination';
import { headlineTotals, hasMaterialUncertainty } from '../src/lib/budget';

interface Prompt {
  promptId: string;
  participantName: string;
  prompt: string;
  createdAt: string;
  status: string;
  destinationId: string | null;
  note: string;
}

const root = process.cwd();
if (!existsSync(join(root, 'private/admin.json'))) {
  console.error('Missing private/admin.json — run: npm run admin-key -- <Apps Script /exec URL>');
  process.exit(2);
}
const { url, adminKey } = JSON.parse(readFileSync(join(root, 'private/admin.json'), 'utf8')) as { url: string; adminKey: string };

async function admin<T>(action: string, payload: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, adminKey, payload }) });
  const body = (await res.json()) as { ok: boolean; data?: T; error?: { code: string; message: string } };
  if (!body.ok) throw new Error(`${action}: ${body.error?.code} — ${body.error?.message}`);
  return body.data as T;
}

const destFiles = () => readdirSync(join(root, 'data/destinations')).filter((f) => /^D\d{2}-.*\.json$/.test(f));
const nextId = () => `D${String(Math.max(20, ...destFiles().map((f) => Number(f.slice(1, 3)))) + 1).padStart(2, '0')}`;

const [cmd = 'list', a, b] = process.argv.slice(2);

if (cmd === 'list' || cmd === 'all') {
  const { prompts } = await admin<{ prompts: Prompt[] }>('adminListPrompts', cmd === 'all' ? {} : { status: 'new' });
  if (prompts.length === 0) console.log(cmd === 'all' ? 'No proposals yet.' : 'No new proposals.');
  for (const p of prompts) {
    console.log(`\n${p.promptId}  [${p.status}${p.destinationId ? ` → ${p.destinationId}` : ''}]  ${p.participantName} · ${p.createdAt.slice(0, 10)}`);
    console.log(`  “${p.prompt}”`);
    if (p.note) console.log(`  note: ${p.note}`);
  }
} else if (cmd === 'next-id') {
  console.log(nextId());
} else if (cmd === 'claim' && a) {
  const { prompts } = await admin<{ prompts: Prompt[] }>('adminListPrompts', {});
  const p = prompts.find((x) => x.promptId === a);
  if (!p) throw new Error(`Unknown proposal ${a}`);
  if (p.status !== 'new') throw new Error(`${a} is "${p.status}", not "new" — it is already being handled`);
  await admin('adminUpdatePrompt', { promptId: a, status: 'processing', note: 'Being researched' });
  console.log(`${a} claimed. Research it as ${nextId()} (see docs/prompts/README.md).`);
} else if (cmd === 'done' && a && b) {
  const file = destFiles().find((f) => f.startsWith(`${b}-`));
  if (!file) throw new Error(`No data/destinations/${b}-*.json`);
  const d = Destination.parse(JSON.parse(readFileSync(join(root, 'data/destinations', file), 'utf8')));
  if (d.origin.type !== 'participant-proposal' || d.origin.promptId !== a) throw new Error(`${file} must have origin { type: "participant-proposal", promptId: "${a}" }`);
  const t = headlineTotals(d.budget);
  await admin('adminRegisterDestination', {
    entry: {
      id: d.id, name: d.country, title: d.title, version: d.version, securityStatus: d.security.status,
      realisticTotalEUR: Math.round(t.totalPerPerson * 100) / 100, budgetStatus: t.status, materialUncertainty: hasMaterialUncertainty(d.budget),
    },
  });
  await admin('adminUpdatePrompt', { promptId: a, status: 'done', destinationId: d.id, note: `Added as ${d.id} — ${d.title}` });
  console.log(`${d.id} registered with the backend and ${a} marked done.`);
} else if (cmd === 'register' && a) {
  // A destination added on direct request (no Prompts-tab row): register it so votes are accepted.
  const file = destFiles().find((f) => f.startsWith(`${a}-`));
  if (!file) throw new Error(`No data/destinations/${a}-*.json`);
  const d = Destination.parse(JSON.parse(readFileSync(join(root, 'data/destinations', file), 'utf8')));
  const t = headlineTotals(d.budget);
  await admin('adminRegisterDestination', {
    entry: {
      id: d.id, name: d.country, title: d.title, version: d.version, securityStatus: d.security.status,
      realisticTotalEUR: Math.round(t.totalPerPerson * 100) / 100, budgetStatus: t.status, materialUncertainty: hasMaterialUncertainty(d.budget),
    },
  });
  console.log(`${d.id} registered with the backend.`);
} else if (cmd === 'novelty') {
  // Upload private/novelty.json (git-ignored) to the NOVELTY_DATA Script Property.
  const novelty = JSON.parse(readFileSync(join(root, 'private/novelty.json'), 'utf8'));
  const r = await admin<{ destinations: number }>('adminSetNovelty', { novelty });
  console.log(`Novelty updated for ${r.destinations} destinations.`);
} else if (cmd === 'decline' && a && b) {
  await admin('adminUpdatePrompt', { promptId: a, status: 'declined', note: b });
  console.log(`${a} declined.`);
} else {
  console.error('usage: npm run prompts -- [list|all|next-id|claim <id>|done <id> <Dxx>|decline <id> "reason"]');
  process.exit(2);
}
