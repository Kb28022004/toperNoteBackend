const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis = require('../config/redis');

// General rate limiter for all API routes
// General rate limiter for all API routes (switched to MemoryStore for stability)
exports.apiLimiter = rateLimit({
    // store: new RedisStore({
    //     sendCommand: (...args) => redis.call(...args),
    // }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for Auth (OTP) routes (switched to MemoryStore for stability)
exports.authLimiter = rateLimit({
    // store: new RedisStore({
    //     sendCommand: (...args) => redis.call(...args),
    //     prefix: 'rl-auth:'
    // }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 OTP requests per hour (Relaxed for Dev)
    message: {
        success: false,
        message: "Too many login attempts, please try again after an hour",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
