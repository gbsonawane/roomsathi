import { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
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
        setAuthStorage(storedToken, profile);
      })
      .catch(() => {
        clearAuthStorage();
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async ({ access_token, user }) => {
    setToken(access_token);
    setUser(user);
    setAuthStorage(access_token, user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearAuthStorage();
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
