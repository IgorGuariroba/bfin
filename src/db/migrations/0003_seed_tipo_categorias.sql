-- Seed tipo_categorias
INSERT INTO "tipo_categorias" ("slug", "nome") VALUES
  ('receita', 'Receita'),
  ('despesa', 'Despesa'),
  ('divida', 'Dívida')
ON CONFLICT ("slug") DO NOTHING;
