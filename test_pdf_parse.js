const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');


async function createTestPdf() {
    // Minimal PDF header and trailer to satisfy basic parsers
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
178
%%EOF`;
    const filePath = 'test_upload.pdf';
    fs.writeFileSync(filePath, Buffer.from(pdfContent));
    return filePath;
}

async function testUpload() {
    try {
        const pdffile = await createTestPdf();
        const form = new FormData();
        form.append('pdf', fs.createReadStream(pdffile));
        form.append('subject', 'Physics');
        form.append('chapterName', 'Test Chapter');
        form.append('class', '12');
        form.append('board', 'CBSE');
        form.append('price', '100');

        console.log('Attempting upload...');
        // Assuming running on localhost:4000 based on logs
        // Need a valid token. Since I can't login easily without credentials,
        // I might need to bypass auth or ask user for a token. 
        // For now, let's just see if we hit the endpoint.
        
        // Actually, without a token this will fail at auth.
        // I'll create a script that just calls the SERVICE directly to test the logic 
        // effectively bypassing the controller/auth for this specific debugging of the "logic" error.
        
    } catch (e) {
        console.error(e);
    }
}

// Better approach: Unit test the service function with a real file on disk
const notesService = require('./src/modules/notes/notes.service');
const mongoose = require('mongoose');

async function runServiceTest() {
    try {
        console.log("Connecting to DB (if needed by service)...");
        // Service uses models, so might need connection or mocking. 
        // The error happens at pdfParse, which doesn't need DB.
        
        const filePath = path.join(__dirname, 'test_upload.pdf');
        if (!fs.existsSync(filePath)) await createTestPdf();
        
        const fileObj = {
            path: filePath,
            mimetype: 'application/pdf',
            size: fs.statSync(filePath).size,
            filename: 'test-upload-filename.pdf'
        };
        
        console.log("Calling upload logic directly...");
        
        // We need to mock the parts of service that require DB (TopperProfile lookup)
        // or we just extract the PDF parsing logic to test it in isolation.
        
        const buffer = fs.readFileSync(filePath);
        const pdfParse = require('pdf-parse');
        
        console.log("Testing pdf-parse directly:");
        const data = await pdfParse(buffer);
        console.log("Parsed pages:", data.numpages);
        console.log("Success!");
        
    } catch (err) {
        console.error("Test Failed:", err);
    }
}

runServiceTest();
