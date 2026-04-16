export type IndicadorReserva = "verde" | "amarelo" | "vermelho";

export interface ProjecaoMovimentacaoInput {
  id: string;
  valor: string;
  data: Date;
  recorrente: boolean;
  dataFim: Date | null;
}

export interface ProjecaoParcelaInput {
  id: string;
  valor: string;
  dataVencimento: Date;
  dataPagamento: Date | null;
}

export interface ProjecaoMetaInput {
  porcentagemReserva: string;
}

export interface CalcularMesInput {
  saldoInicialCentavos: bigint;
  mes: string;
  receitas: ProjecaoMovimentacaoInput[];
  despesas: ProjecaoMovimentacaoInput[];
  parcelas: ProjecaoParcelaInput[];
  meta: ProjecaoMetaInput | null;
}

export interface DiaProjecao {
  data: string;
  saldo_projetado: string;
  receitas_dia: string;
  despesas_dia: string;
  parcelas_pagas_dia: string;
  total_dividas_pendentes: string;
  saldo_liquido: string;
  indicador_reserva: IndicadorReserva | null;
}

export interface ResumoMes {
  total_receitas: string;
  total_despesas: string;
  total_parcelas_pagas: string;
  total_dividas_pendentes: string;
  saldo_final_projetado: string;
  saldo_liquido_final: string;
  reserva_ideal: string | null;
  reserva_atingida: boolean | null;
  indicador_reserva_final: IndicadorReserva | null;
}

export interface ProjecaoMensal {
  dias: DiaProjecao[];
  resumo: ResumoMes;
}

export interface ProjecaoArmazenada {
  dias: DiaProjecao[];
  resumo: ResumoMes;
  saldoInicialCentavos: string;
}
