import pg from 'pg';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: {
        rejectUnauthorized: false,
    },
});

const app = express();

app.use(cors());
app.use(express.json());

// --- Database Schemas & Init ---
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    type VARCHAR(50) DEFAULT 'chat',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_used VARCHAR(255),
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
`;

app.post('/api/init-db', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query(SCHEMA_SQL);
        // Migration: Add type if not exists
        await client.query(`ALTER TABLE threads ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'chat'`);
        client.release();
        res.json({ status: 'success', message: 'Database initialized and migrated' });
    } catch (err) {
        console.error('Init DB Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// --- API Endpoints ---

// User Sync
app.post('/api/users', async (req, res) => {
    const { uid, email, displayName, photoURL } = req.body;
    try {
        await pool.query(
            `INSERT INTO users (id, email, display_name, photo_url, last_login)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (id) DO UPDATE 
             SET email = EXCLUDED.email, 
                 display_name = EXCLUDED.display_name, 
                 photo_url = EXCLUDED.photo_url,
                 last_login = NOW()`,
            [uid, email, displayName, photoURL]
        );
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Threads for User
app.get('/api/threads', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
        const result = await pool.query(
            'SELECT * FROM threads WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Thread
app.post('/api/threads', async (req, res) => {
    const { userId, title, type } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO threads (user_id, title, type) VALUES ($1, $2, $3) RETURNING *',
            [userId, title, type || 'chat']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Thread (e.g. Title)
app.put('/api/threads/:id', async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    try {
        await pool.query('UPDATE threads SET title = $1, updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000) WHERE id = $2', [title, id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Thread
app.delete('/api/threads/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM threads WHERE id = $1', [id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Messages for Thread
app.get('/api/threads/:threadId/messages', async (req, res) => {
    const { threadId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE thread_id = $1 ORDER BY timestamp ASC',
            [threadId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Message
app.post('/api/messages', async (req, res) => {
    const { threadId, role, content, modelUsed } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO messages (thread_id, role, content, model_used) VALUES ($1, $2, $3, $4) RETURNING *',
            [threadId, role, content, modelUsed]
        );
        // Also update thread updated_at
        await pool.query('UPDATE threads SET updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000) WHERE id = $1', [threadId]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test Connection
app.get('/api/test-db', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        res.json({ status: 'success', time: result.rows[0].now });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Vercel Serverless Function Export
export default app;
