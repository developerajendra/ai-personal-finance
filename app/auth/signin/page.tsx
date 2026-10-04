"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Development-only: the server must also have DEV_AUTH_BYPASS=true, otherwise
// the "dev-bypass" provider doesn't exist and sign-in fails safely.
const DEV_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

// Scoped styles for the login screen: the design is a fixed Apple-style look,
// independent of the in-app skin/accent tokens.
const LOGIN_CSS = `
.lg-root{--lg-font:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;font-family:var(--lg-font);color:#1d1d1f;-webkit-font-smoothing:antialiased}
.lg-root a{color:#0066cc;text-decoration:none}
.lg-root a:hover{color:#0053a6;text-decoration:underline}
.lg-root button:focus-visible{outline:2px solid #0071e3;outline-offset:2px}
.lg-btn{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.1);color:#1d1d1f;font:inherit;font-size:16px;font-weight:500;cursor:pointer;transition:background .15s}
.lg-btn:hover{background:#fafafa}
.lg-btn:active{background:#f0f0f3}
.lg-btn:disabled{cursor:default}
.lg-btn-primary{background:#0071e3;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.lg-btn-primary:hover{background:#0077ed}
.lg-btn-primary:active{background:#006edb}
.lg-input{width:100%;min-height:48px;box-sizing:border-box;padding:0 16px;border:0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.1);color:#1d1d1f;font:inherit;font-size:16px;outline:none;transition:box-shadow .15s}
.lg-input::placeholder{color:#86868b}
.lg-input:focus{box-shadow:0 0 0 .5px rgba(0,0,0,.1),0 0 0 3px rgba(0,113,227,.35)}
.lg-spin{width:16px;height:16px;box-sizing:border-box;border-radius:50%;border:2px solid #d2d2d7;border-top-color:#0071e3;animation:lgSpin .8s linear infinite}
.lg-spin-light{border-color:rgba(255,255,255,.45);border-top-color:#fff}
@keyframes lgSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.lg-root *{animation:none!important;transition:none!important}}
`;

function Spinner({ light = false }: { light?: boolean }) {
  return <span aria-hidden="true" className={light ? "lg-spin lg-spin-light" : "lg-spin"} />;
}

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
    <div
      className="lg-root"
      data-screen-label="Login"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#f5f5f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        padding: 24,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60vw 50vh at 28% 30%,#cfe3fa,transparent 70%),radial-gradient(55vw 48vh at 74% 72%,#ffd6df,transparent 70%),radial-gradient(45vw 40vh at 70% 22%,#e8e8ed,transparent 70%)",
        }}
      />
      <main
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 400,
          boxSizing: "border-box",
          padding: "44px clamp(24px,6vw,40px) 36px",
          background: "rgba(255,255,255,.62)",
          backdropFilter: "blur(30px) saturate(1.6)",
          WebkitBackdropFilter: "blur(30px) saturate(1.6)",
          borderRadius: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,.1),inset 0 0 0 .5px rgba(255,255,255,.8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          textAlign: "center",
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 32 32"
          aria-hidden="true"
          style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,.18))" }}
        >
          <rect width="32" height="32" rx="8" fill="#1d1d1f" />
          <path d="M9 7.5V23.5H25" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 19L16.5 15.5L19 17.5L23.5 11.5" fill="none" stroke="#5aa4ec" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23.5" cy="11.5" r="1.9" fill="#fff" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ margin: 0, fontFamily: "inherit", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.12, color: "#1d1d1f" }}>
            Personal Finance
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "#424245", textWrap: "pretty" }}>
            Your accounts, spending and subscriptions in one place.
          </p>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            aria-busy={isGoogleLoading}
            className="lg-btn"
          >
            {isGoogleLoading ? (
              <Spinner />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
            )}
            <span>{isGoogleLoading ? "Connecting to Google…" : "Continue with Google"}</span>
          </button>
        </div>

        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "#86868b" }}>
          <span style={{ flex: 1, height: 0.5, background: "rgba(0,0,0,.15)" }} />
          <span>or sign in with email</span>
          <span style={{ flex: 1, height: 0.5, background: "rgba(0,0,0,.15)" }} />
        </div>

        <form
          onSubmit={handleCredentialsSubmit}
          noValidate={DEV_AUTH_BYPASS}
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}
        >
          {DEV_AUTH_BYPASS && (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: "#424245", textAlign: "center" }}>
              Development mode: login is bypassed — just click Sign In.
            </p>
          )}
          <input
            type="email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="lg-input"
            placeholder="Email"
            autoComplete="email"
            required={!DEV_AUTH_BYPASS}
          />
          <input
            type="password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="lg-input"
            placeholder="Password"
            autoComplete="current-password"
            required={!DEV_AUTH_BYPASS}
          />
          <button type="submit" disabled={isLoading} aria-busy={isLoading} className="lg-btn lg-btn-primary">
            {isLoading && <Spinner light />}
            <span>{isLoading ? "Signing in…" : "Sign In"}</span>
          </button>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13.5, color: "#c2183c", textAlign: "center" }}>
              {error}
            </p>
          )}
        </form>

        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#424245" }}>
          Don&apos;t have an account? <Link href="/auth/register">Create one</Link>
        </p>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#424245" }}>
          By continuing you agree to the <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
