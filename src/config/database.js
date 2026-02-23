const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 20,        // handle more concurrent connections
            minPoolSize: 5,         // keep minimum ready connections
            serverSelectionTimeoutMS: 5000,  // fail fast if DB unreachable
            socketTimeoutMS: 45000, // close sockets after 45s inactivity
        });
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        throw err;
    }
};

module.exports = connectDB;
