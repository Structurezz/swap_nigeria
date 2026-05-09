require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env.example') });
const mongoose = require('mongoose');

let config;
try {
  config = require('../config/env');
} catch (e) {
  config = { MONGODB_URI: process.env.MONGODB_URI };
}

const User = require('../models/User');
const Category = require('../models/Category');
const Listing = require('../models/Listing');
const OtpCode = require('../models/OtpCode');

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', icon: '📱' },
  { name: 'Fashion & Clothing', slug: 'fashion', icon: '👗' },
  { name: 'Furniture & Home', slug: 'furniture', icon: '🛋️' },
  { name: 'Books & Education', slug: 'books', icon: '📚' },
  { name: 'Sports & Fitness', slug: 'sports', icon: '⚽' },
  { name: 'Food & Agriculture', slug: 'food', icon: '🌽' },
  { name: 'Services', slug: 'services', icon: '🛠️' },
  { name: 'Art & Crafts', slug: 'art', icon: '🎨' },
  { name: 'Vehicles & Parts', slug: 'vehicles', icon: '🚗' },
  { name: 'Others', slug: 'others', icon: '📦' },
];

const TEST_USERS = [
  { phone: '+2348000000001', fullName: 'Amaka Okafor', username: 'amaka_swaps', locationState: 'Lagos', locationLga: 'Ikeja', status: 'active' },
  { phone: '+2348000000002', fullName: 'Chidi Nwosu', username: 'chidi_trader', locationState: 'Abuja', locationLga: 'Garki', status: 'active' },
  { phone: '+2348000000003', fullName: 'Fatima Bello', username: 'fatima_b', locationState: 'Kano', locationLga: 'Kano Municipal', status: 'active' },
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected!');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Listing.deleteMany({}),
    OtpCode.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // Create categories
  const categories = await Category.insertMany(CATEGORIES);
  console.log(`Created ${categories.length} categories`);

  const catMap = {};
  categories.forEach(c => { catMap[c.slug] = c._id; });

  // Create users
  const users = await User.insertMany(TEST_USERS);
  console.log(`Created ${users.length} users`);

  const [amaka, chidi, fatima] = users;

  // Create listings
  const listings = await Listing.insertMany([
    {
      userId: amaka._id,
      title: 'Samsung Galaxy S21 (128GB)',
      description: 'Excellent condition Samsung Galaxy S21 with original box and accessories. Minor scratches on screen protector.',
      categoryId: catMap.electronics,
      listingType: 'goods',
      condition: 'like_new',
      estimatedValue: 180000,
      images: ['https://via.placeholder.com/400x300?text=Samsung+S21'],
      wantsTitle: 'iPhone 12 or 13',
      wantsDescription: 'Looking to trade for any iPhone 12/13 with good battery health',
      wantsCategoryId: catMap.electronics,
      wantsValueMin: 150000,
      wantsValueMax: 250000,
      locationState: 'Lagos',
      locationLga: 'Ikeja',
      status: 'active',
    },
    {
      userId: chidi._id,
      title: 'iPhone 13 (256GB)',
      description: 'Used iPhone 13 in good condition. No cracks. Battery health 88%. Comes with charger.',
      categoryId: catMap.electronics,
      listingType: 'goods',
      condition: 'good',
      estimatedValue: 220000,
      images: ['https://via.placeholder.com/400x300?text=iPhone+13'],
      wantsTitle: 'Android Flagship',
      wantsDescription: 'Interested in Samsung S21 or Pixel 6',
      wantsCategoryId: catMap.electronics,
      locationState: 'Abuja',
      locationLga: 'Garki',
      status: 'active',
    },
    {
      userId: fatima._id,
      title: 'Handmade Leather Bag Collection',
      description: 'Beautiful handmade leather bags. I make custom bags and am willing to trade my craft for tech items.',
      categoryId: catMap.fashion,
      listingType: 'goods',
      condition: 'new',
      estimatedValue: 45000,
      images: ['https://via.placeholder.com/400x300?text=Leather+Bags'],
      wantsTitle: 'Laptop or Tablet',
      wantsDescription: 'Need a laptop or iPad for my business. Would trade multiple bags.',
      wantsCategoryId: catMap.electronics,
      locationState: 'Kano',
      locationLga: 'Kano Municipal',
      status: 'active',
    },
    {
      userId: amaka._id,
      title: 'Web Development Services',
      description: 'I offer full-stack web development services. Can build your website in exchange for useful items or services.',
      categoryId: catMap.services,
      listingType: 'services',
      estimatedValue: 100000,
      wantsTitle: 'Photography or Design Services',
      wantsDescription: 'Need a photographer for my portfolio or a graphic designer',
      wantsCategoryId: catMap.services,
      locationState: 'Lagos',
      locationLga: 'Ikeja',
      status: 'active',
    },
    {
      userId: chidi._id,
      title: 'Office Chair (Ergonomic)',
      description: 'Herman Miller style ergonomic office chair. Very comfortable, used for 6 months. Moving offices.',
      categoryId: catMap.furniture,
      listingType: 'goods',
      condition: 'good',
      estimatedValue: 35000,
      images: ['https://via.placeholder.com/400x300?text=Office+Chair'],
      wantsTitle: 'Standing Desk',
      wantsDescription: 'Prefer a height-adjustable standing desk',
      wantsCategoryId: catMap.furniture,
      locationState: 'Abuja',
      locationLga: 'Garki',
      status: 'active',
    },
  ]);

  console.log(`Created ${listings.length} listings`);

  // Pre-seed OTPs for test users (dev only)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await OtpCode.insertMany(
    TEST_USERS.map(u => ({
      phone: u.phone,
      code: '123456',
      expiresAt,
      used: false,
    }))
  );
  console.log('Pre-seeded OTP 123456 for all test users');

  console.log('\nTest users created:');
  TEST_USERS.forEach(u => {
    console.log(`  ${u.fullName}: ${u.phone} (OTP: 123456)`);
  });

  await mongoose.disconnect();
  console.log('\nSeed complete!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
