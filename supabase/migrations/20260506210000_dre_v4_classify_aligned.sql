-- =====================================================
-- DRE v4 — Classify alinhado à "Configuração do DRE" oficial do Saipos
-- =====================================================
-- Lucas mostrou screenshots da config oficial do Saipos. Várias categorias
-- estavam mal mapeadas no v3. Correções:
--
--   * Gasolina, Seguro Motos, Emplacamento Motos: sales_cost → admin
--     (Saipos: Manutenções > Motos > * = Despesas administrativas)
--   * Estorno Cliente: exclude → sales_cost
--     (Saipos: Taxas de Cartão > Estorno Cliente = Custo com vendas)
--   * Código 4, Comissões/Gorjetas: admin → sales_cost
--     (Saipos: Logística Terceirizada > * = Custo com vendas)
--   * Manutenção Geral, Agência Marketing: admin → exclude
--     (Saipos: "Selecione a seção" = não entra no DRE)
--   * Despesas Financeiras (cat. pai), Ifood (cat. pai), Taxas Maquinona
--     Ifood, Brendi, Consumo, Atualizações de caixa, Diferença de caixa,
--     Fiado, Saldo Inicial: exclude (Saipos: "Selecione a seção")
--   * Marketplace, Comissão do Ifood, Taxa de Antecipação Ifood,
--     Taxas Brendi, Taxas de Cartão (CDP/Vouchers), Google/Ifood/Meta Ads:
--     adicionados explicitamente como sales_cost (caso existam no banco)
-- =====================================================

