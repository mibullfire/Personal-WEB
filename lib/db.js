const { Pool } = require('pg');
const SEED_POSTS = require('./seed-posts');

// Railway inyecta DATABASE_URL al referenciar la base de datos Postgres.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // La red interna de Railway no usa SSL; la URL publica si (PGSSL=true).
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 5,
    })
  : null;

function enabled() {
  return pool !== null;
}

async function init() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      body        TEXT NOT NULL,
      mood        TEXT NOT NULL DEFAULT '',
      music       TEXT NOT NULL DEFAULT '',
      tags        TEXT[] NOT NULL DEFAULT '{}',
      images      TEXT[] NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC, id DESC);
  `);

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM posts');
  if (rows[0].n === 0) {
    for (const p of SEED_POSTS) {
      await pool.query(
        `INSERT INTO posts (title, body, mood, music, tags, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.title, p.body, p.mood, p.music, p.tags, p.created_at]
      );
    }
    console.log(`Base de datos inicializada con ${SEED_POSTS.length} posts`);
  }
}

// "50%_off" -> "50\%\_off" para que el texto buscado sea literal en ILIKE.
function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}

async function listPosts({ page, perPage, q, tag, photos }) {
  const where = [];
  const params = [];

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const n = `$${params.length}`;
    where.push(`(title ILIKE ${n} OR body ILIKE ${n} OR mood ILIKE ${n}
                 OR music ILIKE ${n} OR array_to_string(tags, ' ') ILIKE ${n})`);
  }
  if (tag) {
    params.push(tag);
    where.push(`$${params.length} = ANY(tags)`);
  }
  if (photos) {
    where.push('cardinality(images) > 0');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS total FROM posts ${whereSql}`,
    params
  );
  const total = countRows[0].total;

  const { rows } = await pool.query(
    `SELECT id, title, body, mood, music, tags, images, created_at
     FROM posts ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, perPage, (page - 1) * perPage]
  );

  return { posts: rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

async function getPost(id) {
  const { rows } = await pool.query(
    'SELECT id, title, body, mood, music, tags, images, created_at FROM posts WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function listTags() {
  const { rows } = await pool.query(`
    SELECT tag, count(*)::int AS count
    FROM posts, unnest(tags) AS tag
    GROUP BY tag
    ORDER BY count DESC, tag
  `);
  return rows;
}

async function createPost({ title, body, mood, music, tags, images }) {
  const { rows } = await pool.query(
    `INSERT INTO posts (title, body, mood, music, tags, images)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, body, mood, music, tags, images, created_at`,
    [title, body, mood, music, tags, images]
  );
  return rows[0];
}

// Devuelve el post borrado (para limpiar sus fotos del volumen) o null.
async function deletePost(id) {
  const { rows } = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING images', [id]);
  return rows[0] || null;
}

// Crea la tabla una sola vez. Si falla (p. ej. Postgres aun arrancando),
// se reintenta en la siguiente peticion en lugar de dejar el blog roto.
let initPromise = null;
function ready() {
  if (!initPromise) {
    initPromise = init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

module.exports = { enabled, ready, listPosts, getPost, listTags, createPost, deletePost };
