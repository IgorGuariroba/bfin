import { and, eq, or, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  contas,
  movimentacoes,
  categorias,
  tipoCategorias,
  dividas,
  parcelasDivida,
  meta as metaTable,
} from "../../db/schema.js";
import { firstDayOfMonth, lastDayOfMonth } from "../../lib/month.js";
import type {
  ProjecaoMovimentacaoInput,
  ProjecaoParcelaInput,
  ProjecaoMetaInput,
} from "./types.js";

export interface ContaInfo {
  id: string;
  saldoInicial: string;
  createdAt: Date;
}

export async function loadConta(contaId: string): Promise<ContaInfo | null> {
  const rows = await db
    .select({
      id: contas.id,
      saldoInicial: contas.saldoInicial,
      createdAt: contas.createdAt,
    })
    .from(contas)
    .where(eq(contas.id, contaId))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadMeta(contaId: string): Promise<ProjecaoMetaInput | null> {
  const rows = await db
    .select({ porcentagemReserva: metaTable.porcentagemReserva })
    .from(metaTable)
    .where(eq(metaTable.contaId, contaId))
    .limit(1);
  if (rows.length === 0) return null;
  return { porcentagemReserva: rows[0].porcentagemReserva };
}

export interface LoadMovimentacoesResult {
  receitas: ProjecaoMovimentacaoInput[];
  despesas: ProjecaoMovimentacaoInput[];
}

export async function loadMovimentacoesDoMes(
  contaId: string,
  mes: string
): Promise<LoadMovimentacoesResult> {
  const mesInicio = firstDayOfMonth(mes);
  const mesFim = lastDayOfMonth(mes);

  const rows = await db
    .select({
      id: movimentacoes.id,
      valor: movimentacoes.valor,
      data: movimentacoes.data,
      recorrente: movimentacoes.recorrente,
      dataFim: movimentacoes.dataFim,
      tipo: tipoCategorias.slug,
      parcelaDividaId: movimentacoes.parcelaDividaId,
    })
    .from(movimentacoes)
    .innerJoin(categorias, eq(movimentacoes.categoriaId, categorias.id))
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(
      and(
        eq(movimentacoes.contaId, contaId),
        inArray(tipoCategorias.slug, ["receita", "despesa"]),
        or(
          and(
            eq(movimentacoes.recorrente, true),
            lte(movimentacoes.data, mesFim),
            or(
              isNull(movimentacoes.dataFim),
              gte(movimentacoes.dataFim, mesInicio)
            )
          ),
          and(
            eq(movimentacoes.recorrente, false),
            gte(movimentacoes.data, mesInicio),
            lte(movimentacoes.data, mesFim)
          )
        )
      )
    );

  const receitas: ProjecaoMovimentacaoInput[] = [];
  const despesas: ProjecaoMovimentacaoInput[] = [];
  for (const r of rows) {
    if (r.parcelaDividaId !== null) continue;
    const item: ProjecaoMovimentacaoInput = {
      id: r.id,
      valor: r.valor,
      data: r.data,
      recorrente: r.recorrente,
      dataFim: r.dataFim,
    };
    if (r.tipo === "receita") receitas.push(item);
    else if (r.tipo === "despesa") despesas.push(item);
  }
  return { receitas, despesas };
}

export async function loadParcelasDoMes(
  contaId: string,
  mes: string
): Promise<ProjecaoParcelaInput[]> {
  const mesInicio = firstDayOfMonth(mes);
  const mesFim = lastDayOfMonth(mes);
  const rows = await db
    .select({
      id: parcelasDivida.id,
      valor: parcelasDivida.valor,
      dataVencimento: parcelasDivida.dataVencimento,
      dataPagamento: parcelasDivida.dataPagamento,
    })
    .from(parcelasDivida)
    .innerJoin(dividas, eq(parcelasDivida.dividaId, dividas.id))
    .where(
      and(
        eq(dividas.contaId, contaId),
        or(
          and(
            isNull(parcelasDivida.dataPagamento),
            lte(parcelasDivida.dataVencimento, mesFim)
          ),
          and(
            gte(parcelasDivida.dataPagamento, mesInicio),
            lte(parcelasDivida.dataPagamento, mesFim)
          )
        )
      )
    );
  return rows.map((p) => ({
    id: p.id,
    valor: p.valor,
    dataVencimento: p.dataVencimento,
    dataPagamento: p.dataPagamento,
  }));
}
