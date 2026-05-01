BFin is a personal finance assistant built as a remote MCP (Model Context Protocol) server. It connects securely to Claude, ChatGPT, and other AI clients through OAuth 2.1, allowing users to manage their financial life using natural language.

Users can create accounts, track income and expenses, manage installment debts, set savings goals, and compute daily spending limits — all through AI-powered conversations. The server exposes a comprehensive set of tools over HTTP+SSE with fine-grained OAuth scopes, ensuring users stay in control of what each AI client can access.

BFin is designed for privacy-first personal finance: no card numbers, no health data, no official documents are ever collected. Data is stored in a PostgreSQL database and protected by Auth0 authentication, TLS encryption, and rate limiting.

The demo account gives reviewers immediate access to a realistic dataset with transactions, debts, goals, and projections — no signup required.
