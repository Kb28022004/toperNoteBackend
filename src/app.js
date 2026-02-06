const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'TopperNotes API' });
});

// API Routes
app.use('/api/v1', routes);

// Global Error Handler (LAST)
app.use(errorMiddleware);

module.exports = app;
