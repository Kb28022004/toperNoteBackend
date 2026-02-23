/**
 * Centralized API Response Utility
 * Enforces a consistent envelope across ALL endpoints:
 *   { success, message, data, pagination? }
 */

/**
 * Send a success response
 * @param {object} res - Express response object
 * @param {string} message - Human-readable message
 * @param {*}      data - Response payload (null → omitted)
 * @param {object} [pagination] - Pagination metadata (optional)
 * @param {number} [statusCode=200] - HTTP status code
 */
const sendSuccess = (res, message = 'Success', data = null, pagination = null, statusCode = 200) => {
    const response = { success: true, message };
    if (data !== null && data !== undefined) response.data = data;
    if (pagination !== null) response.pagination = pagination;
    return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {object} res - Express response object
 * @param {string} message - Human-readable error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {*}      [errors] - Validation errors (only shown in non-production)
 */
const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
    const response = { success: false, message };
    if (errors && process.env.NODE_ENV !== 'production') {
        response.errors = errors;
    }
    return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
