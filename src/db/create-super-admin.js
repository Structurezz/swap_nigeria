/**
 * Creates or promotes a super admin account.
 * Usage: node src/db/create-super-admin.js <email> <password> <fullName>
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const [email, password, fullName = 'Super Admin'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node src/db/create-super-admin.js <email> <password> [fullName]');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    user.isAdmin = true;
    user.status = 'active';
    await user.save();
    console.log(`✓ Existing user promoted to admin: ${user.fullName} (${user.email})`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    // Insert directly to avoid Mongoose casting phone/username to null (sparse index conflict)
    await User.collection.insertOne({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      status: 'active',
      isAdmin: true,
      referralCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Super admin created: ${fullName} (${email})`);
  }

  await mongoose.disconnect();
})();
