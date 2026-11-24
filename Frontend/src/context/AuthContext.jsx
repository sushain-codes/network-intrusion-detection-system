import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth.service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Validate existing token on startup
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        if (isMounted) {
          if (response.data?.success && response.data?.data?.user) {
            setUser(response.data.data.user);
            setToken(storedToken);
          } else {
            localStorage.removeItem('token');
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        // Token expired, blacklisted, or invalid
        if (isMounted) {
          localStorage.removeItem('token');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Log in user, store token in localStorage, and update context state
   */
  const login = async (email, password) => {
    const response = await authService.login(email, password);
    const { token: receivedToken, user: receivedUser } = response.data.data;

    localStorage.setItem('token', receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);

    return response.data;
  };

  /**
   * Register new user, store token in localStorage, and update context state
   */
  const register = async (name, email, password) => {
    const response = await authService.register(name, email, password);
    const { token: receivedToken, user: receivedUser } = response.data.data;

    localStorage.setItem('token', receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);

    return response.data;
  };

  /**
   * Call backend logout to blacklist the token, clear localStorage and reset state
   */
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Backend logout error (token may already be invalidated):', err.message);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
