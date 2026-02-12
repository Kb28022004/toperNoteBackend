require('dotenv').config(); // Trigger restart for port 8000
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 TopperNotes API running on port ${PORT}`);
      console.log('Server Restarted & Validation Schema Reloaded');
    });
  } catch (err) {
    console.error('❌ Server startup failed', err);
    process.exit(1);
  }
})();
