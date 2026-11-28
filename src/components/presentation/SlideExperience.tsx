import type { Destination, ImageCredit } from '../../types/destination';
import { Photo } from '../ui/Photo';
import { BudgetBadge, NoveltyBadge, SecurityBadge } from '../ui/Badges';
import { computeScenario, formatEUR } from '../../lib/budget';
import { tagLabel } from '../../lib/labels';
import { usePreferences } from '../../state/preferences';
import { useEvaluations } from '../../state/evaluations';
import { useSession } from '../../state/session';
import { StatusBanner } from './StatusBanner';
import { GroupDecks } from './GroupDecks';
import { PhotoGallery } from './PhotoGallery';

export function splitTitle(title: string): { lead: string; main: string } {
  const i = title.indexOf('—');
  return i === -1 ? { lead: '', main: title } : { lead: title.slice(0, i).trim(), main: title.slice(i + 1).trim() };
}

export function SlideExperience({ d, credits }: { d: Destination; credits: Map<string, ImageCredit> }) {
  const { flightOverride } = usePreferences();
  const { novelty } = useEvaluations();
  const { session } = useSession();
  const totals = computeScenario(d.budget, 'realistic', { flightOverridePerPerson: flightOverride(d.id) });
  const { lead, main } = splitTitle(d.title);
  const hero = credits.get(d.images.hero);
  const support = d.images.experience.map((id) => credits.get(id)).filter(Boolean) as ImageCredit[];

  return (
    <article>
      <header className="relative">
        <Photo credit={hero} priority aspect="16 / 8.5" sizes="(min-width: 1024px) 55vw, 100vw" className="w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-midnight-950/90 via-midnight-950/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 text-ivory lg:px-8 lg:pb-7">
          <p className="eyebrow text-sand-400">01 — The Experience · Why should we go there?</p>
          <p className="mt-2 text-sm font-medium text-ivory/85">
            {lead || d.country} · {d.region}
          </p>
          <h1 className="mt-1 max-w-3xl text-3xl font-semibold leading-[1.05] sm:text-4xl xl:text-[2.85rem]">{main}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ivory/80 sm:text-base">{d.subtitle}</p>
        </div>
      </header>

      <div className="px-5 py-6 lg:px-8">
        <StatusBanner d={d} />

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-slate-ink/10 bg-slate-ink/10 text-sm sm:grid-cols-3 xl:grid-cols-6">
          <Fact label="Duration" value={`${d.duration.totalDays} days`} note={`incl. ${d.duration.internationalTravelDays} travel day${d.duration.internationalTravelDays === 1 ? '' : 's'}`} />
          <Fact label="Best window" value={d.recommendedTravelWindow.preferredMonth === 'Either' ? 'Feb or March' : d.recommendedTravelWindow.preferredMonth} note={d.recommendedTravelWindow.window} />
          <Fact label="Travel style" value={tagLabel(d.travelStyle.primary)} note={d.travelStyle.tags.slice(0, 3).map(tagLabel).join(' · ')} />
          <Fact
            label="Total per person"
            value={<span className="num">{formatEUR(totals.totalPerPerson)}</span>}
            note={<><span className="[&>span]:whitespace-normal"><BudgetBadge status={totals.status} /></span> <span className="block pt-1">flights incl.{totals.flightOverridden ? ' (your fare)' : ''}</span></>}
          />
          <Fact label="Security" value={<SecurityBadge status={d.security.status} size="md" />} note={`checked ${d.security.checkedAt}`} />
          <Fact label="Collective novelty" value={<NoveltyBadge entry={novelty?.[d.id]} signedIn={!!session} />} note={session ? 'based on provided travel histories' : 'private'} />
        </dl>

        <p className="mt-7 font-display text-[1.18rem] leading-relaxed text-slate-ink first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-display first-letter:text-[3.4rem] first-letter:leading-[0.8] first-letter:text-bronze-600 sm:text-[1.25rem]">
          {d.introduction}
        </p>

        {support.length > 0 && (
          <div className={`mt-7 grid gap-2 ${support.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {support.map((c) => (
              <Photo key={c.id} credit={c} caption aspect="4 / 3" sizes="(min-width: 1024px) 18vw, 33vw" />
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="eyebrow text-forest-700">Geography</h2>
            <p className="mt-2 text-sm leading-relaxed">{d.geography.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {d.geography.tags.map((t) => (
                <li key={t} className="chip border-forest-700/25 bg-forest-100 text-forest-800">
                  {tagLabel(t)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="eyebrow text-bronze-700">Culture</h2>
            <p className="mt-2 text-sm leading-relaxed">{d.culture.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {d.culture.tags.map((t) => (
                <li key={t} className="chip border-bronze-600/25 bg-sand-100 text-bronze-700">
                  {tagLabel(t)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-9">
          <h2 className="text-2xl font-semibold">Signature experiences</h2>
          <ol className="mt-4 space-y-5">
            {d.signatureExperiences.map((e, i) => {
              const img = e.imageId ? credits.get(e.imageId) : undefined;
              return (
                <li key={e.title} className="grid grid-cols-[2.25rem_1fr] gap-3 sm:grid-cols-[2.25rem_1fr_9rem]">
                  <span className="num font-display text-3xl font-light leading-none text-bronze-600">{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold leading-snug">{e.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed">{e.description}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-ink">Why it is distinctive: </span>
                      {e.whyDistinctive}
                    </p>
                    <details className="mt-1.5 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-bronze-700">How to organise it</summary>
                      <p className="mt-1 leading-relaxed text-slate-600">{e.howToOrganise}</p>
                    </details>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="chip border-slate-ink/15 bg-white/60 text-slate-600">📍 {e.location}</span>
                      <span className="chip border-slate-ink/15 bg-white/60 text-slate-600">
                        {e.costPerPersonEUR === null ? 'Cost unknown' : e.costPerPersonEUR === 0 ? 'Free' : `≈ ${formatEUR(e.costPerPersonEUR)} pp`}
                      </span>
                      {e.requiresGuide && <span className="chip border-amber-warn/30 bg-amber-bg text-amber-warn">Guide required</span>}
                      {e.requiresPermit && <span className="chip border-amber-warn/30 bg-amber-bg text-amber-warn">Permit required</span>}
                    </div>
                  </div>
                  {img && <Photo credit={img} aspect="1 / 1" showCredit={false} sizes="9rem" className="hidden rounded-sm sm:block" />}
                </li>
              );
            })}
          </ol>
        </section>

        <PhotoGallery credits={credits} title={d.title} />

        <section className="mt-10 rounded-sm bg-midnight-900 p-5 text-ivory lg:p-6">
          <h2 className="text-xl font-semibold">What makes this expedition exceptional?</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <Compare label="Compared with Oman" text={d.exceptional.vsOman} />
            <Compare label="Compared with package tourism" text={d.exceptional.vsPackageTourism} />
            <Compare label="Within this portfolio" text={d.exceptional.vsPortfolio} />
          </div>
        </section>

        {d.portfolioNote && <p className="mt-6 text-sm italic text-slate-600">{d.portfolioNote}</p>}

        <GroupDecks destinationId={d.id} />
      </div>
    </article>
  );
}

function Fact({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="bg-paper p-3">
      <dt className="eyebrow text-[0.6rem] text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold leading-tight">{value}</dd>
      {note && <dd className="mt-1 text-[0.7rem] leading-snug text-slate-500">{note}</dd>}
    </div>
  );
}

function Compare({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="eyebrow text-[0.62rem] text-sand-400">{label}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ivory/85">{text}</p>
    </div>
  );
}
