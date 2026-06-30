-- Система управления библиотекой
-- Иерархия: departments (adjacency list)
-- Наследование: Table per Type (catalog_items -> books / periodicals)
-- Версионирование: readers + reader_versions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== ИЕРАРХИЯ: подразделения библиотеки ==========
CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50),
    parent_id   INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT departments_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_departments_parent ON departments(parent_id);

-- ========== НАСЛЕДОВАНИЕ (TPT): каталог ==========
CREATE TABLE catalog_items (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    inventory_no    VARCHAR(50) NOT NULL UNIQUE,
    department_id   INTEGER NOT NULL REFERENCES departments(id),
    acquired_at     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalog_items_department ON catalog_items(department_id);

CREATE TABLE books (
    catalog_item_id INTEGER PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    isbn            VARCHAR(20),
    author          VARCHAR(300) NOT NULL,
    pages           INTEGER CHECK (pages > 0),
    publisher       VARCHAR(200)
);

CREATE TABLE periodicals (
    catalog_item_id INTEGER PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    issn            VARCHAR(20),
    issue_number    VARCHAR(50),
    frequency       VARCHAR(50) NOT NULL
);

-- ========== ВЕРСИОНИРОВАНИЕ: читатели ==========
CREATE TABLE readers (
    id          SERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reader_versions (
    id              SERIAL PRIMARY KEY,
    reader_id       INTEGER NOT NULL REFERENCES readers(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    full_name       VARCHAR(300) NOT NULL,
    email           VARCHAR(200),
    phone           VARCHAR(30),
    passport_no     VARCHAR(50),
    membership_type VARCHAR(50) NOT NULL DEFAULT 'обычный',
    CONSTRAINT reader_versions_unique_version UNIQUE (reader_id, version_number),
    CONSTRAINT reader_versions_membership CHECK (
        membership_type IN ('обычный', 'студент', 'сотрудник', 'пенсионер')
    )
);

CREATE UNIQUE INDEX idx_reader_versions_current
    ON reader_versions(reader_id) WHERE is_current = TRUE;

CREATE INDEX idx_reader_versions_reader ON reader_versions(reader_id, version_number DESC);

-- ========== Выдачи (дополнительная связь для демо) ==========
CREATE TABLE loans (
    id              SERIAL PRIMARY KEY,
    reader_id       INTEGER NOT NULL REFERENCES readers(id),
    catalog_item_id INTEGER NOT NULL REFERENCES catalog_items(id),
    loaned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at          DATE NOT NULL,
    returned_at     TIMESTAMPTZ
);

-- ========== Тестовые данные ==========
INSERT INTO departments (id, name, code, parent_id) VALUES
    (1, 'Центральная библиотека', 'ГЛАВ', NULL),
    (2, 'Отдел художественной литературы', 'ХУД', 1),
    (3, 'Русская классика', 'РУС-КЛ', 2),
    (4, 'Зарубежная проза', 'ЗАР', 2),
    (5, 'Научно-технический отдел', 'НТО', 1),
    (6, 'Периодика и журналы', 'ПЕР', 1),
    (7, 'Читальный зал', 'ЧЗ', 1);

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));

INSERT INTO catalog_items (id, title, inventory_no, department_id, acquired_at) VALUES
    (1, 'Война и мир', 'КН-001', 3, '2020-01-15'),
    (2, 'Преступление и наказание', 'КН-002', 3, '2019-06-10'),
    (3, '1984', 'КН-003', 4, '2021-03-20'),
    (4, 'Наука и жизнь', 'ПР-001', 6, '2024-11-01'),
    (5, 'National Geographic', 'ПР-002', 6, '2024-12-01');

SELECT setval('catalog_items_id_seq', (SELECT MAX(id) FROM catalog_items));

INSERT INTO books (catalog_item_id, isbn, author, pages, publisher) VALUES
    (1, '978-5-17-123456-7', 'Л.Н. Толстой', 1274, 'АСТ'),
    (2, '978-5-17-234567-8', 'Ф.М. Достоевский', 671, 'АСТ'),
    (3, '978-0-452-28423-4', 'Дж. Оруэлл', 328, 'Penguin');

INSERT INTO periodicals (catalog_item_id, issn, issue_number, frequency) VALUES
    (4, '1683-5140', '11/2024', 'ежемесячно'),
    (5, '0027-9358', '12/2024', 'ежемесячно');

INSERT INTO readers (id) VALUES (1), (2);
SELECT setval('readers_id_seq', (SELECT MAX(id) FROM readers));

INSERT INTO reader_versions (reader_id, version_number, valid_from, is_current, full_name, email, phone, passport_no, membership_type) VALUES
    (1, 1, '2023-01-10 10:00:00+00', FALSE, 'Иванов Иван Иванович', 'ivanov@mail.ru', '+79001112233', '4510 123456', 'обычный'),
    (1, 2, '2024-06-15 14:30:00+00', TRUE,  'Иванов Иван Петрович', 'ivanov.new@mail.ru', '+79001112233', '4510 123456', 'сотрудник'),
    (2, 1, '2024-02-01 09:00:00+00', TRUE,  'Петрова Анна Сергеевна', 'petrova@uni.ru', '+79004445566', '4511 654321', 'студент');

INSERT INTO loans (reader_id, catalog_item_id, loaned_at, due_at) VALUES
    (1, 1, '2025-04-01', '2025-05-01'),
    (2, 3, '2025-04-10', '2025-05-10');
