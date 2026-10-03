/**
 * Routes that render without signing in. The legal pages must stay public: Meta's
 * WhatsApp app review (and anyone deciding whether to sign up) has to be able to read them.
 */
const PUBLIC_PREFIXES = ['/auth/signin', '/auth/register', '/privacy', '/terms'];

/** Routes rendered without the app frame (sidebar, tab bar, assistant button). */
const BARE_PREFIXES = ['/auth', '/privacy', '/terms'];

const matches = (prefixes: string[], pathname: string | null | undefined) =>
  !!pathname && prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const isPublicPath = (pathname: string | null | undefined) => matches(PUBLIC_PREFIXES, pathname);
export const isBarePath = (pathname: string | null | undefined) => matches(BARE_PREFIXES, pathname);
