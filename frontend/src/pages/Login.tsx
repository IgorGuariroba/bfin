import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Container, VStack, Heading, Text, Link, Alert, AlertIcon } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/atoms/Button';
import { FormField } from '../components/molecules/FormField';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50" px={4}>
      <Container maxW="md" w="full">
        <VStack spacing={8}>
          <VStack spacing={2} textAlign="center">
            <Heading size="2xl" color="brand.600">BFIN</Heading>
            <Heading size="xl" color="gray.900">
              Bem-vindo de volta
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Faça login para acessar sua conta
            </Text>
          </VStack>

          <Box as="form" w="full" onSubmit={handleSubmit}>
            <VStack spacing={6}>
              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              <VStack spacing={4} w="full">
                <FormField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  isRequired
                  placeholder="seu@email.com"
                  autoComplete="email"
                />

                <FormField
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isRequired
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </VStack>

              <Button type="submit" w="full" isLoading={isLoading}>
                Entrar
              </Button>

              <Text textAlign="center" fontSize="sm" color="gray.600">
                Não tem uma conta?{' '}
                <Link as={RouterLink} to="/register" fontWeight="medium" color="brand.600" _hover={{ color: 'brand.500' }}>
                  Criar conta
                </Link>
              </Text>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
