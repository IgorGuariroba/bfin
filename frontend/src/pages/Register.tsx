import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Container, Heading, Text, Link, Alert, AlertIcon, Stack } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/atoms/Button';
import { FormField } from '../components/molecules/FormField';

export function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validações
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, fullName);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50" py={12} px={{ base: 4, sm: 6, lg: 8 }}>
      <Container maxW="md" w="full">
        <Stack spacing={8} mx="auto" maxW="lg" py={12} px={{ base: 4, sm: 6 }}>
          <Stack spacing={3} align="center" textAlign="center">
            <Heading as="h1" fontSize="4xl" fontWeight="bold" color="brand.600">
              BFIN
            </Heading>
            <Heading as="h2" fontSize="3xl" fontWeight="bold" color="gray.900">
              Criar conta
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Comece a gerenciar suas finanças hoje
            </Text>
          </Stack>

          <Box as="form" onSubmit={handleSubmit}>
            <Stack spacing={6}>
              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              <Stack spacing={5}>
                <FormField
                  label="Nome completo"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  isRequired
                  placeholder="João Silva"
                  autoComplete="name"
                />

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
                  autoComplete="new-password"
                />

                <FormField
                  label="Confirmar senha"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  isRequired
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Stack>

              <Button type="submit" width="full" isLoading={isLoading} size="lg">
                Criar conta
              </Button>

              <Text textAlign="center" fontSize="sm" color="gray.600">
                Já tem uma conta?{' '}
                <Link as={RouterLink} to="/login" fontWeight="medium" color="brand.600" _hover={{ color: 'brand.500' }}>
                  Fazer login
                </Link>
              </Text>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
