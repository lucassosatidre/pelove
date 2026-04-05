
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','gestor','visualizador')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create vision table
CREATE TABLE public.vision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  reference_year INTEGER NOT NULL DEFAULT 2027,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pillars table
CREATE TABLE public.pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create obstacles table
CREATE TABLE public.obstacles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id UUID NOT NULL REFERENCES public.pillars(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create actions table
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obstacle_id UUID NOT NULL REFERENCES public.obstacles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  area TEXT CHECK (area IN ('Iniciativas Estratégicas','Financeiro/Contábil','Dados/Tecnologia','Governança','Comercial','Processos/Operação','Pessoas','Marketing')),
  expected_result TEXT,
  deliverable TEXT,
  responsible TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('agendado','nao_iniciado','em_andamento','concluido')),
  importance INTEGER CHECK (importance BETWEEN 1 AND 5),
  urgency INTEGER CHECK (urgency BETWEEN 1 AND 5),
  reliability INTEGER CHECK (reliability BETWEEN 1 AND 5),
  priority_score NUMERIC(3,2) GENERATED ALWAYS AS (
    CASE WHEN importance IS NOT NULL AND urgency IS NOT NULL AND reliability IS NOT NULL
    THEN (importance + urgency + reliability)::NUMERIC / 3
    ELSE NULL END
  ) STORED,
  execution_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vision_updated_at BEFORE UPDATE ON public.vision FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pillars_updated_at BEFORE UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_obstacles_updated_at BEFORE UPDATE ON public.obstacles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obstacles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: users see own profile, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Vision, pillars, obstacles, actions: permissive for authenticated
CREATE POLICY "Authenticated users can select vision" ON public.vision FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vision" ON public.vision FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update vision" ON public.vision FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete vision" ON public.vision FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select pillars" ON public.pillars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pillars" ON public.pillars FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pillars" ON public.pillars FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete pillars" ON public.pillars FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select obstacles" ON public.obstacles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert obstacles" ON public.obstacles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update obstacles" ON public.obstacles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete obstacles" ON public.obstacles FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select actions" ON public.actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert actions" ON public.actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update actions" ON public.actions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete actions" ON public.actions FOR DELETE TO authenticated USING (true);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED DATA

-- Vision
INSERT INTO public.vision (text, reference_year) VALUES (
  'Visão 2027: A Estrela da Ilha consolida sua tradição como a maior e mais relevante pizzaria de delivery e à la carte do sul da Ilha de Florianópolis! Em 2026 o grupo faturou mais de 10 milhões, com margem superior à 10%, gerando caixa, em pleno ano de eleição, copa do mundo e recorde de feriados nacionais com emenda. Não bastasse isso, recém inauguraram seu c.d. que dará início ao projeto de expansão da marca.',
  2027
);

-- Pillars
INSERT INTO public.pillars (number, name, display_order) VALUES
  (1, 'Ordem', 1),
  (2, 'Gestão', 2),
  (3, 'Melhoramos a qualidade do nosso serviço', 3),
  (4, 'Melhoramos a qualidade da nossa pizza', 4),
  (5, 'Priorizamos e aperfeiçoamos nossos melhores canais', 5),
  (6, 'Lucas, Clau e Família como a voz da Estrela', 6);

