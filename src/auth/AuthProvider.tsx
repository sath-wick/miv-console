import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { auth } from "@/lib/firebase";
import type { Role } from "@/types/models";

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRole(null);
        setLoading(false);
        return;
      }

      const token = await nextUser.getIdTokenResult();
      const nextRole = token.claims.role;
      setRole(nextRole === "admin" || nextRole === "courier" ? nextRole : null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      loading,
      signIn: async (email: string, password: string) => {
        if (!auth) {
          throw new Error("Firebase Auth is not configured.");
        }
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        if (!auth) {
          return;
        }
        await firebaseSignOut(auth);
      }
    }),
    [loading, role, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
