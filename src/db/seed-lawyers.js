/**
 * Seed legal practitioners into the SwapNaija database.
 * Run: node src/db/seed-lawyers.js
 *
 * Uses upsert on phone so re-running is safe.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

const LAWYERS = [
  {
    phone:                '+2349010000101',
    email:                'adaeze.okoye@swapnaija.ng',
    fullName:             'Adaeze Okoye',
    username:             'adaeze_law',
    locationState:        'Lagos',
    locationLga:          'Victoria Island',
    isLegalPractitioner:  true,
    legalBio:             'Senior partner with 12 years in Nigerian commercial law. Specialises in e-commerce disputes, digital asset transactions, and consumer protection matters.',
    legalSpecialization:  'commercial',
    legalBarNumber:       'NBA/LAG/2012/04821',
    legalFeePerCaseKobo:  250000,   // ₦2,500 / 2,500 BC
    legalCasesTotal:      34,
    legalCasesWon:        27,
    walletBalance:        500000,
    status:               'active',
  },
  {
    phone:                '+2349010000102',
    email:                'emeka.njoku@swapnaija.ng',
    fullName:             'Emeka Njoku',
    username:             'emeka_njoku_esq',
    locationState:        'Abuja',
    locationLga:          'Garki',
    isLegalPractitioner:  true,
    legalBio:             'Called to bar 2015. Handles high-value barter and property exchange disputes with a focus on evidence law and alternative dispute resolution.',
    legalSpecialization:  'commercial',
    legalBarNumber:       'NBA/ABJ/2015/00347',
    legalFeePerCaseKobo:  150000,   // ₦1,500
    legalCasesTotal:      21,
    legalCasesWon:        18,
    walletBalance:        300000,
    status:               'active',
  },
  {
    phone:                '+2349010000103',
    email:                'funmi.adeyemi@swapnaija.ng',
    fullName:             'Funmilayo Adeyemi',
    username:             'funmi_adeyemi_law',
    locationState:        'Oyo',
    locationLga:          'Ibadan North',
    isLegalPractitioner:  true,
    legalBio:             'Consumer protection advocate and digital-rights lawyer. 8 years helping individuals fight unfair trade practices and fraudulent transactions.',
    legalSpecialization:  'consumer',
    legalBarNumber:       'NBA/OYO/2016/01192',
    legalFeePerCaseKobo:  100000,   // ₦1,000
    legalCasesTotal:      47,
    legalCasesWon:        39,
    walletBalance:        200000,
    status:               'active',
  },
  {
    phone:                '+2349010000104',
    email:                'babatunde.salami@swapnaija.ng',
    fullName:             'Babatunde Salami',
    username:             'baba_salami_law',
    locationState:        'Lagos',
    locationLga:          'Ikeja',
    isLegalPractitioner:  true,
    legalBio:             'General practice solicitor with 6 years across commercial, property, and family law. Known for swift, cost-effective dispute resolution.',
    legalSpecialization:  'general',
    legalBarNumber:       'NBA/LAG/2018/07654',
    legalFeePerCaseKobo:  75000,    // ₦750
    legalCasesTotal:      15,
    legalCasesWon:        11,
    walletBalance:        150000,
    status:               'active',
  },
  {
    phone:                '+2349010000105',
    email:                'ngozi.eze@swapnaija.ng',
    fullName:             'Ngozi Eze',
    username:             'ngozi_eze_barrister',
    locationState:        'Enugu',
    locationLga:          'Enugu East',
    isLegalPractitioner:  true,
    legalBio:             'Property law specialist with 10 years in real estate and goods-exchange disputes. Clients range from SMEs to individual traders.',
    legalSpecialization:  'property',
    legalBarNumber:       'NBA/ENU/2014/00891',
    legalFeePerCaseKobo:  200000,   // ₦2,000
    legalCasesTotal:      28,
    legalCasesWon:        22,
    walletBalance:        400000,
    status:               'active',
  },
  {
    phone:                '+2349010000106',
    email:                'ibrahim.musa@swapnaija.ng',
    fullName:             'Ibrahim Musa',
    username:             'ibrahim_musa_esq',
    locationState:        'Kano',
    locationLga:          'Kano Municipal',
    isLegalPractitioner:  true,
    legalBio:             'Commercial and Islamic finance law expert. Handles trade disputes with cross-border and multi-commodity elements across northern Nigeria.',
    legalSpecialization:  'commercial',
    legalBarNumber:       'NBA/KAN/2013/00563',
    legalFeePerCaseKobo:  120000,   // ₦1,200
    legalCasesTotal:      19,
    legalCasesWon:        15,
    walletBalance:        250000,
    status:               'active',
  },
  {
    phone:                '+2349010000107',
    email:                'chioma.obi@swapnaija.ng',
    fullName:             'Chioma Obi',
    username:             'chioma_obi_law',
    locationState:        'Rivers',
    locationLga:          'Port Harcourt',
    isLegalPractitioner:  true,
    legalBio:             'Fresh call (2021) with a focus on digital trade and e-commerce law. Affordable, thorough, and tech-savvy — ideal for online marketplace disputes.',
    legalSpecialization:  'consumer',
    legalBarNumber:       'NBA/RIV/2021/02201',
    legalFeePerCaseKobo:  50000,    // ₦500
    legalCasesTotal:      8,
    legalCasesWon:        6,
    walletBalance:        100000,
    status:               'active',
  },
  {
    phone:                '+2349010000108',
    email:                'tolu.adesanya@swapnaija.ng',
    fullName:             'Tolulope Adesanya',
    username:             'tolu_adesanya_law',
    locationState:        'Lagos',
    locationLga:          'Lekki',
    isLegalPractitioner:  true,
    legalBio:             'Founding partner of Adesanya & Co. 15 years in high-value commercial arbitration. Preferred by corporations for complex multi-party disputes.',
    legalSpecialization:  'commercial',
    legalBarNumber:       'NBA/LAG/2009/00234',
    legalFeePerCaseKobo:  500000,   // ₦5,000
    legalCasesTotal:      62,
    legalCasesWon:        51,
    walletBalance:        1000000,
    status:               'active',
  },
];

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/swapnaija';
  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('Connected.\n');

  const passwordHash = await bcrypt.hash('Swapnaija@2024', 10);
  let created = 0, updated = 0;

  for (const lawyer of LAWYERS) {
    const doc = await User.findOneAndUpdate(
      { phone: lawyer.phone },
      {
        $set: {
          ...lawyer,
          passwordHash,
          isVerified: true,
          ratingAvg:   lawyer.legalCasesTotal > 0
            ? Math.round((lawyer.legalCasesWon / lawyer.legalCasesTotal) * 30 + 20) / 10  // 2.0–5.0
            : 4.0,
          ratingCount: lawyer.legalCasesTotal,
        },
      },
      { upsert: true, new: true },
    );

    const wasNew = doc.createdAt?.getTime() === doc.updatedAt?.getTime();
    console.log(`  ${wasNew ? '✅ Created' : '🔄 Updated'}: ${lawyer.fullName} (${lawyer.legalSpecialization}) · ${lawyer.legalBarNumber}`);
    wasNew ? created++ : updated++;
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