-- Obstacles
INSERT INTO public.obstacles (pillar_id, code, description, display_order) VALUES
  ((SELECT id FROM public.pillars WHERE number=1), '1.1', 'A confusão', 1),
  ((SELECT id FROM public.pillars WHERE number=1), '1.2', NULL, 2),
  ((SELECT id FROM public.pillars WHERE number=1), '1.3', NULL, 3),
  ((SELECT id FROM public.pillars WHERE number=1), '1.4', NULL, 4),
  ((SELECT id FROM public.pillars WHERE number=2), '2.1', 'Excesso de informação', 1),
  ((SELECT id FROM public.pillars WHERE number=2), '2.2', 'Atrasar em compromissos', 2),
  ((SELECT id FROM public.pillars WHERE number=2), '2.3', 'Ambiguidade de funções', 3),
  ((SELECT id FROM public.pillars WHERE number=2), '2.4', 'Foco no (não) essencial', 4),
  ((SELECT id FROM public.pillars WHERE number=3), '3.1', 'Gargalos / Erros sistemáticos', 1),
  ((SELECT id FROM public.pillars WHERE number=3), '3.2', 'Negligenciar treinamentos', 2),
  ((SELECT id FROM public.pillars WHERE number=3), '3.3', 'Zona de conforto', 3),
  ((SELECT id FROM public.pillars WHERE number=3), '3.4', 'Desvalorização de nossos clientes', 4),
  ((SELECT id FROM public.pillars WHERE number=4), '4.1', 'O ponto da massa', 1),
  ((SELECT id FROM public.pillars WHERE number=4), '4.2', 'Variação de marca na compra de insumo', 2),
  ((SELECT id FROM public.pillars WHERE number=4), '4.3', 'Aumentar o preço antes de aumentar o valor percebido', 3),
  ((SELECT id FROM public.pillars WHERE number=4), '4.4', 'O cliente não gostar da mudança', 4),
  ((SELECT id FROM public.pillars WHERE number=5), '5.1', 'Excesso de iniciativas sem medição e acompanhamento de resultados', 1),
  ((SELECT id FROM public.pillars WHERE number=5), '5.2', 'Terceirizar nosso marketing', 2),
  ((SELECT id FROM public.pillars WHERE number=5), '5.3', 'Mesma estratégia pra canais diferentes', 3),
  ((SELECT id FROM public.pillars WHERE number=5), '5.4', NULL, 4),
  ((SELECT id FROM public.pillars WHERE number=6), '6.1', 'Depois que mudou de dono...', 1),
  ((SELECT id FROM public.pillars WHERE number=6), '6.2', 'Irregularidade e inconsistência nos conteúdos', 2),
  ((SELECT id FROM public.pillars WHERE number=6), '6.3', NULL, 3),
  ((SELECT id FROM public.pillars WHERE number=6), '6.4', NULL, 4);

