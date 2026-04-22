import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { requestNotificationPermission, subscribeToPush } from '../utils/pushNotifications';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Subscribe to push when user is authenticated
  useEffect(() => {
    if (user && token) {
      requestNotificationPermission().then((permission) => {
        if (permission === 'granted') {
          subscribeToPush(token);
        }
      });
    }
  }, [user, token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    // Store the redirect path from sessionStorage so callers can check it
    userData._redirectAfterLogin = sessionStorage.getItem('redirectAfterLogin') || null;
    return userData;
  };

  const register = async (userData) => {
    await axios.post(`${API_URL}/api/auth/register`, userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isSeller: user?.role === 'seller' || user?.role === 'both',
    isBuyer: user?.role === 'buyer' || user?.role === 'both',
    isApproved: user?.status === 'approved'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};