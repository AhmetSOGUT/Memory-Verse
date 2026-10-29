import { useState } from "react";
import { errorMessage } from "../api/client";
import FloatingHearts from "./FloatingHearts";

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <>
      <FloatingHearts />
      <main className="login-screen">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Bizim Hikayemiz</h1>
          <p className="login-sub">Devam etmek için giriş yap</p>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="username">Kullanıcı adı</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Parola</label>
            <div className="password-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
              >
                {showPassword ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>

          <button type="submit" className="primary-btn" disabled={busy || !username || !password}>
            {busy ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>
      </main>
    </>
  );
}

export default LoginScreen;