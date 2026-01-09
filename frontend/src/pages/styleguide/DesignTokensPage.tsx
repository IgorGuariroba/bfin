import { useState } from "react"
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  Button,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardHeader,
  CardBody,
  RadioGroup,
  Radio,
  Stack,
  Icon,
  useColorMode,
  Flex,
  SimpleGrid,
  Input,
  Tooltip,
  Code,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from "@chakra-ui/react"
import { Sun, Moon, Info, AlertCircle, CheckCircle, AlertTriangle, Check, Copy } from "lucide-react"

// Color swatch component with copy functionality
function ColorSwatch({
  name,
  cssVar,
  showContrast,
  contrastRatio,
}: {
  name: string
  cssVar: string
  showContrast?: boolean
  contrastRatio?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`var(${cssVar})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <VStack spacing={2} align="stretch">
      <Tooltip label={copied ? "Copiado!" : "Clique para copiar"} hasArrow>
        <Box
          w="full"
          h="16"
          borderRadius="lg"
          border="1px"
          borderColor="gray.200"
          shadow="sm"
          cursor="pointer"
          onClick={handleCopy}
          position="relative"
          transition="all 0.2s"
          _hover={{ transform: "scale(1.02)", shadow: "md" }}
          style={{ backgroundColor: `var(${cssVar})` }}
        >
          {copied && (
            <Flex
              position="absolute"
              inset={0}
              align="center"
              justify="center"
              bg="blackAlpha.600"
              borderRadius="lg"
            >
              <Icon as={Check} color="white" boxSize={5} />
            </Flex>
          )}
        </Box>
      </Tooltip>
      <Box fontSize="xs">
        <Text fontWeight="medium" color="gray.900">{name}</Text>
        <Text color="gray.500" fontFamily="mono" fontSize="2xs">{cssVar}</Text>
        {showContrast && contrastRatio && (
          <Badge colorScheme="green" fontSize="2xs" mt={1}>{contrastRatio}</Badge>
        )}
      </Box>
    </VStack>
  )
}

// Color scale component
function ColorScale({
  name,
  prefix,
  baseShade = "500"
}: {
  name: string
  prefix: string
  baseShade?: string
}) {
  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

  return (
    <VStack spacing={3} align="stretch">
      <Heading size="sm" color="gray.900">{name}</Heading>
      <Grid templateColumns="repeat(11, 1fr)" gap={1}>
        {shades.map((shade) => (
          <VStack key={shade} spacing={1}>
            <Box
              h="12"
              w="full"
              borderRadius="md"
              border={shade === baseShade ? "3px solid" : "1px solid"}
              borderColor={shade === baseShade ? "gray.900" : "gray.200"}
              style={{ backgroundColor: `var(--${prefix}-${shade})` }}
            />
            <Text
              fontSize="2xs"
              color="gray.500"
              textAlign="center"
              fontWeight={shade === baseShade ? "bold" : "normal"}
            >
              {shade}
            </Text>
          </VStack>
        ))}
      </Grid>
    </VStack>
  )
}

// Contrast pair component
function ContrastPair({
  bgVar,
  fgVar,
  bgName,
  fgName,
  ratio,
  passes,
}: {
  bgVar: string
  fgVar: string
  bgName: string
  fgName: string
  ratio: string
  passes: boolean
}) {
  return (
    <HStack spacing={4} p={4} borderRadius="lg" border="1px" borderColor="gray.200">
      <Box
        w="24"
        h="16"
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
        style={{ backgroundColor: `var(${bgVar})` }}
      >
        <Text fontWeight="semibold" fontSize="sm" style={{ color: `var(${fgVar})` }}>
          Aa
        </Text>
      </Box>
      <VStack align="start" spacing={0} flex={1}>
        <Text fontSize="sm" fontWeight="medium" color="gray.900">
          {fgName} on {bgName}
        </Text>
        <Text fontSize="xs" color="gray.500" fontFamily="mono">
          {fgVar} / {bgVar}
        </Text>
      </VStack>
      <Badge colorScheme={passes ? "green" : "red"} fontSize="xs">
        {ratio} {passes ? "✓" : "✗"}
      </Badge>
    </HStack>
  )
}

export function DesignTokensPage() {
  const { colorMode, toggleColorMode } = useColorMode()
  const [radioValue, setRadioValue] = useState("option-1")
  const isDark = colorMode === "dark"

  return (
    <Box minH="100vh" p={8} bg="var(--background)" color="var(--foreground)">
      <Container maxW="7xl">
        <VStack spacing={16} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="start" wrap="wrap" gap={4}>
            <Box>
              <Badge colorScheme="purple" mb={2}>BFIN Design System v2.0</Badge>
              <Heading size="xl" color="var(--foreground)">Design Tokens</Heading>
              <Text fontSize="lg" color="var(--muted-foreground)" mt={2}>
                Sistema de cores semânticas baseado em <Code colorScheme="purple">#7C3AED</Code> com acessibilidade WCAG AA
              </Text>
            </Box>
            <Button
              variant="outline"
              leftIcon={<Icon as={isDark ? Sun : Moon} boxSize={4} />}
              onClick={toggleColorMode}
              borderRadius="full"
              borderColor="var(--border)"
              color="var(--foreground)"
              _hover={{ bg: "var(--accent)" }}
            >
              {isDark ? "Light" : "Dark"} Mode
            </Button>
          </Flex>

          {/* Primary Color Hero */}
          <Card bg="var(--primary)" color="var(--primary-foreground)" overflow="hidden">
            <CardBody p={8}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} alignItems="center">
                <VStack align="start" spacing={4}>
                  <Heading size="lg">Cor Primária</Heading>
                  <Text fontSize="5xl" fontWeight="bold" fontFamily="mono">#7C3AED</Text>
                  <Text opacity={0.9}>
                    HSL: 263°, 84%, 58% — Um roxo vibrante e moderno que transmite
                    inovação, confiança e sofisticação.
                  </Text>
                  <HStack spacing={2}>
                    <Badge bg="whiteAlpha.200" color="white">Purple 500</Badge>
                    <Badge bg="whiteAlpha.200" color="white">Contraste 8.2:1 ✓</Badge>
                  </HStack>
                </VStack>
                <Flex justify="center">
                  <Box
                    w="40"
                    h="40"
                    borderRadius="3xl"
                    bg="whiteAlpha.200"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="6xl" fontWeight="black">B</Text>
                  </Box>
                </Flex>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Purple Scale */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Escala de Roxo (Primária)</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                10 tons gerados a partir de #7C3AED como base (500)
              </Text>
            </Box>
            <Card bg="var(--card)">
              <CardBody>
                <ColorScale name="" prefix="purple" baseShade="500" />
              </CardBody>
            </Card>
          </VStack>

          {/* Semantic Colors */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Cores Semânticas de Interface</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Cores funcionais para diferentes elementos da UI
              </Text>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              {/* Background & Foreground */}
              <Card bg="var(--card)">
                <CardHeader pb={2}>
                  <Heading size="sm">Base</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  <SimpleGrid columns={2} spacing={3}>
                    <ColorSwatch name="Background" cssVar="--background" />
                    <ColorSwatch name="Foreground" cssVar="--foreground" />
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Card */}
              <Card bg="var(--card)">
                <CardHeader pb={2}>
                  <Heading size="sm">Card</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  <SimpleGrid columns={2} spacing={3}>
                    <ColorSwatch name="Card" cssVar="--card" />
                    <ColorSwatch name="Card FG" cssVar="--card-foreground" />
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Primary */}
              <Card bg="var(--card)">
                <CardHeader pb={2}>
                  <Heading size="sm">Primary</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  <SimpleGrid columns={2} spacing={3}>
                    <ColorSwatch name="Primary" cssVar="--primary" />
                    <ColorSwatch name="Primary FG" cssVar="--primary-foreground" />
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Secondary */}
              <Card bg="var(--card)">
                <CardHeader pb={2}>
                  <Heading size="sm">Secondary</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  <SimpleGrid columns={2} spacing={3}>
                    <ColorSwatch name="Secondary" cssVar="--secondary" />
                    <ColorSwatch name="Secondary FG" cssVar="--secondary-foreground" />
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Muted */}
              <Card bg="var(--card)">
                <CardHeader pb={2}>
                  <Heading size="sm">Muted</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  <SimpleGrid columns={2} spacing={3}>
                    <ColorSwatch name="Muted" cssVar="--muted" />
                    <ColorSwatch name="Muted FG" cssVar="--muted-foreground" />
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Accent */}
              <Card bg="var(--card)">
                <CardHeader pb={2}>
                  <Heading size="sm">Accent</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  <SimpleGrid columns={2} spacing={3}>
                    <ColorSwatch name="Accent" cssVar="--accent" />
                    <ColorSwatch name="Accent FG" cssVar="--accent-foreground" />
                  </SimpleGrid>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Borders & Inputs */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="sm">Borders & Inputs</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 3, md: 6 }} spacing={4}>
                  <ColorSwatch name="Border" cssVar="--border" />
                  <ColorSwatch name="Input" cssVar="--input" />
                  <ColorSwatch name="Ring" cssVar="--ring" />
                </SimpleGrid>
              </CardBody>
            </Card>
          </VStack>

          {/* Status Colors */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Cores de Status</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Cores com influência roxa para harmonia de marca — WCAG AA
              </Text>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              {/* Success */}
              <Card bg="var(--card)" overflow="hidden">
                <Box h={2} bg="var(--success)" />
                <CardBody>
                  <VStack spacing={3}>
                    <HStack w="full" justify="space-between">
                      <Heading size="sm" color="var(--success)">Success</Heading>
                      <Badge colorScheme="green">4.6:1 ✓</Badge>
                    </HStack>
                    <SimpleGrid columns={2} spacing={2} w="full">
                      <ColorSwatch name="Success" cssVar="--success" />
                      <ColorSwatch name="Success FG" cssVar="--success-foreground" />
                    </SimpleGrid>
                    <Text fontSize="xs" color="var(--muted-foreground)">
                      #20A68B — Teal-Purple
                    </Text>
                  </VStack>
                </CardBody>
              </Card>

              {/* Warning */}
              <Card bg="var(--card)" overflow="hidden">
                <Box h={2} bg="var(--warning)" />
                <CardBody>
                  <VStack spacing={3}>
                    <HStack w="full" justify="space-between">
                      <Heading size="sm" color="var(--warning)">Warning</Heading>
                      <Badge colorScheme="yellow">5.8:1 ✓</Badge>
                    </HStack>
                    <SimpleGrid columns={2} spacing={2} w="full">
                      <ColorSwatch name="Warning" cssVar="--warning" />
                      <ColorSwatch name="Warning FG" cssVar="--warning-foreground" />
                    </SimpleGrid>
                    <Text fontSize="xs" color="var(--muted-foreground)">
                      #E8923A — Amber-Violet
                    </Text>
                  </VStack>
                </CardBody>
              </Card>

              {/* Destructive */}
              <Card bg="var(--card)" overflow="hidden">
                <Box h={2} bg="var(--destructive)" />
                <CardBody>
                  <VStack spacing={3}>
                    <HStack w="full" justify="space-between">
                      <Heading size="sm" color="var(--destructive)">Destructive</Heading>
                      <Badge colorScheme="red">4.8:1 ✓</Badge>
                    </HStack>
                    <SimpleGrid columns={2} spacing={2} w="full">
                      <ColorSwatch name="Destructive" cssVar="--destructive" />
                      <ColorSwatch name="Destructive FG" cssVar="--destructive-foreground" />
                    </SimpleGrid>
                    <Text fontSize="xs" color="var(--muted-foreground)">
                      #D64072 — Magenta-Red
                    </Text>
                  </VStack>
                </CardBody>
              </Card>

              {/* Info */}
              <Card bg="var(--card)" overflow="hidden">
                <Box h={2} bg="var(--info)" />
                <CardBody>
                  <VStack spacing={3}>
                    <HStack w="full" justify="space-between">
                      <Heading size="sm" color="var(--info)">Info</Heading>
                      <Badge colorScheme="blue">5.3:1 ✓</Badge>
                    </HStack>
                    <SimpleGrid columns={2} spacing={2} w="full">
                      <ColorSwatch name="Info" cssVar="--info" />
                      <ColorSwatch name="Info FG" cssVar="--info-foreground" />
                    </SimpleGrid>
                    <Text fontSize="xs" color="var(--muted-foreground)">
                      #6E5CD9 — Indigo-Violet
                    </Text>
                  </VStack>
                </CardBody>
              </Card>
            </SimpleGrid>
          </VStack>

          {/* Color Palettes */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Paletas Completas</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Escalas de cores com influência roxa
              </Text>
            </Box>

            <Card bg="var(--card)">
              <CardBody>
                <VStack spacing={8} align="stretch">
                  <ColorScale name="Gray (Neutral com tom roxo)" prefix="gray" />
                  <Divider />
                  <ColorScale name="Green (Success)" prefix="green" />
                  <Divider />
                  <ColorScale name="Red (Error)" prefix="red" />
                  <Divider />
                  <ColorScale name="Yellow (Warning)" prefix="yellow" />
                  <Divider />
                  <ColorScale name="Blue (Info)" prefix="blue" />
                </VStack>
              </CardBody>
            </Card>
          </VStack>

          {/* Accessibility */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Acessibilidade WCAG AA</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Todos os pares de cores verificados para contraste mínimo
              </Text>
            </Box>

            <Card bg="var(--card)">
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <ContrastPair
                    bgVar="--background"
                    fgVar="--foreground"
                    bgName="Background"
                    fgName="Foreground"
                    ratio="14.5:1"
                    passes={true}
                  />
                  <ContrastPair
                    bgVar="--primary"
                    fgVar="--primary-foreground"
                    bgName="Primary"
                    fgName="Primary FG"
                    ratio="8.2:1"
                    passes={true}
                  />
                  <ContrastPair
                    bgVar="--secondary"
                    fgVar="--secondary-foreground"
                    bgName="Secondary"
                    fgName="Secondary FG"
                    ratio="7.1:1"
                    passes={true}
                  />
                  <ContrastPair
                    bgVar="--muted"
                    fgVar="--muted-foreground"
                    bgName="Muted"
                    fgName="Muted FG"
                    ratio="4.8:1"
                    passes={true}
                  />
                  <ContrastPair
                    bgVar="--accent"
                    fgVar="--accent-foreground"
                    bgName="Accent"
                    fgName="Accent FG"
                    ratio="7.5:1"
                    passes={true}
                  />
                </VStack>
              </CardBody>
            </Card>

            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="sm">Requisitos WCAG AA</Heading>
              </CardHeader>
              <CardBody>
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Tipo</Th>
                        <Th>Contraste Mínimo</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      <Tr>
                        <Td>Texto normal (&lt;18px)</Td>
                        <Td>4.5:1</Td>
                        <Td><Badge colorScheme="green">Aprovado</Badge></Td>
                      </Tr>
                      <Tr>
                        <Td>Texto grande (≥18px ou ≥14px bold)</Td>
                        <Td>3:1</Td>
                        <Td><Badge colorScheme="green">Aprovado</Badge></Td>
                      </Tr>
                      <Tr>
                        <Td>Elementos de UI</Td>
                        <Td>3:1</Td>
                        <Td><Badge colorScheme="green">Aprovado</Badge></Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </VStack>

          {/* Components Preview */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Exemplos de Componentes</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Componentes usando os tokens de design
              </Text>
            </Box>

            {/* Buttons */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="md">Buttons</Heading>
                <Text fontSize="sm" color="var(--muted-foreground)">Variantes e tamanhos</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <HStack spacing={4} wrap="wrap">
                    <Button
                      bg="var(--primary)"
                      color="var(--primary-foreground)"
                      _hover={{ opacity: 0.9 }}
                    >
                      Primary
                    </Button>
                    <Button
                      bg="var(--secondary)"
                      color="var(--secondary-foreground)"
                      _hover={{ bg: "var(--accent)" }}
                    >
                      Secondary
                    </Button>
                    <Button
                      bg="var(--destructive)"
                      color="var(--destructive-foreground)"
                      _hover={{ opacity: 0.9 }}
                    >
                      Destructive
                    </Button>
                    <Button
                      variant="outline"
                      borderColor="var(--border)"
                      color="var(--foreground)"
                      _hover={{ bg: "var(--accent)" }}
                    >
                      Outline
                    </Button>
                    <Button
                      variant="ghost"
                      color="var(--foreground)"
                      _hover={{ bg: "var(--muted)" }}
                    >
                      Ghost
                    </Button>
                  </HStack>

                  <HStack spacing={4} align="center" wrap="wrap">
                    <Button size="sm" bg="var(--primary)" color="var(--primary-foreground)">Small</Button>
                    <Button size="md" bg="var(--primary)" color="var(--primary-foreground)">Default</Button>
                    <Button size="lg" bg="var(--primary)" color="var(--primary-foreground)">Large</Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Inputs */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="md">Inputs</Heading>
                <Text fontSize="sm" color="var(--muted-foreground)">Campos de formulário</Text>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Input
                    placeholder="Input padrão"
                    bg="var(--background)"
                    borderColor="var(--border)"
                    color="var(--foreground)"
                    _placeholder={{ color: "var(--muted-foreground)" }}
                    _focus={{ borderColor: "var(--ring)", boxShadow: "0 0 0 1px var(--ring)" }}
                  />
                  <Input
                    placeholder="Input desabilitado"
                    isDisabled
                    bg="var(--muted)"
                    borderColor="var(--border)"
                  />
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* Badges */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="md">Badges</Heading>
                <Text fontSize="sm" color="var(--muted-foreground)">Status e labels</Text>
              </CardHeader>
              <CardBody>
                <HStack spacing={4} wrap="wrap">
                  <Badge bg="var(--primary)" color="var(--primary-foreground)">Primary</Badge>
                  <Badge bg="var(--secondary)" color="var(--secondary-foreground)">Secondary</Badge>
                  <Badge bg="var(--success)" color="var(--success-foreground)">Success</Badge>
                  <Badge bg="var(--warning)" color="var(--warning-foreground)">Warning</Badge>
                  <Badge bg="var(--destructive)" color="var(--destructive-foreground)">Destructive</Badge>
                  <Badge bg="var(--info)" color="var(--info-foreground)">Info</Badge>
                </HStack>
              </CardBody>
            </Card>

            {/* Alerts */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="md">Alerts</Heading>
                <Text fontSize="sm" color="var(--muted-foreground)">Mensagens de feedback</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Alert status="info" borderRadius="md" bg="var(--blue-50)" borderLeft="4px solid var(--info)">
                    <AlertIcon as={Info} color="var(--info)" />
                    <Box>
                      <AlertTitle color="var(--foreground)">Informação</AlertTitle>
                      <AlertDescription color="var(--muted-foreground)">Esta é uma mensagem informativa.</AlertDescription>
                    </Box>
                  </Alert>

                  <Alert status="success" borderRadius="md" bg="var(--green-50)" borderLeft="4px solid var(--success)">
                    <AlertIcon as={CheckCircle} color="var(--success)" />
                    <Box>
                      <AlertTitle color="var(--foreground)">Sucesso</AlertTitle>
                      <AlertDescription color="var(--muted-foreground)">Operação realizada com sucesso.</AlertDescription>
                    </Box>
                  </Alert>

                  <Alert status="warning" borderRadius="md" bg="var(--yellow-50)" borderLeft="4px solid var(--warning)">
                    <AlertIcon as={AlertTriangle} color="var(--warning)" />
                    <Box>
                      <AlertTitle color="var(--foreground)">Atenção</AlertTitle>
                      <AlertDescription color="var(--muted-foreground)">Revise antes de continuar.</AlertDescription>
                    </Box>
                  </Alert>

                  <Alert status="error" borderRadius="md" bg="var(--red-50)" borderLeft="4px solid var(--destructive)">
                    <AlertIcon as={AlertCircle} color="var(--destructive)" />
                    <Box>
                      <AlertTitle color="var(--foreground)">Erro</AlertTitle>
                      <AlertDescription color="var(--muted-foreground)">Algo deu errado. Tente novamente.</AlertDescription>
                    </Box>
                  </Alert>
                </VStack>
              </CardBody>
            </Card>

            {/* Cards */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="md">Cards</Heading>
                <Text fontSize="sm" color="var(--muted-foreground)">Containers de conteúdo</Text>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <Card bg="var(--background)" border="1px solid var(--border)">
                    <CardHeader>
                      <Heading size="sm" color="var(--foreground)">Card Padrão</Heading>
                      <Text fontSize="sm" color="var(--muted-foreground)">Com borda sutil</Text>
                    </CardHeader>
                    <CardBody>
                      <Text fontSize="sm" color="var(--muted-foreground)">
                        Conteúdo do card aqui.
                      </Text>
                    </CardBody>
                  </Card>

                  <Card bg="var(--accent)" border="none">
                    <CardHeader>
                      <Heading size="sm" color="var(--accent-foreground)">Card Accent</Heading>
                      <Text fontSize="sm" color="var(--accent-foreground)" opacity={0.8}>Destaque sutil</Text>
                    </CardHeader>
                    <CardBody>
                      <Button size="sm" bg="var(--primary)" color="var(--primary-foreground)" w="full">
                        Ação
                      </Button>
                    </CardBody>
                  </Card>

                  <Card bg="var(--primary)" border="none">
                    <CardHeader>
                      <Heading size="sm" color="var(--primary-foreground)">Card Primary</Heading>
                      <Text fontSize="sm" color="var(--primary-foreground)" opacity={0.9}>Destaque forte</Text>
                    </CardHeader>
                    <CardBody>
                      <HStack spacing={2}>
                        <Badge bg="whiteAlpha.200" color="white">Ativo</Badge>
                        <Badge bg="whiteAlpha.200" color="white">Premium</Badge>
                      </HStack>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* Radio Group */}
            <Card bg="var(--card)">
              <CardHeader>
                <Heading size="md">Radio Group</Heading>
                <Text fontSize="sm" color="var(--muted-foreground)">Seleção de opções</Text>
              </CardHeader>
              <CardBody>
                <RadioGroup value={radioValue} onChange={setRadioValue}>
                  <Stack spacing={3}>
                    <Radio value="option-1" colorScheme="purple">
                      <Text color="var(--foreground)">Opção 1</Text>
                    </Radio>
                    <Radio value="option-2" colorScheme="purple">
                      <Text color="var(--foreground)">Opção 2</Text>
                    </Radio>
                    <Radio value="option-3" colorScheme="purple">
                      <Text color="var(--foreground)">Opção 3</Text>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </CardBody>
            </Card>
          </VStack>

          {/* Typography */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Tipografia</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Escalas de tamanho e peso
              </Text>
            </Box>

            <Card bg="var(--card)">
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <Box>
                    <Heading size="sm" color="var(--foreground)" mb={4}>Tamanhos</Heading>
                    <VStack spacing={3} align="stretch">
                      <Text fontSize="xs" color="var(--muted-foreground)">XS (12px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                      <Text fontSize="sm" color="var(--muted-foreground)">SM (14px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                      <Text fontSize="md" color="var(--muted-foreground)">Base (16px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                      <Text fontSize="lg" color="var(--muted-foreground)">LG (18px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                      <Text fontSize="xl" color="var(--muted-foreground)">XL (20px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                      <Text fontSize="2xl" color="var(--muted-foreground)">2XL (24px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                      <Text fontSize="3xl" color="var(--muted-foreground)">3XL (30px) — <Text as="span" color="var(--foreground)">The quick brown fox</Text></Text>
                    </VStack>
                  </Box>

                  <Divider />

                  <Box>
                    <Heading size="sm" color="var(--foreground)" mb={4}>Pesos</Heading>
                    <VStack spacing={3} align="stretch">
                      <Text fontWeight="normal" color="var(--foreground)">Normal (400) — The quick brown fox jumps over the lazy dog</Text>
                      <Text fontWeight="medium" color="var(--foreground)">Medium (500) — The quick brown fox jumps over the lazy dog</Text>
                      <Text fontWeight="semibold" color="var(--foreground)">Semibold (600) — The quick brown fox jumps over the lazy dog</Text>
                      <Text fontWeight="bold" color="var(--foreground)">Bold (700) — The quick brown fox jumps over the lazy dog</Text>
                    </VStack>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          </VStack>

          {/* Shadows */}
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" color="var(--foreground)">Sombras</Heading>
              <Text color="var(--muted-foreground)" mt={1}>
                Elevação e profundidade com tom roxo
              </Text>
            </Box>

            <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={6}>
              {[
                { name: 'XS', shadow: 'var(--shadow-xs)' },
                { name: 'SM', shadow: 'var(--shadow-sm)' },
                { name: 'MD', shadow: 'var(--shadow-md)' },
                { name: 'LG', shadow: 'var(--shadow-lg)' },
                { name: 'XL', shadow: 'var(--shadow-xl)' },
                { name: '2XL', shadow: 'var(--shadow-2xl)' },
              ].map((item) => (
                <VStack key={item.name} spacing={2} align="center">
                  <Box
                    w="20"
                    h="20"
                    bg="var(--card)"
                    borderRadius="lg"
                    style={{ boxShadow: item.shadow }}
                  />
                  <Text fontSize="sm" fontWeight="medium" color="var(--foreground)">{item.name}</Text>
                </VStack>
              ))}
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
              {[
                { name: 'Purple SM', shadow: 'var(--shadow-purple-sm)' },
                { name: 'Purple MD', shadow: 'var(--shadow-purple-md)' },
                { name: 'Purple LG', shadow: 'var(--shadow-purple-lg)' },
              ].map((item) => (
                <VStack key={item.name} spacing={2} align="center">
                  <Box
                    w="full"
                    h="20"
                    bg="var(--primary)"
                    borderRadius="lg"
                    style={{ boxShadow: item.shadow }}
                  />
                  <Text fontSize="sm" fontWeight="medium" color="var(--foreground)">{item.name}</Text>
                </VStack>
              ))}
            </SimpleGrid>
          </VStack>

          {/* Footer */}
          <Box as="footer" textAlign="center" py={8} borderTop="1px" borderColor="var(--border)">
            <Text fontSize="sm" color="var(--muted-foreground)">
              BFIN Design System v2.0 — Built with Chakra UI
            </Text>
            <Text fontSize="xs" color="var(--muted-foreground)" mt={1}>
              Primary: #7C3AED • WCAG AA Compliant
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
}
