import { auth } from "./auth";

export interface SessionUser {
  userId: string;
  email: string;
  name: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
