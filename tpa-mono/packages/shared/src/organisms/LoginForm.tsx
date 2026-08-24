import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';

export interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  error?: string;
  title?: string;
  subtitle?: string;
}

export function LoginForm({ onSubmit, error, title = 'Kasir Solo - TPA', subtitle }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(email, password);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, onSubmit]);

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            📖
          </div>
          <h1 class="text-2xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p class="text-gray-500 mt-1">{subtitle}</p>}
        </div>

        <form onSubmit={handleSubmit} class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onInput={(e: any) => setEmail(e.target.value)}
            placeholder="ustadz@tpa.com"
            required
            leftIcon="📧"
          />

          <Input
            label="Kata Sandi"
            type="password"
            value={password}
            onInput={(e: any) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            leftIcon="🔒"
          />

          <Button type="submit" fullWidth isLoading={isLoading}>
            Masuk
          </Button>
        </form>

        <p class="text-center text-xs text-gray-400 mt-6">
          PT Mesin Kasir Solo | kasirsolo.app
        </p>
      </div>
    </div>
  );
}
