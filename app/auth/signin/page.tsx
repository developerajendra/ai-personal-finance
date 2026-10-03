"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2, Shield, TrendingUp, Zap, LogIn } from "lucide-react";

// Development-only: the server must also have DEV_AUTH_BYPASS=true, otherwise
// the "dev-bypass" provider doesn't exist and sign-in fails safely.
const DEV_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = DEV_AUTH_BYPASS
        ? await signIn("dev-bypass", { redirect: false })
        : await signIn("credentials", {
            email,
            password,
            redirect: false,
          });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-tile via-accent-500 to-accent-700 p-4">
      <div className="bg-panel rounded-2xl shadow-2xl p-10 max-w-lg w-full mx-4 border border-divider">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-accent to-accent-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <LogIn className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-ink mb-3 bg-gradient-to-r from-accent to-accent-700 bg-clip-text text-transparent">
            Sign In
          </h1>
          <p className="text-muted text-lg">
            Access your personal finance dashboard
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-accent to-accent-700 border border-accent-200">
            <TrendingUp className="w-5 h-5 text-accent-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">Auto-sync Investments</p>
              <p className="text-xs text-muted">Automatically extract investment data from emails</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-gain to-gain border border-divider">
            <Zap className="w-5 h-5 text-gain mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">Real-time Updates</p>
              <p className="text-xs text-muted">Keep your portfolio updated automatically</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-accent to-loss border border-accent-200">
            <Shield className="w-5 h-5 text-accent-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">Secure & Private</p>
              <p className="text-xs text-muted">Your data is encrypted and secure</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full group relative overflow-hidden flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-loss via-warn to-gain text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg transition-all duration-300 mb-4"
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <Mail className="w-5 h-5" />
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-divider" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-panel px-4 text-muted">or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleCredentialsSubmit} noValidate={DEV_AUTH_BYPASS} className="space-y-4">
          {DEV_AUTH_BYPASS && (
            <div className="bg-warn-bg text-warn text-sm p-3 rounded-lg border border-divider">
              Development mode: login is bypassed — just click Sign In.
            </div>
          )}
          {error && (
            <div className="bg-loss-bg text-loss text-sm p-3 rounded-lg border border-divider">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-divider rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
              placeholder="you@example.com"
              required={!DEV_AUTH_BYPASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-divider rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
              placeholder="Enter your password"
              required={!DEV_AUTH_BYPASS}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-accent to-accent-700 text-white rounded-xl hover:from-accent hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg shadow-blue-500/30 transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-accent-700 hover:text-accent-700 font-medium">
            Create one
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          {" · "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
