import { db } from "../src/db/index.js";
import {
  usuarios,
  contas,
  contaUsuarios,
  movimentacoes,
  dividas,
  parcelasDivida,
  meta,
  projecao,
} from "../src/db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { config } from "../src/config.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const DEMO_PROVIDER_ID = "auth0|demo-mcp-review";

async function cleanup(tx: Tx) {
  const user = await tx.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, DEMO_PROVIDER_ID),
  });

  if (!user) {
    console.log("Demo user not found; nothing to clean.");
    return null;
  }

  const accounts = await tx.query.contas.findMany({
    where: inArray(
      contas.id,
      (
        await tx.query.contaUsuarios.findMany({
          where: eq(contaUsuarios.usuarioId, user.id),
        })
      ).map((cu) => cu.contaId)
    ),
  });

  const accountIds = accounts.map((a) => a.id);

  for (const contaId of accountIds) {
    await tx.delete(projecao).where(eq(projecao.contaId, contaId));
    await tx.delete(meta).where(eq(meta.contaId, contaId));
    await tx.delete(movimentacoes).where(eq(movimentacoes.contaId, contaId));
    const debts = await tx.query.dividas.findMany({
      where: eq(dividas.contaId, contaId),
    });
    for (const d of debts) {
      await tx.delete(parcelasDivida).where(eq(parcelasDivida.dividaId, d.id));
    }
    await tx.delete(dividas).where(eq(dividas.contaId, contaId));
  }

  await tx.delete(contaUsuarios).where(eq(contaUsuarios.usuarioId, user.id));

  console.log("Cleaned demo data for accounts:", accountIds.join(", "));
  return user;
}

function uuid(n: string): string {
  const hash = Array.from(n).reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
  const pad = (x: number) => Math.abs(x).toString(16).padStart(8, "0").slice(0, 8);
  const p1 = pad(hash);
  const p2 = pad(hash >>> 4);
  const p3 = ((pad(hash >>> 8) + "4").slice(0, 4));
  const p4 = ((pad(hash >>> 12) + "89ab").slice(0, 4));
  const p5 = (pad(hash >>> 16) + pad(hash >>> 20) + pad(hash >>> 24)).slice(0, 12);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

async function seed(tx: Tx, userId: string) {
  const {
    tipoCategorias,
    categorias,
    contas: contasTable,
    contaUsuarios: cuTable,
    movimentacoes: movTable,
    dividas: divTable,
    parcelasDivida: parcTable,
    meta: metaTable,
    projecao: projTable,
  } = await import("../src/db/schema.js");

  const { eq: eqFn } = await import("drizzle-orm");

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
  }

  await tx
    .insert(contasTable)
    .values([
      { id: config.demoAccountId, nome: "Conta Demo Principal", saldoInicial: "5000.00" },
      { id: uuid("conta-poupanca"), nome: "Poupança Demo", saldoInicial: "2000.00" },
    ])
    .onConflictDoNothing()
    .returning();

  await tx
    .insert(cuTable)
    .values([
      { contaId: config.demoAccountId, usuarioId: userId, papel: "owner" as const },
      { contaId: uuid("conta-poupanca"), usuarioId: userId, papel: "owner" as const },
    ])
    .onConflictDoNothing();

  const allAccounts = await tx.query.contas.findMany({
    where: eqFn(contasTable.id, config.demoAccountId),
  });
  const mainAccount = allAccounts[0];

  const despesas = cats.filter((c) => c.nome !== "Salário" && c.nome !== "Freelance");
  const receitas = cats.filter((c) => c.nome === "Salário" || c.nome === "Freelance");

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
      contaId: mainAccount.id,
      usuarioId: userId,
      categoriaId: cat.id,
      descricao: isReceita ? "Entrada mensal" : "Despesa diversa",
      valor,
      data: date,
      recorrente: i === 0,
    });
  }

  await tx.insert(movTable).values(txs);

  const despesaCat = cats.find((c) => c.nome === "Moradia")!;
  const total = "12000.00";
  const parcelas = 12;
  const valorParcela = (Number(total) / parcelas).toFixed(2);
  const start = new Date();
  start.setDate(1);

  const [debt] = await tx
    .insert(divTable)
    .values({
      id: uuid("debt-1"),
      contaId: mainAccount.id,
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

  await tx.insert(parcTable).values(ps);

  await tx.insert(metaTable).values({
    id: uuid("goal-1"),
    contaId: mainAccount.id,
    porcentagemReserva: "15.00",
  });

  const mes = now.toISOString().slice(0, 7);
  await tx.insert(projTable).values({
    id: uuid("proj-1"),
    contaId: mainAccount.id,
    mes,
    dados: {
      receitas: 4000,
      despesas: 2800,
      saldo: 1200,
      reserva: 600,
      disponivel: 600,
    },
    status: "atualizada" as const,
  });

  console.log("Seeded demo data.");
}

async function main() {
  console.log("Resetting demo account...");
  await db.transaction(async (tx) => {
    const user = await cleanup(tx);
    if (!user) {
      const { usuarios: uTable } = await import("../src/db/schema.js");
      const [inserted] = await tx
        .insert(uTable)
        .values({
          id: uuid("demo-user"),
          idProvedor: DEMO_PROVIDER_ID,
          nome: "Anthropic Reviewer",
          email: "mcp-review@bfincont.com.br",
        })
        .returning();
      await seed(tx, inserted.id);
    } else {
      await seed(tx, user.id);
    }
  });
  console.log("Demo reset complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
