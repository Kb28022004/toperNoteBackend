const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const notesController = require('../src/modules/notes/notes.controller');
const notesService = require('../src/modules/notes/notes.service');
const TopperProfile = require('../src/modules/toppers/topper.model');

// Mock dependencies
jest.mock('../src/modules/notes/notes.service');

const app = express();
app.use(express.json());

// Mock route
app.post('/notes', (req, res, next) => {
  req.user = { id: 'test-user-id' };
  req.files = { pdf: [{ path: 'test.pdf', mimetype: 'application/pdf' }] };
  next();
}, notesController.uploadNote);

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('Notes Upload', () => {
    it('should upload note successfully even without manual pageCount', async () => {
        // Mock service success
        notesService.uploadNote.mockResolvedValue({
            _id: 'note-id',
            subject: 'Physics',
            pageCount: 10
        });

        const res = await request(app)
            .post('/notes')
            .send({
                subject: 'Physics',
                chapterName: 'Optics',
                class: '12',
                board: 'CBSE',
                price: 100
                // pageCount OMITTED intentionally
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
});
