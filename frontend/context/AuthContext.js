import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe } from "../lib/api";
import { getStoredToken, getStoredUser, setAuthStorage, clearAuthStorage } from "../lib/auth";

const AuthContext = createContext({
  token: null,
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);
      // Optimistically set the cached user so the UI renders immediately,
      // but ALWAYS re-fetch /me from the server to get the latest role.
      if (storedUser) {
        setUser(storedUser);
      }

      getMe(storedToken)
        .then((profile) => {
          setUser(profile);
          if (typeof window !== "undefined") {
            setAuthStorage(storedToken, profile);
          }
        })
        .catch(() => {
          if (typeof window !== "undefined") {
            clearAuthStorage();
          }
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } catch (e) {
      if (typeof window !== "undefined") {
        clearAuthStorage();
      }
      setToken(null);
      setUser(null);
      setLoading(false);
    } finally {
      setMounted(true);
    }
  }, []);

  const login = useCallback(async ({ access_token, user }) => {
    setToken(access_token);
    setUser(user);
    if (typeof window !== "undefined") {
      setAuthStorage(access_token, user);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      clearAuthStorage();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {mounted ? (
        children
      ) : (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "white",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              border: "3px solid #e5e7eb",
              borderTop: "3px solid #065f46",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
