"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, saveAuth } from "@/lib/auth";
import styles from "../login/page.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [form, setForm] = useState({ email: "", username: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: form.email, username: form.username, password: form.password }),
      });
      saveAuth(data.access_token, data.user);
      router.push(nextPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#0b5cff"/>
            <path d="M8 14a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-8z" fill="white"/>
            <path d="M26 16l6-4v16l-6-4v-8z" fill="white"/>
          </svg>
          <span>ZoomClone</span>
        </div>

        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Join ZoomClone to start meeting</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" placeholder="you@example.com" className={styles.input}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>

          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input id="username" type="text" placeholder="johndoe" className={styles.input}
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" className={styles.input}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" placeholder="••••••••" className={styles.input}
              value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className={styles.switchText}>
          Already have an account?{" "}
          <Link href={`/login${nextPath !== "/" ? `?next=${nextPath}` : ""}`} className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
