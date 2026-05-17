/**
 * Usage: node src/db/make-admin.js <phone|email>
 * Example: node src/db/make-admin.js +2348000000001
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: node src/db/make-admin.js <phone|email>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ $or: [{ phone: identifier }, { email: identifier }] });
  if (!user) {
    console.error(`No user found for: ${identifier}`);
    process.exit(1);
  }
  user.isAdmin = true;
  await user.save();
  console.log(`✓ ${user.fullName} (${user.phone || user.email}) is now an admin`);
  await mongoose.disconnect();
})();
