import { createHash } from "node:crypto";
import { config } from "../../src/config.js";
import {
  usuarios,
  contas,
  contaUsuarios,
  tipoCategorias,
  categorias,
  movimentacoes,
  dividas,
  parcelasDivida,
  meta,
  projecao,
} from "../../src/db/schema.js";
import { eq, inArray } from "drizzle-orm";

export const DEMO_PROVIDER_ID = "auth0|demo-mcp-review";
export const DEMO_EMAIL = "mcp-review@bfincont.com.br";
export const DEMO_NAME = "Anthropic Reviewer";

export function uuid(n: string): string {
  const hash = createHash("sha256").update(`bfin-demo:${n}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

type Tx = any; // Drizzle transaction type

export async function cleanupDemoData(tx: Tx) {
  const user = await tx.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, DEMO_PROVIDER_ID),
  });

  if (!user) {
    return null;
  }

  const userAccountIds = (
    await tx.query.contaUsuarios.findMany({
      where: eq(contaUsuarios.usuarioId, user.id),
    })
  ).map((cu: any) => cu.contaId);

  if (userAccountIds.length > 0) {
    await tx.delete(projecao).where(inArray(projecao.contaId, userAccountIds));
    await tx.delete(meta).where(inArray(meta.contaId, userAccountIds));
    await tx.delete(movimentacoes).where(inArray(movimentacoes.contaId, userAccountIds));
    
    const debts = await tx.query.dividas.findMany({
      where: inArray(dividas.contaId, userAccountIds),
    });
    const debtIds = debts.map((d: any) => d.id);
    if (debtIds.length > 0) {
      await tx.delete(parcelasDivida).where(inArray(parcelasDivida.dividaId, debtIds));
    }
    await tx.delete(dividas).where(inArray(dividas.contaId, userAccountIds));
  }

  await tx.delete(contaUsuarios).where(eq(contaUsuarios.usuarioId, user.id));

  return user;
}

export async function seedDemoData(tx: Tx, userId: string) {
  const existingTipos = await tx.query.tipoCategorias.findMany();
  let tipos = existingTipos;
  if (tipos.length === 0) {
    tipos = await tx
      .insert(tipoCategorias)
      .values([
        { id: uuid("tipo-receita"), slug: "receita", nome: "Receita" },
        { id: uuid("tipo-despesa"), slug: "despesa", nome: "Despesa" },
      ])
      .returning();
  }

  let cats = await tx.query.categorias.findMany();
  if (cats.length === 0) {
    cats = await tx
      .insert(categorias)
      .values([
        { id: uuid("cat-salario"), nome: "Salário", tipoCategoriaId: tipos.find((t: any) => t.slug === "receita")!.id },
        { id: uuid("cat-freela"), nome: "Freelance", tipoCategoriaId: tipos.find((t: any) => t.slug === "receita")!.id },
        { id: uuid("cat-alim"), nome: "Alimentação", tipoCategoriaId: tipos.find((t: any) => t.slug === "despesa")!.id },
        { id: uuid("cat-transp"), nome: "Transporte", tipoCategoriaId: tipos.find((t: any) => t.slug === "despesa")!.id },
        { id: uuid("cat-moradia"), nome: "Moradia", tipoCategoriaId: tipos.find((t: any) => t.slug === "despesa")!.id },
        { id: uuid("cat-lazer"), nome: "Lazer", tipoCategoriaId: tipos.find((t: any) => t.slug === "despesa")!.id },
        { id: uuid("cat-saude"), nome: "Saúde", tipoCategoriaId: tipos.find((t: any) => t.slug === "despesa")!.id },
        { id: uuid("cat-edu"), nome: "Educação", tipoCategoriaId: tipos.find((t: any) => t.slug === "despesa")!.id },
      ])
      .returning();
  }

  await tx
    .insert(contas)
    .values([
      { id: config.demoAccountId, nome: "Conta Demo Principal", saldoInicial: "5000.00" },
      { id: uuid("conta-poupanca"), nome: "Poupança Demo", saldoInicial: "2000.00" },
    ])
    .onConflictDoNothing();

  await tx
    .insert(contaUsuarios)
    .values([
      { contaId: config.demoAccountId, usuarioId: userId, papel: "owner" },
      { contaId: uuid("conta-poupanca"), usuarioId: userId, papel: "owner" },
    ])
    .onConflictDoNothing();

  const despesas = cats.filter((c: any) => c.nome !== "Salário" && c.nome !== "Freelance");
  const receitas = cats.filter((c: any) => c.nome === "Salário" || c.nome === "Freelance");

  const txs = [];
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
      contaId: config.demoAccountId,
      usuarioId: userId,
      categoriaId: cat.id,
      descricao: isReceita ? "Entrada mensal" : "Despesa diversa",
      valor,
      data: date,
      recorrente: i === 0,
    });
  }

  await tx.insert(movimentacoes).values(txs);

  const despesaCat = cats.find((c: any) => c.nome === "Moradia")!;
  const total = "12000.00";
  const parcelas = 12;
  const valorParcela = (Number(total) / parcelas).toFixed(2);
  const start = new Date();
  start.setDate(1);

  const [debt] = await tx
    .insert(dividas)
    .values({
      id: uuid("debt-1"),
      contaId: config.demoAccountId,
      usuarioId: userId,
      categoriaId: despesaCat.id,
      descricao: "Financiamento demo",
      valorTotal: total,
      totalParcelas: parcelas,
      valorParcela,
      dataInicio: start,
    })
    .returning();

  const ps = [];
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

  await tx.insert(parcelasDivida).values(ps);

  await tx.insert(meta).values({
    id: uuid("goal-1"),
    contaId: config.demoAccountId,
    porcentagemReserva: "15.00",
  });

  const mes = now.toISOString().slice(0, 7);
  await tx.insert(projecao).values({
    id: uuid("proj-1"),
    contaId: config.demoAccountId,
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
}
