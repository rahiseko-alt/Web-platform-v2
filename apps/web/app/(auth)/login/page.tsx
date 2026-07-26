'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';

/**
 * 最小限の email/password ログインフォーム（仮説#2実機検証用。UI磨込はP1 Step4で別途行う）。
 * バリデーションはクライアント側属性（required/type）はUX補助に過ぎず、
 * 実体の検証・認証は better-auth サーバー側（/api/auth/sign-in/email）が行う。
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (signInError) {
      // security-runtime.md エラー隠蔽: メール/パスワードどちらが誤りかを区別せず抽象化する
      setError('メールアドレスまたはパスワードが正しくありません');
      return;
    }
    router.push('/editor');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">ログイン</h1>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email"
          className="w-full border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="password"
          className="w-full border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? '送信中...' : 'ログイン'}
        </button>
      </form>
    </main>
  );
}
