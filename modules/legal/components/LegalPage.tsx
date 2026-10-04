import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppLogo } from '@/shared/components/Sidebar';
import { LEGAL } from '@/shared/legal';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Public, server-rendered layout for the legal documents: no sign-in, no app frame,
 * and all text in the initial HTML so link checkers (e.g. Meta app review) can read it.
 */
export function LegalPage({ title, intro, sections, current }: { title: string; intro: ReactNode; sections: LegalSection[]; current: 'privacy' | 'terms' }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-divider bg-panel">
        <div className="mx-auto flex max-w-[820px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${LEGAL.appName} home`}>
            <AppLogo size={28} />
            <span className="font-heading text-[18px] font-bold">{LEGAL.appName}</span>
          </Link>
          <nav aria-label="Legal" className="flex gap-1 text-[14px]">
            <Link href="/privacy" aria-current={current === 'privacy' ? 'page' : undefined} className={current === 'privacy' ? 'legal-tab legal-tab-on' : 'legal-tab'}>
              Privacy
            </Link>
            <Link href="/terms" aria-current={current === 'terms' ? 'page' : undefined} className={current === 'terms' ? 'legal-tab legal-tab-on' : 'legal-tab'}>
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-4 pb-20 pt-10 sm:px-6">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.01em] sm:text-[40px]">{title}</h1>
        <p className="mt-2 text-[14px] text-muted">
          Effective {LEGAL.effectiveDate} · {LEGAL.appDescription}
        </p>
        <div className="legal mt-6">{intro}</div>

        <nav aria-label="Contents" className="panel mt-8 px-5 py-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Contents</p>
          <ol className="grid gap-x-6 gap-y-1.5 text-[14.5px] sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-accent-700 hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal mt-4">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`}>
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-divider pt-6 text-[14px] text-muted">
          Questions about this document? Email{' '}
          <a className="text-accent-700 hover:underline" href={`mailto:${LEGAL.contactEmail}`}>
            {LEGAL.contactEmail}
          </a>
          .{' '}
          {current === 'privacy' ? (
            <>
              See also the <Link href="/terms" className="text-accent-700 hover:underline">Terms of Service</Link>.
            </>
          ) : (
            <>
              See also the <Link href="/privacy" className="text-accent-700 hover:underline">Privacy Policy</Link>.
            </>
          )}
        </footer>
      </main>
    </div>
  );
}

/** mailto link to the contact address, used inside the documents. */
export function ContactEmail({ subject }: { subject?: string }) {
  const href = `mailto:${LEGAL.contactEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  return <a href={href}>{LEGAL.contactEmail}</a>;
}
