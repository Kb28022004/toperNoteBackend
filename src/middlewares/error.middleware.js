/**
 * Global Error Handler Middleware
 * - Never leaks stack traces or internal messages to clients in production
 * - Structured logging for observability
 */

const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    // Structured server-side logging (swap console.error for Sentry/Datadog in prod)
    console.error({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        status: statusCode,
        message: err.message,
        ...(isProduction ? {} : { stack: err.stack }),
    });

    // Sanitize validation errors (Joi/express-validator)
    if (err.isJoi || err.name === 'ValidationError') {
        return res.status(422).json({
            success: false,
            message: 'Validation failed',
            errors: isProduction ? undefined : err.details?.map(d => d.message),
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Handle Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid resource ID' });
    }

    // Handle Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    // Generic fallback — never expose internal messages in production
    return res.status(statusCode).json({
        success: false,
        message: isProduction
            ? (statusCode < 500 ? err.message : 'Internal server error')
            : err.message || 'Internal server error',
    });
};

module.exports = errorMiddleware;
