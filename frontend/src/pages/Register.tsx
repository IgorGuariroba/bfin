import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  Link,
  Container,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  InputGroup,
  InputLeftElement,
  Icon,
  Divider,
  Flex,
  Box,
} from '@chakra-ui/react';
import { MdEmail, MdLock, MdPerson } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ui/ThemeToggle';

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
    <Flex minH="100vh" align="center" justify="center" bg="var(--background)" position="relative">
      {/* Theme Toggle - Fixed top-right */}
      <Box position="absolute" top={4} right={4} zIndex={10}>
        <ThemeToggle variant="icon" size="md" />
      </Box>

      <Container maxW="md" py={{ base: "12", md: "24" }} px={{ base: "0", sm: "8" }}>
        <VStack spacing="8">
          {/* Logo e Header */}
          <VStack spacing="2">
            <Heading
              size="2xl"
              fontWeight="extrabold"
              bgGradient="linear(to-r, brand.600, brand.800)"
              bgClip="text"
            >
              BFIN
            </Heading>
            <Text color="gray.600" fontSize="lg">
              Crie sua conta gratuitamente
            </Text>
          </VStack>

          {/* Card do Formulário */}
          <Card w="full" shadow="xl" borderRadius="xl">
            <CardBody p={{ base: "6", md: "8" }}>
              <form onSubmit={handleSubmit}>
                <VStack spacing="5" align="stretch">
                  {error && (
                    <Alert status="error" borderRadius="lg" variant="subtle">
                      <AlertIcon />
                      {error}
                    </Alert>
                  )}

                  {/* Campo Nome Completo */}
                  <FormControl isRequired>
                    <FormLabel color="gray.700" fontWeight="medium">
                      Nome completo
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={MdPerson} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        type="text"
                        placeholder="João Silva"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        size="lg"
                        focusBorderColor="brand.500"
                        autoComplete="name"
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Campo Email */}
                  <FormControl isRequired>
                    <FormLabel color="gray.700" fontWeight="medium">
                      Email
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={MdEmail} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        size="lg"
                        focusBorderColor="brand.500"
                        autoComplete="email"
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Campo Senha */}
                  <FormControl isRequired>
                    <FormLabel color="gray.700" fontWeight="medium">
                      Senha
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={MdLock} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        size="lg"
                        focusBorderColor="brand.500"
                        autoComplete="new-password"
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Campo Confirmar Senha */}
                  <FormControl isRequired>
                    <FormLabel color="gray.700" fontWeight="medium">
                      Confirmar senha
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={MdLock} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        type="password"
                        placeholder="Digite a senha novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        size="lg"
                        focusBorderColor="brand.500"
                        autoComplete="new-password"
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Botão Criar Conta */}
                  <Button
                    type="submit"
                    colorScheme="brand"
                    size="lg"
                    fontSize="md"
                    fontWeight="bold"
                    isLoading={isLoading}
                    loadingText="Criando conta..."
                    w="full"
                    mt="2"
                  >
                    Criar conta
                  </Button>

                  {/* Divider */}
                  <Flex align="center" py="2">
                    <Divider />
                    <Text px="3" color="gray.500" fontSize="sm" whiteSpace="nowrap">
                      Já tem uma conta?
                    </Text>
                    <Divider />
                  </Flex>

                  {/* Link para Login */}
                  <Button
                    as={RouterLink}
                    to="/login"
                    variant="outline"
                    colorScheme="brand"
                    size="lg"
                    fontSize="md"
                    fontWeight="medium"
                  >
                    Fazer login
                  </Button>
                </VStack>
              </form>
            </CardBody>
          </Card>

          {/* Footer */}
          <Text color="gray.500" fontSize="sm" textAlign="center">
            Ao criar uma conta, você concorda com nossos{' '}
            <Link color="brand.600" fontWeight="medium">
              Termos de Serviço
            </Link>
          </Text>
        </VStack>
      </Container>
    </Flex>
  );
}
