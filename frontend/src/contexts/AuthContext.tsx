import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, full_name: string) => Promise<void>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário salvo no localStorage
    const loadUser = async () => {
      const token = localStorage.getItem('@bfin:token');
      const storedUser = localStorage.getItem('@bfin:user');

      if (token && storedUser) {
        try {
          // Validar token buscando dados do usuário
          const { data } = await api.get('/auth/me');
          setUser(data);
        } catch (error) {
          // Token inválido, limpar localStorage
          localStorage.removeItem('@bfin:token');
          localStorage.removeItem('@bfin:refreshToken');
          localStorage.removeItem('@bfin:user');
        }
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
      });

      const { user, tokens } = data;

      // Salvar no localStorage
      localStorage.setItem('@bfin:token', tokens.access_token);
      localStorage.setItem('@bfin:refreshToken', tokens.refresh_token);
      localStorage.setItem('@bfin:user', JSON.stringify(user));

      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao fazer login');
    }
  }

  async function signUp(email: string, password: string, full_name: string) {
    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        full_name,
      });

      const { user, tokens } = data;

      // Salvar no localStorage
      localStorage.setItem('@bfin:token', tokens.access_token);
      localStorage.setItem('@bfin:refreshToken', tokens.refresh_token);
      localStorage.setItem('@bfin:user', JSON.stringify(user));

      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao criar conta');
    }
  }

  function signOut() {
    // Limpar localStorage
    localStorage.removeItem('@bfin:token');
    localStorage.removeItem('@bfin:refreshToken');
    localStorage.removeItem('@bfin:user');

    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
