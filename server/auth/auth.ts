import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { devAuthBypass } from "@/config/server";

const devBypass = devAuthBypass();
if (devBypass.enabled) {
  console.warn(`[Auth] DEV_AUTH_BYPASS is ON — sign-in skips the password and uses ${devBypass.email}. Never enable outside local development.`);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  debug: process.env.NODE_ENV !== "production",
  logger: {
    error: (error) => {
      console.error("[NextAuth][Error]", error);
    },
    warn: (code) => {
      console.warn("[NextAuth][Warn]", code);
    },
  },
  // Map our Drizzle table names (users, accounts, …) — default adapter uses user, account, session, …
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    Google({
      clientId: process.env.GMAIL_CLIENT_ID ?? "",
      clientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.hashedPassword) return null;

        const isValid = await bcrypt.compare(password, user.hashedPassword);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    // Local development only (see devAuthBypass): signs in as a fixed dev
    // user, created on first use. Not registered at all in production.
    ...(devBypass.enabled
      ? [
          Credentials({
            id: "dev-bypass",
            name: "Development bypass",
            credentials: {},
            async authorize() {
              const [existing] = await db.select().from(users).where(eq(users.email, devBypass.email)).limit(1);
              const user =
                existing ??
                (await db.insert(users).values({ name: "Dev User", email: devBypass.email }).returning())[0];
              return { id: user.id, name: user.name, email: user.email, image: user.image };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
