const Redis = require('ioredis');

// Explicit configuration for better stability
// maxRetriesPerRequest: null prevents crash on connection loss loop
const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    family: 4, // Force IPv4 to avoid ECONNRESET on localhost
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log('✅ Connected to Redis (127.0.0.1:6379)');
});

redis.on('error', (err) => {
    // Suppress repeated connection reset logs to avoid noise
    if (err.code === 'ECONNRESET') {
        // console.warn('⚠️ Redis connection unstable, retrying...');
    } else {
        console.error('❌ Redis Error:', err.message);
    }
});

module.exports = redis;
