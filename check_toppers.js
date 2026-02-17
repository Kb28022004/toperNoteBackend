const mongoose = require('mongoose');
const TopperProfile = require('./src/modules/toppers/topper.model');
require('dotenv').config();

const checkToppers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const toppers = await TopperProfile.find({}, { firstName: 1, status: 1, expertiseClass: 1 });
    console.log('📊 Topper Profiles in DB:', toppers.length);
    console.table(toppers.map(t => ({ id: t._id, name: t.firstName, status: t.status, class: t.expertiseClass })));

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

checkToppers();
