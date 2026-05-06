-- =====================================================
-- DRE v2 — Estrutura alinhada com o "DRE Gerencial" do Saipos
-- =====================================================
-- Mudanças vs v1:
--   * Estrutura clássica de DRE: Bruta → Impostos → Líquida → CMV →
--     Custo c/ Vendas → Lucro Op. Bruto → Desp. Adm → Desp. Fin.→ Lucro
--     Operacional → Receita Não Op. → IR → Pró-Labore → Lucro Líquido.
--   * delivery_fee e table_total_service_charge NÃO são mais subtraídos
--     da receita (o Saipos mantém eles dentro do bruto).
--   * "Outras receitas" (saipos_financial.amount > 0) NÃO entram mais
--     em receita líquida — viram "Receita não operacional", a menos que
--     a categoria seja exclude (sangria, frente de caixa, estorno).
--   * Cada despesa é classificada pelo grupo DRE via dre_classify_category.
-- =====================================================

DROP FUNCTION IF EXISTS public.get_dre_summary(date, date);
DROP FUNCTION IF EXISTS public.get_dre_expenses_by_category(date, date);
DROP FUNCTION IF EXISTS public.get_dre_monthly_evolution(date, date);

-- -----------------------------------------------------
-- dre_classify_category: mapeia desc_store_category_financial → grupo DRE
-- -----------------------------------------------------
-- Grupos:
--   tax              = Impostos sobre vendas (deduz da receita bruta)
--   cogs             = CMV (insumos de produção)
--   sales_cost       = Custo com vendas (logística, marketing, marketplace, cartão)
--   admin            = Despesas administrativas (folha, gastos fixos, manutenções)
--   financial        = Despesas financeiras (juros, IOF)
--   income_tax       = Imposto de Renda (Irpj, Csll)
--   prolabore        = Pró-Labore + Empréstimos (sócios)
--   exclude          = Não entra no DRE (Frente de Caixa, Investimento CAPEX,
--                      Estorno, Sangria — são transferências/movimento de caixa)
--   non_operational  = Receita não operacional (entradas com amount > 0
--                      cuja categoria não é exclude)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.dre_classify_category(p_cat text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_cat IS NULL OR TRIM(p_cat) = '' THEN 'admin'

    -- Excluídos do DRE (transferências, sangria, CAPEX, estorno)
    WHEN p_cat ILIKE 'Frente de Caixa%' THEN 'exclude'
    WHEN p_cat ILIKE 'Investimento%' THEN 'exclude'
    WHEN p_cat ILIKE 'Estorno%' THEN 'exclude'
    WHEN p_cat ILIKE 'Sangria%' THEN 'exclude'
    WHEN p_cat ILIKE 'Transferência%' OR p_cat ILIKE 'Transferencia%' THEN 'exclude'

    -- Impostos sobre vendas
    WHEN p_cat ILIKE 'Icms%' THEN 'tax'
    WHEN p_cat ILIKE 'Iss%' THEN 'tax'
    WHEN p_cat ILIKE 'Pis e Cofins%' THEN 'tax'
    WHEN p_cat ILIKE 'Pis%' THEN 'tax'
    WHEN p_cat ILIKE 'Cofins%' THEN 'tax'
    WHEN p_cat ILIKE 'Simples Nacional%' THEN 'tax'

    -- Imposto de Renda
    WHEN p_cat ILIKE 'Irpj%' THEN 'income_tax'
    WHEN p_cat ILIKE 'Csll%' THEN 'income_tax'

    -- Pró-Labore (saída pra sócios)
    WHEN p_cat ILIKE 'Pró%Labore%' OR p_cat ILIKE 'Pro%Labore%' THEN 'prolabore'
    WHEN p_cat ILIKE 'Empréstimo%' OR p_cat ILIKE 'Emprestimo%' THEN 'prolabore'

    -- CMV (insumos)
    WHEN p_cat ILIKE 'Matéria Prima%' OR p_cat ILIKE 'Materia Prima%' THEN 'cogs'
    WHEN p_cat ILIKE 'Frios%' THEN 'cogs'
    WHEN p_cat ILIKE 'Descartá%' OR p_cat ILIKE 'Descarta%' THEN 'cogs'
    WHEN p_cat ILIKE 'Secos%' THEN 'cogs'
    WHEN p_cat ILIKE 'Bebida%' THEN 'cogs'
    WHEN p_cat ILIKE 'Vinhos%' THEN 'cogs'
    WHEN p_cat ILIKE 'Horti%' THEN 'cogs'
    WHEN p_cat ILIKE 'Caixa%Pizza%' THEN 'cogs'

    -- Custo com Vendas
    WHEN p_cat ILIKE 'Logística%' OR p_cat ILIKE 'Logistica%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Marketplace%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Taxa%Cartão%' OR p_cat ILIKE 'Taxa%Cartao%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Marketing%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Agência%Marketing%' OR p_cat ILIKE 'Agencia%Marketing%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Motoboy%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Gasolina%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Seguro%Moto%' THEN 'sales_cost'
    WHEN p_cat ILIKE 'Manutenção%Moto%' OR p_cat ILIKE 'Manutencao%Moto%' THEN 'sales_cost'

    -- Despesas Financeiras
    WHEN p_cat ILIKE 'Juros%' THEN 'financial'
    WHEN p_cat ILIKE 'Tarifa%Banc%' THEN 'financial'
    WHEN p_cat ILIKE 'IOF%' THEN 'financial'

    -- Despesas Administrativas (folha)
    WHEN p_cat ILIKE 'Folha%' THEN 'admin'
    WHEN p_cat ILIKE 'Adiantamento%' THEN 'admin'
    WHEN p_cat ILIKE 'Rescisõ%' OR p_cat ILIKE 'Rescis%' THEN 'admin'
    WHEN p_cat ILIKE 'Férias%' OR p_cat ILIKE 'Ferias%' THEN 'admin'
    WHEN p_cat ILIKE 'Extras%' THEN 'admin'
    WHEN p_cat ILIKE 'C.M.O.%' OR p_cat ILIKE 'CMO%' THEN 'admin'
    WHEN p_cat ILIKE 'Inss%' THEN 'admin'
    WHEN p_cat ILIKE 'Fgts%' THEN 'admin'
    WHEN p_cat ILIKE '%Vale Transporte%' THEN 'admin'
    WHEN p_cat ILIKE '%Medicina Ocupacional%' THEN 'admin'
    WHEN p_cat ILIKE '%Uniforme%' THEN 'admin'
    WHEN p_cat ILIKE '%Treinamento%' THEN 'admin'

    -- Despesas Administrativas (gastos fixos)
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
    WHEN p_cat ILIKE 'Falaê%' OR p_cat ILIKE 'Falae%' THEN 'admin'
    WHEN p_cat ILIKE 'Código%' OR p_cat ILIKE 'Codigo%' THEN 'admin'

    -- Despesas Administrativas (manutenções)
    WHEN p_cat ILIKE 'Manutenç%' OR p_cat ILIKE 'Manutenc%' THEN 'admin'
    WHEN p_cat ILIKE 'Produto%Limpeza%' THEN 'admin'

    -- Default: classifica como admin (vai aparecer separado se for desconhecido)
    ELSE 'admin'
  END;
$$;

-- -----------------------------------------------------
-- get_dre_summary: estrutura clássica do DRE (Saipos-aligned)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_summary(p_start date, p_end date)
RETURNS TABLE (
  gross_revenue numeric,
  total_orders bigint,
  avg_ticket numeric,
  total_taxes numeric,
  net_revenue numeric,
  total_cogs numeric,
  total_sales_cost numeric,
  gross_operating_profit numeric,
  total_admin numeric,
  total_financial_expenses numeric,
  operating_profit numeric,
  non_operational_income numeric,
  profit_before_tax numeric,
  income_tax numeric,
  profit_before_prolabore numeric,
  prolabore numeric,
  net_profit numeric,
  excluded_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT
      COALESCE(SUM(total_amount), 0)::numeric AS gross_revenue,
      COUNT(*)::bigint AS total_orders
    FROM saipos_sales
    WHERE shift_date >= p_start
      AND shift_date <= p_end
      AND canceled = false
  ),
  fin AS (
    SELECT
      public.dre_classify_category(desc_store_category_financial) AS grp,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expense_amount,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::numeric AS income_amount
    FROM saipos_financial
    WHERE COALESCE(payment_date, date)::date >= p_start
      AND COALESCE(payment_date, date)::date <= p_end
    GROUP BY 1
  ),
  agg AS (
    SELECT
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'tax'), 0)::numeric AS total_taxes,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'cogs'), 0)::numeric AS total_cogs,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'sales_cost'), 0)::numeric AS total_sales_cost,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'admin'), 0)::numeric AS total_admin,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'financial'), 0)::numeric AS total_financial_expenses,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'income_tax'), 0)::numeric AS income_tax,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'prolabore'), 0)::numeric AS prolabore,
      COALESCE(SUM(income_amount) FILTER (WHERE grp NOT IN ('exclude')), 0)::numeric AS non_operational_income,
      COALESCE(SUM(expense_amount + income_amount) FILTER (WHERE grp = 'exclude'), 0)::numeric AS excluded_amount
    FROM fin
  )
  SELECT
    s.gross_revenue,
    s.total_orders,
    CASE WHEN s.total_orders > 0 THEN (s.gross_revenue / s.total_orders)::numeric ELSE 0::numeric END AS avg_ticket,
    a.total_taxes,
    (s.gross_revenue - a.total_taxes)::numeric AS net_revenue,
    a.total_cogs,
    a.total_sales_cost,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost)::numeric AS gross_operating_profit,
    a.total_admin,
    a.total_financial_expenses,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses)::numeric AS operating_profit,
    a.non_operational_income,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses + a.non_operational_income)::numeric AS profit_before_tax,
    a.income_tax,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses + a.non_operational_income
      - a.income_tax)::numeric AS profit_before_prolabore,
    a.prolabore,
    (s.gross_revenue - a.total_taxes - a.total_cogs - a.total_sales_cost
      - a.total_admin - a.total_financial_expenses + a.non_operational_income
      - a.income_tax - a.prolabore)::numeric AS net_profit,
    a.excluded_amount
  FROM sales s CROSS JOIN agg a;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_summary(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_expenses_by_group: detalhe de cada categoria com seu grupo
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_expenses_by_group(p_start date, p_end date)
RETURNS TABLE (
  dre_group text,
  category text,
  amount_total numeric,
  txn_count bigint,
  paid_amount numeric,
  unpaid_amount numeric,
  pct_of_group numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      public.dre_classify_category(desc_store_category_financial) AS dre_group,
      COALESCE(NULLIF(TRIM(desc_store_category_financial), ''), '(sem categoria)') AS category,
      -amount AS expense_amount,
      paid
    FROM saipos_financial
    WHERE COALESCE(payment_date, date)::date >= p_start
      AND COALESCE(payment_date, date)::date <= p_end
      AND amount < 0
  ),
  agg AS (
    SELECT
      dre_group,
      category,
      COALESCE(SUM(expense_amount), 0)::numeric AS amount_total,
      COUNT(*)::bigint AS txn_count,
      COALESCE(SUM(CASE WHEN paid IS TRUE THEN expense_amount ELSE 0 END), 0)::numeric AS paid_amount,
      COALESCE(SUM(CASE WHEN paid IS NOT TRUE THEN expense_amount ELSE 0 END), 0)::numeric AS unpaid_amount
    FROM base
    GROUP BY dre_group, category
  ),
  group_totals AS (
    SELECT dre_group, NULLIF(SUM(amount_total), 0) AS group_total FROM agg GROUP BY dre_group
  )
  SELECT
    a.dre_group,
    a.category,
    a.amount_total,
    a.txn_count,
    a.paid_amount,
    a.unpaid_amount,
    CASE WHEN gt.group_total IS NULL THEN 0::numeric
      ELSE (a.amount_total / gt.group_total * 100)::numeric
    END AS pct_of_group
  FROM agg a
  LEFT JOIN group_totals gt USING (dre_group)
  ORDER BY a.dre_group, a.amount_total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_expenses_by_group(date, date) TO authenticated;

-- -----------------------------------------------------
-- get_dre_monthly_evolution: série mensal pelo novo formato
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dre_monthly_evolution(p_start date, p_end date)
RETURNS TABLE (
  month_bucket date,
  gross_revenue numeric,
  net_revenue numeric,
  total_expenses numeric,
  operating_profit numeric,
  net_profit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', p_start::timestamp),
      date_trunc('month', p_end::timestamp),
      interval '1 month'
    )::date AS month_bucket
  ),
  rev AS (
    SELECT
      date_trunc('month', shift_date)::date AS month_bucket,
      COALESCE(SUM(total_amount), 0)::numeric AS gross_revenue
    FROM saipos_sales
    WHERE shift_date >= p_start AND shift_date <= p_end AND canceled = false
    GROUP BY 1
  ),
  fin AS (
    SELECT
      date_trunc('month', COALESCE(payment_date, date))::date AS month_bucket,
      public.dre_classify_category(desc_store_category_financial) AS grp,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expense_amount
    FROM saipos_financial
    WHERE COALESCE(payment_date, date)::date >= p_start
      AND COALESCE(payment_date, date)::date <= p_end
    GROUP BY 1, 2
  ),
  fin_pivot AS (
    SELECT
      month_bucket,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'tax'), 0)::numeric AS taxes,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'cogs'), 0)::numeric AS cogs,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'sales_cost'), 0)::numeric AS sc,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'admin'), 0)::numeric AS adm,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'financial'), 0)::numeric AS fin_exp,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'income_tax'), 0)::numeric AS irpj,
      COALESCE(SUM(expense_amount) FILTER (WHERE grp = 'prolabore'), 0)::numeric AS prolab
    FROM fin
    GROUP BY 1
  )
  SELECT
    m.month_bucket,
    COALESCE(rev.gross_revenue, 0)::numeric AS gross_revenue,
    (COALESCE(rev.gross_revenue, 0) - COALESCE(fp.taxes, 0))::numeric AS net_revenue,
    (COALESCE(fp.taxes, 0) + COALESCE(fp.cogs, 0) + COALESCE(fp.sc, 0)
      + COALESCE(fp.adm, 0) + COALESCE(fp.fin_exp, 0) + COALESCE(fp.irpj, 0)
      + COALESCE(fp.prolab, 0))::numeric AS total_expenses,
    (COALESCE(rev.gross_revenue, 0) - COALESCE(fp.taxes, 0) - COALESCE(fp.cogs, 0)
      - COALESCE(fp.sc, 0) - COALESCE(fp.adm, 0) - COALESCE(fp.fin_exp, 0))::numeric AS operating_profit,
    (COALESCE(rev.gross_revenue, 0) - COALESCE(fp.taxes, 0) - COALESCE(fp.cogs, 0)
      - COALESCE(fp.sc, 0) - COALESCE(fp.adm, 0) - COALESCE(fp.fin_exp, 0)
      - COALESCE(fp.irpj, 0) - COALESCE(fp.prolab, 0))::numeric AS net_profit
  FROM months m
  LEFT JOIN rev ON rev.month_bucket = m.month_bucket
  LEFT JOIN fin_pivot fp ON fp.month_bucket = m.month_bucket
  ORDER BY m.month_bucket;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_monthly_evolution(date, date) TO authenticated;