-- Actions
INSERT INTO public.actions (obstacle_id, description, area, expected_result, deliverable, responsible, deadline, status, importance, urgency, reliability, execution_order) VALUES
((SELECT id FROM public.obstacles WHERE code='1.1'), 'Sair do improviso, seguir o planejamento estratégico e se guiar por ele para tomar as decisões', 'Iniciativas Estratégicas', 'Foco', '6 acompanhamentos até dezembro com o advisor', 'Lucas T.', '2026-12-31', 'em_andamento', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='2.1'), 'Definir as métricas mais importantes para 2026', 'Financeiro/Contábil', 'Conseguir acompanhar diariamente os indicadores relevantes para o P.E. 2026', 'Dashboard do planejamento estratégico com as métricas no CX Love', 'Lucas T.', '2026-04-11', 'nao_iniciado', 5, 3, 3, 1),
((SELECT id FROM public.obstacles WHERE code='2.2'), 'Calendário de compromissos do financeiro', 'Dados/Tecnologia', 'Execução sempre cumprida no prazo', 'Calendário do financeiro no CX Love', 'Luana T.', '2026-04-11', 'nao_iniciado', 5, 2, 5, 1),
((SELECT id FROM public.obstacles WHERE code='2.2'), 'Compilar e centralizar todos os dados e métricas que irão medir o desempenho e aplicação do planejamento', 'Dados/Tecnologia', 'Um painel com todas as informações necessárias para medição dos resultados', 'Automação estruturada e rodando de forma automatizada, entregando todo dia os resultados necessários', 'Lucas T.', NULL, 'nao_iniciado', 5, 2, 2, 2),
((SELECT id FROM public.obstacles WHERE code='2.3'), 'Definir quem faz o que dentro da empresa', 'Governança', '1 CPF responsável por função/demanda', 'Onboarding concluído com as 5 cadeiras da Estrela e organograma impresso e visível no escritório', 'Lucas T.', '2026-04-25', 'nao_iniciado', 5, 2, 5, 1),
((SELECT id FROM public.obstacles WHERE code='2.3'), 'Demitir quem não é essencial e contratar para áreas sem dono que sejam relevantes para o momento atual visando o futuro', 'Governança', 'Preencher lacunas organizacionais e aproveitar oportunidades antes não enxergadas', 'Análise pós-organograma, estudo aprofundado, apresentação estruturada para entregar à esposa em dia de casal num Airbnb na serra', 'Lucas T.', NULL, 'nao_iniciado', 5, 2, 4, 2),
((SELECT id FROM public.obstacles WHERE code='2.4'), 'Estudo aprofundado nos dados do conteúdo do post "vamos fechar"', 'Comercial', 'Entregar o que é importante para o nosso cliente', 'Listar 1 indicador por valor, definir o CPF responsável e alinhar agenda de acompanhamento mensal', 'Lucas T.', '2026-05-02', 'nao_iniciado', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='3.1'), 'Análise das reuniões dos líderes, das avaliações dos clientes e dos indicadores das metas para ajustes corretivos em direção à meta coletiva', 'Processos/Operação', 'Visualizar nossos maiores desafios, quem são os responsáveis, quais ações devem tomar, quais resultados alcançar e qual prêmio receberão', 'Mapa mental do planejamento para os responsáveis e onboarding: 1-gargalo / 2-ações / 3-entregável-meta / 4-responsável / 5-prazo', 'Lucas T.', '2026-05-09', 'nao_iniciado', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='3.1'), 'Analisar o retrospecto de avaliações e identificar erros sistemáticos', 'Processos/Operação', 'Oportunidades de melhora em nosso serviço e produto', 'Relatório semanal em Excel no Drive com problemas identificados na semana para construção de base de dados e informações para reuniões com os times', 'Lucas T.', NULL, 'nao_iniciado', 5, 5, 3, 2),
((SELECT id FROM public.obstacles WHERE code='3.2'), 'PDI (Plano de Desenvolvimento Individual)', 'Pessoas', 'Eliminar os maus colaboradores e investir nos talentos', 'Calendário de PDI: ADM → líderes, líderes → liderados (mês completo, todos os setores, gravação no Plaud)', 'Lucas M.', '2026-06-01', 'nao_iniciado', 5, 3, 3, 1),
((SELECT id FROM public.obstacles WHERE code='3.2'), 'All Hands semanal', 'Pessoas', 'Integrar o time do momento e dar as novas diretrizes', 'Gravação de vídeo das reuniões', 'Luana T.', NULL, 'em_andamento', 5, 5, 5, 2),
((SELECT id FROM public.obstacles WHERE code='3.2'), 'Estruturar manual de regras de conduta como ponto zero para treinamento dos futuros colaboradores', 'Pessoas', 'Todos falarmos a mesma língua', 'Manual impresso e fixado em cada setor + reunião All Hands com cada um dos 3 líderes para apresentação', 'Lucas T.', NULL, 'nao_iniciado', 5, 3, 3, 3),
((SELECT id FROM public.obstacles WHERE code='3.3'), 'Meta para os 3 times', 'Pessoas', 'Time mais engajado e cliente mais satisfeito', 'Apresentação da meta no All Hands de sexta-feira dia 01/05/2026', 'Lucas M.', '2026-05-01', 'nao_iniciado', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='3.3'), 'Meta para o time do salão utilizando o NPS - qualidade do serviço no Fala Aê (pesquisa salão)', 'Pessoas', 'Time mais engajado e cliente mais satisfeito', 'Acompanhamento do resultado da meta semanalmente e apresentação no All Hands do salão', 'Lucas T.', NULL, 'nao_iniciado', 5, 5, 5, 2),
((SELECT id FROM public.obstacles WHERE code='3.3'), 'Meta para o time da tele utilizando o NPS - qualidade do serviço no Fala Aê (pesquisa tele)', 'Pessoas', 'Time mais engajado e cliente mais satisfeito', 'Acompanhamento do resultado da meta semanalmente e apresentação no All Hands da tele', 'Lucas T.', NULL, 'nao_iniciado', 5, 5, 5, 3),
((SELECT id FROM public.obstacles WHERE code='3.4'), 'Estruturar área "Satisfação do Cliente nas Redes" garantindo que ninguém seja esquecido ou fique decepcionado', 'Comercial', 'Maior proximidade com clientes, feedbacks estratégicos e esforços direcionados para corrigir o que estamos deixando a desejar', 'Aba SDC no RH Love com todos os canais e pontos de contato com o cliente na internet, checklist diário do responsável e gravação de dados para banco de dados', 'Ana J.', '2026-05-01', 'nao_iniciado', 5, 3, 4, 1),
((SELECT id FROM public.obstacles WHERE code='3.4'), 'Substituição de caixa para recepção', 'Processos/Operação', 'Acolhimento na chegada e saída dos clientes + cadastro para envio da pesquisa de satisfação do salão', 'Novo layout na entrada, cardápio físico informando pagamento na mesa, remoção da placa de caixa, reunião All Hands com equipe do salão', 'Lucas T.', NULL, 'nao_iniciado', 5, 5, 4, 2),
((SELECT id FROM public.obstacles WHERE code='4.1'), 'Implementar a massa pré-assada com a mentoria do Patrick Catapano', 'Processos/Operação', 'Diminuição de pedidos queimados/crus e do tempo de forno na preparação', 'Day 1 com a operação rodando a noite toda com massas 100% pré-assadas', 'Lucas T.', '2026-06-01', 'nao_iniciado', 5, 3, 3, 1),
((SELECT id FROM public.obstacles WHERE code='4.2'), 'Homologar todos os nossos insumos', 'Processos/Operação', 'Consistência no padrão de insumos alinhados com nosso produto e paladar do cliente', 'Lista impressa dos insumos com marcas validadas e aprovadas, aplicadas no CO Love para comprar apenas as listadas', 'Luana T.', '2026-04-25', 'nao_iniciado', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='4.3'), 'Atualização da ficha técnica das pizzas', 'Processos/Operação', 'Nova apuração do CMV com base nos valores atuais dos insumos', 'Todos os sabores atualizados na tabela do app Preço Eficiente', 'Luana T.', '2026-05-09', 'nao_iniciado', 5, 3, 3, 1),
((SELECT id FROM public.obstacles WHERE code='4.3'), 'Estudo do produto e cardápio do principal concorrente (Villa Açoriana)', 'Dados/Tecnologia', 'Observar pontos fortes e superioridades deles, modelar e entregar resultado superior', 'Planejamento de reestruturação de sabores, marcas de insumos e apresentação/estética das pizzas', 'Lucas T.', NULL, 'nao_iniciado', 5, 2, 2, 2),
((SELECT id FROM public.obstacles WHERE code='4.4'), 'Testar com os clientes que mais pedem antes de oficializar para todos', 'Comercial', 'Ouvir opinião e feedback sincero de clientes frequentes para validar ou não as mudanças', 'Após massa pré-assada testada e novo perfil das pizzas, oferecer via WhatsApp jantar ao top 10 clientes fiéis para degustação antes da implementação oficial', 'Lucas T.', '2026-05-31', 'agendado', 5, 1, 1, 1),
((SELECT id FROM public.obstacles WHERE code='5.1'), 'Mapear canais atuais e analisar resultados do último período, renunciando ao que não faz mais sentido', 'Comercial', 'Recurso mais bem alocado e ROI mais alto', 'Mapa dos canais com resultados dos últimos 12 meses, gráfico de desempenho de cada um + plano de ação e reestruturação para 2026', 'Lucas T.', '2026-05-18', 'nao_iniciado', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='5.1'), 'Definir em quais canais vamos focar e quais vamos deixar de utilizar', 'Marketing', 'Direcionar recursos financeiros para os canais de maior retorno e acompanhar consistentemente os resultados', 'Planejamento impresso com nome do responsável, plano de ação e apresentação para os respectivos responsáveis', 'Lucas T.', NULL, 'nao_iniciado', 5, 5, 5, 2),
((SELECT id FROM public.obstacles WHERE code='5.1'), 'Re-lançamento do Junte Selos', 'Marketing', 'Lembranças afetivas dos clientes antigos que vivenciaram o início da Estrela quando utilizávamos essa estratégia', 'Nova caixa com selo e campanha de marketing informando, rodando', 'Lucas T.', NULL, 'nao_iniciado', 5, 2, 3, 3),
((SELECT id FROM public.obstacles WHERE code='5.2'), 'Utilizar Claude, Manus e GPT para gerir tráfego pago internamente', 'Marketing', 'Maior alinhamento e engajamento', 'Cancelar contrato com a 2biz e Day 1 com tráfego de Google e Meta operado internamente', 'Ana J.', '2026-06-01', 'nao_iniciado', 5, 2, 2, 1),
((SELECT id FROM public.obstacles WHERE code='5.3'), 'Tornar a experiência do salão especial, começando pelos mimos para aniversariantes que fizerem reservas', 'Comercial', 'Nos tornarmos referência para comemorações, ganhar notoriedade e melhorar desempenho do salão', 'Kit decoração de mesa comprado + Day 1 da nova experiência + captação de feedbacks para conteúdo e divulgação da campanha de reservas', 'Ana J.', '2026-07-01', 'agendado', 5, 3, 3, 1),
((SELECT id FROM public.obstacles WHERE code='6.1'), 'Comunicação diária com clientes pela internet, criando nova referência emocional de pessoas que representam a Pizzaria Estrela', 'Marketing', 'Interações diárias nossas e da família + relacionamento com quem tinha como referência os antigos sócios', 'Resposta no direct de 100% dos haters do post "iremos fechar" com cupom de R$150 para nova experiência no salão', 'Ana J.', '2026-08-01', 'agendado', 5, 5, 5, 1),
((SELECT id FROM public.obstacles WHERE code='6.2'), 'Elaboração de calendário com diretrizes e campanhas sugeridas para criação de conteúdo', 'Marketing', 'Maior resultado das campanhas e público mais engajado', 'Cumprimento do calendário 2026 de ações de marketing + último post do ano com vídeo da família agradecendo pelo melhor ano da história da Pizzaria Estrela da Ilha', 'Ana J.', '2026-12-31', 'nao_iniciado', 5, 3, 5, 1);
