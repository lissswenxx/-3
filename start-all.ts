import EmbeddedPostgres from 'embedded-postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(__dirname, '..', '.pgdata');
const initSqlPath = path.join(rootDir, 'database', 'init.sql');
const envPath = path.join(__dirname, '..', '.env');

const USER = 'library';
const PASS = 'library123';
const DB = 'library_db';
const PORT = 5433;

const freshStart = process.argv.includes('--fresh');

function removeDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function isDbInitialized(client: pg.Client) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments'`
  );
  return (res.rowCount ?? 0) > 0;
}

async function reinitDatabase(client: pg.Client) {
  console.log('[2/4] Пересоздание таблиц и загрузка тестовых данных...');
  await client.query(`
    DROP TABLE IF EXISTS loans CASCADE;
    DROP TABLE IF EXISTS reader_versions CASCADE;
    DROP TABLE IF EXISTS readers CASCADE;
    DROP TABLE IF EXISTS periodicals CASCADE;
    DROP TABLE IF EXISTS books CASCADE;
    DROP TABLE IF EXISTS catalog_items CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;
  `);
  const sql = fs.readFileSync(initSqlPath, 'utf-8');
  await client.query(sql);
}

async function canConnectToDb() {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    password: PASS,
    database: DB,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== Запуск системы управления библиотекой ===\n');

  if (freshStart) {
    console.log('Режим: полный перезапуск (чистая база данных)\n');
    removeDir(dataDir);
  }

  let embedded: EmbeddedPostgres | null = null;
  let managedPostgres = false;

  if (await canConnectToDb()) {
    console.log(`[1/4] PostgreSQL уже запущен на порту ${PORT}.`);
  } else {
    embedded = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: USER,
      password: PASS,
      port: PORT,
      persistent: true,
    });

    console.log('[1/4] PostgreSQL (встроенный)...');
    await embedded.initialise();
    try {
      await embedded.start();
      managedPostgres = true;
    } catch (err) {
      if (await canConnectToDb()) {
        console.log(`[1/4] PostgreSQL уже запущен на порту ${PORT}.`);
      } else {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'не удалось запустить PostgreSQL';
        throw new Error(
          `${message}. Порт ${PORT} занят или база недоступна. Закройте другой экземпляр и повторите запуск.`
        );
      }
    }

    if (embedded) {
      try {
        await embedded.createDatabase(DB);
      } catch {
        /* база уже существует */
      }
    }
  }

  const client = new pg.Client({
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    password: PASS,
    database: DB,
  });
  await client.connect();

  if (freshStart || !(await isDbInitialized(client))) {
    if (!freshStart) {
      console.log('[2/4] Создание таблиц и тестовых данных...');
      const sql = fs.readFileSync(initSqlPath, 'utf-8');
      await client.query(sql);
    } else {
      await reinitDatabase(client);
    }
  } else {
    console.log('[2/4] База данных уже инициализирована.');
  }
  await client.end();

  const databaseUrl = `postgresql://${USER}:${PASS}@127.0.0.1:${PORT}/${DB}?schema=public`;
  process.env.DATABASE_URL = databaseUrl;
  fs.writeFileSync(envPath, `DATABASE_URL="${databaseUrl}"\n`);

  console.log('[3/4] Подключение к базе данных настроено.');
  console.log('[4/4] Запуск сервера...\n');
  console.log('  Откройте в браузере: http://localhost:3001\n');

  await import('../src/index.js');

  const shutdown = async () => {
    if (managedPostgres && embedded) {
      console.log('\nОстановка PostgreSQL...');
      await embedded.stop();
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  const message =
    err instanceof Error ? err.message : err == null ? 'неизвестная ошибка' : String(err);
  console.error('Ошибка запуска:', message);
  process.exit(1);
});