CREATE OR REPLACE FUNCTION public.dre_classify_category(p_cat text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_cat IS NULL OR TRIM(p_cat) = '' THEN 'admin'

    -- =========================================
    -- EXCLUÍDOS DO DRE
    -- (no Saipos: "Selecione a seção" = não classificada)
    -- =========================================
    WHEN p_cat ILIKE 'Frente de Caixa%' THEN 'exclude'
    WHEN p_cat ILIKE 'Investimento%' THEN 'exclude'
    WHEN p_cat ILIKE 'Sangria%' THEN 'exclude'
    WHEN p_cat ILIKE 'Transferência%' OR p_cat ILIKE 'Transferencia%' THEN 'exclude'
    WHEN p_cat ILIKE 'Atualiz%caixa%' THEN 'exclude'
    WHEN p_cat = 'Brendi' THEN 'exclude'
    WHEN p_cat ILIKE 'Consumo%' THEN 'exclude'
    WHEN p_cat ILIKE 'Diferenç%caixa%' OR p_cat ILIKE 'Diferenc%caixa%' THEN 'exclude'
    WHEN p_cat ILIKE 'Fiado%' THEN 'exclude'
    WHEN p_cat ILIKE 'Saldo Inicial%' THEN 'exclude'
    WHEN p_cat ILIKE 'Manutenç%Geral%' OR p_cat ILIKE 'Manutenc%Geral%' THEN 'exclude'
    WHEN p_cat ILIKE 'Agência%Marketing%' OR p_cat ILIKE 'Agencia%Marketing%' THEN 'exclude'
    WHEN p_cat ILIKE 'Despesas Financeiras (Taxa%' THEN 'exclude'
    WHEN p_cat = 'Ifood' THEN 'exclude'
    WHEN p_cat ILIKE 'Taxa%Maquinona%' THEN 'exclude'
    WHEN p_cat ILIKE 'Impostos Sobre Faturamento' THEN 'exclude'

    -- =========================================
    -- IMPOSTOS SOBRE VENDAS
    -- =========================================
    WHEN p_cat ILIKE 'Icms%' THEN 'tax'
    WHEN p_cat ILIKE 'Iss%' THEN 'tax'
    WHEN p_cat ILIKE 'Pis e Cofins%' THEN 'tax'
    WHEN p_cat ILIKE 'Pis%' THEN 'tax'
    WHEN p_cat ILIKE 'Cofins%' THEN 'tax'
    WHEN p_cat ILIKE 'Simples Nacional%' THEN 'tax'

    -- =========================================
    -- IMPOSTO DE RENDA
    -- =========================================
    WHEN p_cat ILIKE 'Irpj%' THEN 'income_tax'
    WHEN p_cat ILIKE 'Csll%' THEN 'income_tax'

    -- =========================================
    -- PRÓ-LABORE (inclui Empréstimos no Saipos)
    -- =========================================
    WHEN p_cat ILIKE 'Pró%Labore%' OR p_cat ILIKE 'Pro%Labore%' THEN 'prolabore'
    WHEN p_cat ILIKE 'Empréstimo%' OR p_cat ILIKE 'Emprestimo%' THEN 'prolabore'

    -- =========================================
    -- CMV (insumos)
    -- "Matéria Prima" no Saipos é cat pai sem classificação,
    -- mas o DRE Gerencial inclui as filhas (Frios/Secos/etc).
    -- Aqui mantemos como cogs pra pelo menos pegar o valor.
    -- =========================================
    WHEN p_cat ILIKE 'Matéria Prima%' OR p_cat ILIKE 'Materia Prima%' THEN 'cogs'
    WHEN p_cat ILIKE 'Frios%' THEN 'cogs'
    WHEN p_cat ILIKE 'Descartá%' OR p_cat ILIKE 'Descarta%' THEN 'cogs'
    WHEN p_cat ILIKE 'Secos%' THEN 'cogs'
    WHEN p_cat ILIKE 'Bebida%' THEN 'cogs'
    WHEN p_cat ILIKE 'Vinhos%' THEN 'cogs'
    WHEN p_cat ILIKE 'Horti%' THEN 'cogs'
    WHEN p_cat ILIKE 'Caixa%Pizza%' THEN 'cogs'

    -- =========================================
    -- CUSTO COM VENDAS
    -- =========================================
    -- Logística Terceirizada (Saipos: pai = Custo com vendas)
    WHEN p_cat ILIKE 'Logística%' OR p_cat ILIKE 'Logistica%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Motoboy%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Código 4%' OR p_cat ILIKE 'Codigo 4%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Comissõ%' OR p_cat ILIKE 'Comissoe%' OR p_cat ILIKE 'Gorjeta%' THEN 'sales_cost'

    -- Marketing online (Saipos: Marketing > Google/Ifood/Meta Ads = Custo com vendas)
    WHEN p_cat = 'Marketing' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Google Ads%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Ifood Ads%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Meta Ads%' THEN 'sales_cost'

    -- Marketplace
    WHEN p_cat ILIKE 'Marketplace%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Comissão%Ifood%' OR p_cat ILIKE 'Comissao%Ifood%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Taxa%Antecipa%Ifood%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Taxas Brendi%' OR p_cat ILIKE 'Taxa%Brendi%' THEN 'sales_cost'

    -- Taxas de Cartão
    WHEN p_cat ILIKE 'Taxas de Cartão%' OR p_cat ILIKE 'Taxas de Cartao%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Taxa%Cartão%' OR p_cat ILIKE 'Taxa%Cartao%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Estorno Cliente%' THEN 'sales_cost'

    -- =========================================
    -- DESPESAS FINANCEIRAS (juros, IOF — não taxas de cartão)
    -- =========================================
    WHEN p_cat ILIKE 'Juros%' THEN 'financial'
    WHEN p_cat ILIKE 'Tarifa%Banc%' THEN 'financial'
    WHEN p_cat ILIKE 'IOF%' THEN 'financial'

    -- =========================================
    -- DESPESAS ADMINISTRATIVAS — Folha (CMO)
    -- =========================================
    WHEN p_cat ILIKE 'Custo de Mão%' OR p_cat ILIKE 'Custo de Mao%' THEN 'admin'
    WHEN p_cat ILIKE 'C.M.O.%' OR p_cat ILIKE 'CMO%' THEN 'admin'
    WHEN p_cat ILIKE 'Folha%' THEN 'admin'
    WHEN p_cat ILIKE 'Adiantamento%' THEN 'admin'
    WHEN p_cat ILIKE 'Rescisõ%' OR p_cat ILIKE 'Rescis%' THEN 'admin'
    WHEN p_cat ILIKE 'Férias%' OR p_cat ILIKE 'Ferias%' THEN 'admin'
    WHEN p_cat ILIKE 'Extras%' THEN 'admin'
    WHEN p_cat ILIKE 'Inss%' THEN 'admin'
    WHEN p_cat ILIKE 'Fgts%' THEN 'admin'
    WHEN p_cat ILIKE '%Vale Transporte%' THEN 'admin'
    WHEN p_cat ILIKE '%Medicina Ocupacional%' THEN 'admin'
    WHEN p_cat ILIKE '%Uniforme%' THEN 'admin'
    WHEN p_cat ILIKE '%Treinamento%' THEN 'admin'
    WHEN p_cat ILIKE '13º%' OR p_cat ILIKE '%- 13º%' OR p_cat ILIKE '%13o' THEN 'admin'
    WHEN p_cat ILIKE 'Garçom%' OR p_cat ILIKE 'Garcom%' THEN 'admin'
    WHEN p_cat ILIKE 'Falaê%' OR p_cat ILIKE 'Falae%' THEN 'admin'

    -- =========================================
    -- DESPESAS ADMINISTRATIVAS — Gastos Fixos
    -- =========================================
    WHEN p_cat ILIKE 'Gastos Fixos%' THEN 'admin'
    WHEN p_cat ILIKE 'Aluguel%' THEN 'admin'
    WHEN p_cat ILIKE 'Água%' OR p_cat ILIKE 'Agua%' THEN 'admin'
    WHEN p_cat ILIKE 'Gás%' OR p_cat ILIKE 'Gas%' THEN 'admin'
    WHEN p_cat ILIKE 'Internet%' THEN 'admin'
    WHEN p_cat ILIKE 'Luz%' OR p_cat ILIKE 'Energia%' THEN 'admin'
    WHEN p_cat ILIKE 'Sistemas%' THEN 'admin'
    WHEN p_cat ILIKE 'Contador%' THEN 'admin'
    WHEN p_cat ILIKE 'Advogado%' THEN 'admin'
    WHEN p_cat ILIKE 'Iptu%' THEN 'admin'
    WHEN p_cat ILIKE 'Taxa%Lixo%' THEN 'admin'
    WHEN p_cat ILIKE 'Seguro%Prédio%' OR p_cat ILIKE 'Seguro%Predio%' THEN 'admin'
    WHEN p_cat ILIKE 'Fornecedor%' THEN 'admin'
    WHEN p_cat ILIKE 'Outros%' THEN 'admin'

    -- =========================================
    -- DESPESAS ADMINISTRATIVAS — Manutenções (inclui Motos)
    -- (Saipos: Manutenções > Motos > * = Despesas administrativas)
    -- =========================================
    WHEN p_cat ILIKE 'Manutenç%' OR p_cat ILIKE 'Manutenc%' THEN 'admin'
    WHEN p_cat ILIKE 'Produto%Limpeza%' THEN 'admin'
    WHEN p_cat ILIKE 'Motos%' THEN 'admin'
    WHEN p_cat ILIKE 'Emplacamento%' THEN 'admin'
    WHEN p_cat ILIKE 'Gasolina%' THEN 'admin'
    WHEN p_cat ILIKE 'Seguro%Moto%' THEN 'admin'

    -- Default
    ELSE 'admin'
  END;
$$;
