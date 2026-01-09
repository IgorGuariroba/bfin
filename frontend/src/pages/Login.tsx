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
} from '@chakra-ui/react';
import { MdEmail, MdLock } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';

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
    <Flex minH="100vh" align="center" justify="center" bg="var(--background)">
      <Container maxW="md" py={{ base: "12", md: "24" }} px={{ base: "0", sm: "8" }}>
        <VStack spacing="8">
          {/* Logo e Header */}
          <VStack spacing="2">
            <Heading
              size="2xl"
              fontWeight="extrabold"
              color="var(--foreground)"
            >
              BFIN
            </Heading>
            <Text color="var(--foreground)" fontSize="lg" opacity={0.9}>
              Bem-vindo de volta
            </Text>
          </VStack>

          {/* Card do Formulário */}
          <Card w="full" shadow="xl" borderRadius="xl" bg="var(--card)">
            <CardBody p={{ base: "6", md: "8" }}>
              <form onSubmit={handleSubmit}>
                <VStack spacing="6" align="stretch">
                  {error && (
                    <Alert status="error" borderRadius="lg" variant="subtle">
                      <AlertIcon />
                      {error}
                    </Alert>
                  )}

                  {/* Campo Email */}
                  <FormControl isRequired>
                    <FormLabel color="var(--card-foreground)" fontWeight="medium">
                      Email
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={MdEmail} color="var(--muted-foreground)" />
                      </InputLeftElement>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        size="lg"
                        bg="var(--input)"
                        borderColor="var(--border)"
                        color="var(--card-foreground)"
                        _placeholder={{ color: "var(--muted-foreground)" }}
                        focusBorderColor="var(--ring)"
                        autoComplete="email"
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Campo Senha */}
                  <FormControl isRequired>
                    <FormLabel color="var(--card-foreground)" fontWeight="medium">
                      Senha
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={MdLock} color="var(--muted-foreground)" />
                      </InputLeftElement>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        size="lg"
                        bg="var(--input)"
                        borderColor="var(--border)"
                        color="var(--card-foreground)"
                        _placeholder={{ color: "var(--muted-foreground)" }}
                        focusBorderColor="var(--ring)"
                        autoComplete="current-password"
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Botão Entrar */}
                  <Button
                    type="submit"
                    bg="var(--primary)"
                    color="var(--primary-foreground)"
                    _hover={{ opacity: 0.9 }}
                    size="lg"
                    fontSize="md"
                    fontWeight="bold"
                    isLoading={isLoading}
                    loadingText="Entrando..."
                    w="full"
                    mt="2"
                  >
                    Entrar
                  </Button>

                  {/* Divider */}
                  <Flex align="center" py="2">
                    <Divider borderColor="var(--border)" />
                    <Text px="3" color="var(--muted-foreground)" fontSize="sm" whiteSpace="nowrap">
                      Não tem uma conta?
                    </Text>
                    <Divider borderColor="var(--border)" />
                  </Flex>

                  {/* Link para Registro */}
                  <Button
                    as={RouterLink}
                    to="/register"
                    variant="outline"
                    borderColor="var(--border)"
                    color="var(--card-foreground)"
                    _hover={{ bg: "var(--secondary)", borderColor: "var(--accent)" }}
                    size="lg"
                    fontSize="md"
                    fontWeight="medium"
                  >
                    Criar conta grátis
                  </Button>
                </VStack>
              </form>
            </CardBody>
          </Card>

          {/* Footer */}
          <Text color="var(--foreground)" fontSize="sm" textAlign="center" opacity={0.8}>
            Ao continuar, você concorda com nossos{' '}
            <Link color="var(--accent)" fontWeight="medium">
              Termos de Serviço
            </Link>
          </Text>
        </VStack>
      </Container>
    </Flex>
  );
}
