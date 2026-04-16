import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/auth/AuthProvider";
import { hasFirebaseConfig } from "@/lib/firebase";

export function LoginPage() {
  const { user, role, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user && role) {
    return <Navigate to={role === "courier" ? "/courier" : "/home"} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container">
      <Card className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">MIV Console Login</h1>
          <p className="text-sm text-text-secondary">Sign in with a Firebase Auth account.</p>
        </header>

        {!hasFirebaseConfig ? (
          <p className="rounded-control border border-red-900/50 bg-red-900/20 p-3 text-sm text-red-200">
            Firebase environment variables are missing. Configure VITE_FIREBASE_* before login.
          </p>
        ) : null}

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />
          </label>
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
          <Button type="submit" disabled={loading || !hasFirebaseConfig} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
