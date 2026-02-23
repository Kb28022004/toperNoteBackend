const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis = require('../config/redis');

// Helper: only use Redis store if Redis is connected, else fallback gracefully
const makeRedisStore = (prefix) => {
    try {
        return new RedisStore({
            sendCommand: (...args) => redis.call(...args),
            prefix,
        });
    } catch {
        // Redis not available, fall back to in-memory (still provides basic protection)
        return undefined;
    }
};

// General rate limiter for all API routes
exports.apiLimiter = rateLimit({
    store: makeRedisStore('rl-api:'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 300 : 1000,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '::1', // skip localhost in dev
});

// Stricter rate limiter for auth/OTP routes
exports.authLimiter = rateLimit({
    store: makeRedisStore('rl-auth:'),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 500,
    message: {
        success: false,
        message: 'Too many login attempts, please try again after an hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for payment routes (prevent flooding)
exports.paymentLimiter = rateLimit({
    store: makeRedisStore('rl-pay:'),
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    message: {
        success: false,
        message: 'Too many payment requests, please slow down',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
