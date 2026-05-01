import { db } from "../src/db/index.js";
import {
  usuarios,
  contas,
  contaUsuarios,
  categorias,
  tipoCategorias,
  movimentacoes,
  dividas,
  parcelasDivida,
  meta,
  projecao,
} from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { config } from "../src/config.js";

const DEMO_PROVIDER_ID = "auth0|demo-mcp-review";
const DEMO_EMAIL = "mcp-review@bfincont.com.br";
const DEMO_NAME = "Anthropic Reviewer";

function uuid(n: string): string {
  // Deterministic v5-style UUID derived from sha256("bfin-demo:" + n).
  // Sets RFC 4122 version (5) and variant (10) bits so Postgres uuid validation passes
  // and collisions are cryptographically negligible.
  const hash = createHash("sha256").update(`bfin-demo:${n}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function ensureUser() {
  let user = await db.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, DEMO_PROVIDER_ID),
  });

  if (!user) {
    const [inserted] = await db
      .insert(usuarios)
      .values({
        id: uuid("demo-user"),
        idProvedor: DEMO_PROVIDER_ID,
        nome: DEMO_NAME,
        email: DEMO_EMAIL,
      })
      .returning();
    user = inserted;
    console.log("Created demo user:", user.id);
  } else {
    console.log("Demo user exists:", user.id);
  }
  return user;
}

async function seedCategories() {
  const existing = await db.query.tipoCategorias.findMany();
  if (existing.length > 0) return existing;

  const tipos = await db
    .insert(tipoCategorias)
    .values([
      { id: uuid("tipo-receita"), slug: "receita", nome: "Receita" },
      { id: uuid("tipo-despesa"), slug: "despesa", nome: "Despesa" },
    ])
    .returning();

  const cats = await db
    .insert(categorias)
    .values([
      { id: uuid("cat-salario"), nome: "Salário", tipoCategoriaId: tipos.find((t) => t.slug === "receita")!.id },
      { id: uuid("cat-freela"), nome: "Freelance", tipoCategoriaId: tipos.find((t) => t.slug === "receita")!.id },
      { id: uuid("cat-alim"), nome: "Alimentação", tipoCategoriaId: tipos.find((t) => t.slug === "despesa")!.id },
      { id: uuid("cat-transp"), nome: "Transporte", tipoCategoriaId: tipos.find((t) => t.slug === "despesa")!.id },
      { id: uuid("cat-moradia"), nome: "Moradia", tipoCategoriaId: tipos.find((t) => t.slug === "despesa")!.id },
      { id: uuid("cat-lazer"), nome: "Lazer", tipoCategoriaId: tipos.find((t) => t.slug === "despesa")!.id },
      { id: uuid("cat-saude"), nome: "Saúde", tipoCategoriaId: tipos.find((t) => t.slug === "despesa")!.id },
      { id: uuid("cat-edu"), nome: "Educação", tipoCategoriaId: tipos.find((t) => t.slug === "despesa")!.id },
    ])
    .returning();

  console.log("Created", cats.length, "categories");
  return tipos;
}

async function seedAccounts(userId: string) {
  const existing = await db.query.contas.findMany();
  if (existing.length >= 2) return existing;

  const accounts = await db
    .insert(contas)
    .values([
      { id: config.demoAccountId, nome: "Conta Demo Principal", saldoInicial: "5000.00" },
      { id: uuid("conta-poupanca"), nome: "Poupança Demo", saldoInicial: "2000.00" },
    ])
    .returning();

  await db.insert(contaUsuarios).values([
    { contaId: accounts[0].id, usuarioId: userId, papel: "owner" },
    { contaId: accounts[1].id, usuarioId: userId, papel: "owner" },
  ]);

  console.log("Created", accounts.length, "accounts");
  return accounts;
}

async function seedTransactions(accounts: typeof contas.$inferSelect[], cats: typeof categorias.$inferSelect[], userId: string) {
  const existing = await db.query.movimentacoes.findMany({
    where: eq(movimentacoes.contaId, accounts[0].id),
  });
  if (existing.length >= 30) {
    console.log("Transactions already seeded:", existing.length);
    return;
  }

  const despesas = cats.filter((c) => c.nome !== "Salário" && c.nome !== "Freelance");
  const receitas = cats.filter((c) => c.nome === "Salário" || c.nome === "Freelance");

  const txs: (typeof movimentacoes.$inferInsert)[] = [];
  const now = new Date();
  const rng = (i: number) => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 30; i++) {
    const daysAgo = Math.floor(rng(i) * 90);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    const isReceita = i % 5 === 0;
    const cat = isReceita ? receitas[i % receitas.length] : despesas[i % despesas.length];
    const valor = isReceita
      ? (rng(i + 100) * 3000 + 1000).toFixed(2)
      : (-(rng(i + 200) * 200 + 20)).toFixed(2);

    txs.push({
      id: uuid(`tx-${i}`),
      contaId: accounts[0].id,
      usuarioId: userId,
      categoriaId: cat.id,
      descricao: isReceita ? "Entrada mensal" : "Despesa diversa",
      valor,
      data: date,
      recorrente: i === 0,
    });
  }

  await db.insert(movimentacoes).values(txs);
  console.log("Created", txs.length, "transactions");
}

async function seedDebt(accounts: typeof contas.$inferSelect[], cats: typeof categorias.$inferSelect[], userId: string) {
  const existing = await db.query.dividas.findMany({
    where: eq(dividas.contaId, accounts[0].id),
  });
  if (existing.length > 0) {
    console.log("Debt already seeded");
    return;
  }

  const despesaCat = cats.find((c) => c.nome === "Moradia")!;
  const total = "12000.00";
  const parcelas = 12;
  const valorParcela = (Number(total) / parcelas).toFixed(2);
  const start = new Date();
  start.setDate(1);

  const [debt] = await db
    .insert(dividas)
    .values({
      id: uuid("debt-1"),
      contaId: accounts[0].id,
      usuarioId: userId,
      categoriaId: despesaCat.id,
      descricao: "Financiamento demo",
      valorTotal: total,
      totalParcelas: parcelas,
      valorParcela,
      dataInicio: start,
    })
    .returning();

  const ps: (typeof parcelasDivida.$inferInsert)[] = [];
  for (let i = 1; i <= parcelas; i++) {
    const venc = new Date(start);
    venc.setMonth(venc.getMonth() + (i - 1));
    ps.push({
      id: uuid(`parcela-${i}`),
      dividaId: debt.id,
      numeroParcela: i,
      valor: valorParcela,
      dataVencimento: venc,
      dataPagamento: i <= 3 ? venc : null,
    });
  }

  await db.insert(parcelasDivida).values(ps);
  console.log("Created debt with", ps.length, "installments");
}

async function seedGoal(accounts: typeof contas.$inferSelect[]) {
  const existing = await db.query.meta.findFirst({
    where: eq(meta.contaId, accounts[0].id),
  });
  if (existing) {
    console.log("Goal already seeded");
    return;
  }

  await db.insert(meta).values({
    id: uuid("goal-1"),
    contaId: accounts[0].id,
    porcentagemReserva: "15.00",
  });
  console.log("Created goal");
}

async function seedProjection(accounts: typeof contas.$inferSelect[]) {
  const mes = new Date().toISOString().slice(0, 7);
  const existing = await db.query.projecao.findFirst({
    where: eq(projecao.contaId, accounts[0].id),
  });
  if (existing) {
    console.log("Projection already seeded");
    return;
  }

  await db.insert(projecao).values({
    id: uuid("proj-1"),
    contaId: accounts[0].id,
    mes,
    dados: {
      receitas: 4000,
      despesas: 2800,
      saldo: 1200,
      reserva: 600,
      disponivel: 600,
    },
    status: "atualizada",
  });
  console.log("Created projection");
}

async function main() {
  console.log("Seeding demo account...");
  const user = await ensureUser();
  const tipos = await seedCategories();
  const cats = await db.query.categorias.findMany();
  const accounts = await seedAccounts(user.id);
  await seedTransactions(accounts, cats, user.id);
  await seedDebt(accounts, cats, user.id);
  await seedGoal(accounts);
  await seedProjection(accounts);
  console.log("Demo seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
