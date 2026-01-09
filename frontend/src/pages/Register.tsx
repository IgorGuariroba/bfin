import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Heading, Text, Link, Alert, AlertIcon } from '@chakra-ui/react';
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
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50" py="12" px={{ base: "4", sm: "6", lg: "8" }}>
      <Box maxW="md" w="full" mx="auto" py="12" px={{ base: "4", sm: "6" }}>
        <Box mb="8">
          <Heading as="h1" fontSize="4xl" fontWeight="bold" color="brand.600" textAlign="center" mb="2">
            BFIN
          </Heading>
          <Heading as="h2" fontSize="3xl" fontWeight="bold" color="gray.900" textAlign="center" mb="2">
            Criar conta
          </Heading>
          <Text fontSize="sm" color="gray.600" textAlign="center">
            Comece a gerenciar suas finanças hoje
          </Text>
        </Box>

        <Box as="form" onSubmit={handleSubmit}>
          {error && (
            <Alert status="error" borderRadius="md" mb="6">
              <AlertIcon />
              {error}
            </Alert>
          )}

          <Box mb="5">
            <FormField
              label="Nome completo"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              isRequired
              placeholder="João Silva"
              autoComplete="name"
            />
          </Box>

          <Box mb="5">
            <FormField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isRequired
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </Box>

          <Box mb="5">
            <FormField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isRequired
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Box>

          <Box mb="6">
            <FormField
              label="Confirmar senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              isRequired
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Box>

          <Button type="submit" width="full" isLoading={isLoading} size="lg" mb="6">
            Criar conta
          </Button>

          <Text textAlign="center" fontSize="sm" color="gray.600">
            Já tem uma conta?{' '}
            <Link as={RouterLink} to="/login" fontWeight="medium" color="brand.600" _hover={{ color: 'brand.500' }}>
              Fazer login
            </Link>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
