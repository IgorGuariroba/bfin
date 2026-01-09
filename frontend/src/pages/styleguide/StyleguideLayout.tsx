import { Link as RouterLink, useLocation, Outlet } from "react-router-dom"
import {
  Box,
  Flex,
  Text,
  VStack,
  Link,
  Heading,
  Icon,
} from "@chakra-ui/react"
import { ArrowLeft } from "lucide-react"
import { navigation } from "./navigation"

export function StyleguideLayout() {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <Flex minH="100vh">
      {/* Sidebar - Fixed */}
      <Box
        as="aside"
        w="64"
        borderRight="1px"
        borderColor="gray.200"
        bg="white"
        p={6}
        position="fixed"
        top={0}
        left={0}
        h="100vh"
        overflowY="auto"
      >
        <VStack align="stretch" spacing={6} h="full">
          <Box>
            <Link as={RouterLink} to="/styleguide" _hover={{ textDecoration: "none" }}>
              <Heading size="md" color="gray.900">
                Design System
              </Heading>
            </Link>
            <Text fontSize="sm" color="gray.500" mt={1}>
              BFIN Tokens
            </Text>
          </Box>

          <VStack as="nav" align="stretch" spacing={6} flex={1}>
            {navigation.map((section) => (
              <Box key={section.title}>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color="gray.500"
                  mb={2}
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {section.title}
                </Text>
                <VStack as="ul" align="stretch" spacing={1} listStyleType="none">
                  {section.items.map((item) => (
                    <Box as="li" key={item.href}>
                      <Link
                        as={RouterLink}
                        to={item.href}
                        display="block"
                        px={3}
                        py={2}
                        borderRadius="md"
                        fontSize="sm"
                        transition="all 0.2s"
                        bg={pathname === item.href ? "purple.600" : "transparent"}
                        color={pathname === item.href ? "white" : "gray.700"}
                        _hover={{
                          bg: pathname === item.href ? "purple.700" : "gray.100",
                          textDecoration: "none",
                        }}
                      >
                        {item.name}
                      </Link>
                    </Box>
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>

          {/* Back to App Link */}
          <Box pt={6} borderTop="1px" borderColor="gray.200" mt="auto">
            <Link
              as={RouterLink}
              to="/dashboard"
              display="flex"
              alignItems="center"
              gap={2}
              fontSize="sm"
              color="gray.500"
              _hover={{ color: "gray.900", textDecoration: "none" }}
              transition="colors 0.2s"
            >
              <Icon as={ArrowLeft} boxSize={4} />
              Voltar ao App
            </Link>
          </Box>
        </VStack>
      </Box>

      {/* Main content - offset by sidebar width */}
      <Box as="main" flex={1} ml="64" overflowY="auto" bg="gray.50">
        <Outlet />
      </Box>
    </Flex>
  )
}
