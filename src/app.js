const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// ─── Ensure Upload Directory Structure ────────────────────────────────────────
['uploads', 'uploads/pdfs', 'uploads/previews', 'uploads/profiles', 'uploads/marksheets'].forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// ─── Security Headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow our CDN/uploads
    contentSecurityPolicy: false, // disable for API-only server (no HTML served)
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = isProduction
    ? (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5174', 'http://localhost:8081'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || !isProduction) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Request Logger (minimal, no sensitive data) ─────────────────────────────
app.use((req, _res, next) => {
    if (!isProduction) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api/v1', apiLimiter);

// ─── Health Check (no auth, no rate limit) ───────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler (MUST be last) ─────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;
