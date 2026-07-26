'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';

/**
 * 最小限の email/password サインアップフォーム（仮説#2実機検証用）。
 * organization紐付けは今回スコープ外（ユーザー登録のみ。memory.md指示に準拠）。
 */
export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (signUpError) {
      // security-runtime.md エラー隠蔽: サーバー側の詳細（重複email等）をそのまま出さず抽象化する
      setError('登録に失敗しました。入力内容をご確認ください');
      return;
    }
    router.push('/editor');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">アカウント作成</h1>
        <input
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="name"
          className="w-full border px-3 py-2"
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="password（8文字以上）"
          className="w-full border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? '送信中...' : '登録'}
        </button>
      </form>
    </main>
  );
}
