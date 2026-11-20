BEGIN;
CREATE TABLE report_categories (
    id TEXT PRIMARY KEY,
    name VARCHAR(80) NOT NULL CHECK (length(btrim(name)) > 0),
    name_key TEXT NOT NULL UNIQUE,
    position INTEGER NOT NULL DEFAULT 6,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO report_categories (id,name,name_key,position) VALUES
    ('POTHOLE','Buraco na via','buraco na via',0),
    ('WASTE','Lixo não coletado','lixo nao coletado',1),
    ('LIGHTING','Iluminação pública','iluminacao publica',2),
    ('DEBRIS','Entulho irregular','entulho irregular',3),
    ('LEAK','Vazamento de água/esgoto','vazamento de agua/esgoto',4),
    ('TREE','Poda/risco de árvore','poda/risco de arvore',5);
ALTER TABLE reports ALTER COLUMN category TYPE TEXT USING upper(category::text COLLATE "C");
ALTER TABLE reports ADD CONSTRAINT reports_category_fkey FOREIGN KEY (category)
    REFERENCES report_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TYPE report_category;
COMMIT;
