import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, VStack, Spinner, Text } from '@chakra-ui/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ColorModeSync } from './components/ColorModeSync';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { DailyLimitPage } from './pages/DailyLimitPage';
import { StyleguideLayout, DesignTokensPage } from './pages/styleguide';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading component using Chakra UI
function LoadingScreen() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <VStack gap={4}>
        <Spinner size="xl" colorPalette="brand" />
        <Text color="gray.600">Carregando...</Text>
      </VStack>
    </Box>
  );
}

// Componente para proteger rotas privadas
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

// Componente para redirecionar usuários autenticados
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <Navigate to="/dashboard" /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Rota raiz redireciona para dashboard ou login */}
      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* Rotas públicas */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Rotas privadas */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/daily-limit"
        element={
          <PrivateRoute>
            <DailyLimitPage />
          </PrivateRoute>
        }
      />

      {/* Styleguide */}
      <Route path="/styleguide" element={<StyleguideLayout />}>
        <Route index element={<DesignTokensPage />} />
      </Route>

      {/* 404 - Deve ser a última rota */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ColorModeSync />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
