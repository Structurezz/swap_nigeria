require('dotenv').config();
const mongoose = require('mongoose');

const config = { MONGODB_URI: process.env.MONGODB_URI };

const User = require('../models/User');
const Category = require('../models/Category');
const Listing = require('../models/Listing');
const OtpCode = require('../models/OtpCode');

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Electronics',        slug: 'electronics', icon: '📱' },
  { name: 'Fashion & Clothing', slug: 'fashion',     icon: '👗' },
  { name: 'Furniture & Home',   slug: 'furniture',   icon: '🛋️' },
  { name: 'Books & Education',  slug: 'books',       icon: '📚' },
  { name: 'Sports & Fitness',   slug: 'sports',      icon: '⚽' },
  { name: 'Food & Agriculture', slug: 'food',        icon: '🌽' },
  { name: 'Services',           slug: 'services',    icon: '🛠️' },
  { name: 'Art & Crafts',       slug: 'art',         icon: '🎨' },
  { name: 'Vehicles & Parts',   slug: 'vehicles',    icon: '🚗' },
  { name: 'Others',             slug: 'others',      icon: '📦' },
];

// ─── Test users ───────────────────────────────────────────────────────────────
const TEST_USERS = [
  { phone: '+2348000000001', email: 'amaka@swapnaija.ng',   fullName: 'Amaka Okafor',  username: 'amaka_swaps',   locationState: 'Lagos', locationLga: 'Ikeja',          status: 'active' },
  { phone: '+2348000000002', email: 'chidi@swapnaija.ng',   fullName: 'Chidi Nwosu',   username: 'chidi_trader',  locationState: 'Abuja', locationLga: 'Garki',          status: 'active' },
  { phone: '+2348000000003', email: 'fatima@swapnaija.ng',  fullName: 'Fatima Bello',  username: 'fatima_b',      locationState: 'Kano',  locationLga: 'Kano Municipal', status: 'active' },
  // Fixed-ID dev account — preserved across reseeds
  { _id: new mongoose.Types.ObjectId('69ffd094b098fffb00cb84ea'),
    phone: '+2348000000004', email: 'orizu1996@gmail.com',  fullName: 'Michael Orizu', username: 'michael_orizu', locationState: 'Lagos', locationLga: 'Lekki',          status: 'active',
    walletBalance: 50000000 }, // 500,000 BC = ₦500,000
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const NIGERIAN_STATES = [
  'Lagos','Abuja','Kano','Rivers','Oyo','Kaduna','Delta','Anambra','Enugu',
  'Imo','Ogun','Edo','Borno','Bauchi','Katsina','Ondo','Osun','Ekiti',
  'Cross River','Akwa Ibom','Plateau','Sokoto','Kwara','Niger','Benue',
];

const LGAS = {
  Lagos:      ['Ikeja','Surulere','Lekki','Yaba','Oshodi','Alimosho','Badagry'],
  Abuja:      ['Garki','Wuse','Maitama','Asokoro','Gwagwalada','Kuje'],
  Kano:       ['Kano Municipal','Fagge','Dala','Gwale','Nassarawa','Ungogo'],
  Rivers:     ['Port Harcourt','Obio-Akpor','Eleme','Ikwerre','Etche'],
  Oyo:        ['Ibadan North','Ibadan South','Ogbomosho','Oyo East','Ido'],
  Kaduna:     ['Kaduna North','Kaduna South','Zaria','Kafanchan','Kaura'],
  Delta:      ['Warri','Uvwie','Oshimili North','Oshimili South','Ethiope East'],
  Anambra:    ['Onitsha','Awka','Nnewi','Ogidi','Ihiala'],
  Enugu:      ['Enugu North','Enugu South','Agwu','Nkanu East','Isi-Uzo'],
  Imo:        ['Owerri North','Owerri West','Orlu','Okigwe','Mbaise'],
  Ogun:       ['Abeokuta North','Sagamu','Ijebu Ode','Ota','Remo North'],
  Edo:        ['Benin City','Egor','Ikpoba-Okha','Orhionmwon','Etsako West'],
  Borno:      ['Maiduguri','Jere','Konduga','Biu','Askira-Uba'],
  Bauchi:     ['Bauchi','Toro','Katagum','Ganjuwa','Ningi'],
  Katsina:    ['Katsina','Daura','Funtua','Dutsin-Ma','Mashi'],
  Ondo:       ['Akure','Ondo','Ile-Oluji','Okitipupa','Owo'],
  Osun:       ['Osogbo','Ile-Ife','Ilesa','Ede','Iwo'],
  Ekiti:      ['Ado-Ekiti','Ikere','Oye','Ijero','Efon'],
  'Cross River':['Calabar','Ikom','Ogoja','Obudu','Akamkpa'],
  'Akwa Ibom':['Uyo','Eket','Ikot Ekpene','Itu','Oron'],
  Plateau:    ['Jos North','Jos South','Barkin Ladi','Mangu','Shendam'],
  Sokoto:     ['Sokoto North','Sokoto South','Wamako','Kware','Dange-Shuni'],
  Kwara:      ['Ilorin West','Ilorin East','Offa','Kwara Central','Oke-Ero'],
  Niger:      ['Minna','Suleja','Bida','Kontagora','Mokwa'],
  Benue:      ['Makurdi','Gboko','Otukpo','Katsina-Ala','Vandeikya'],
};

const CONDITIONS = ['new','like_new','good','fair','poor'];
const LISTING_TYPES = ['goods','services','both'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function roundTo500(n) { return Math.round(n / 500) * 500; }

// ─── Item templates per category ─────────────────────────────────────────────
const ITEMS = {
  electronics: [
    { title:'Samsung Galaxy A54',       wants:'iPhone or Tecno Camon',       wantsCat:'electronics', minV:80000,  maxV:180000 },
    { title:'iPhone 11 (64GB)',          wants:'Android Flagship Phone',       wantsCat:'electronics', minV:100000, maxV:220000 },
    { title:'Tecno Spark 10 Pro',        wants:'Laptop or Tablet',             wantsCat:'electronics', minV:60000,  maxV:130000 },
    { title:'HP EliteBook 840 Laptop',   wants:'MacBook Air or Pro',           wantsCat:'electronics', minV:180000, maxV:400000 },
    { title:'MacBook Air M1',            wants:'Gaming Laptop',                wantsCat:'electronics', minV:350000, maxV:600000 },
    { title:'Dell Inspiron 15 Laptop',   wants:'Office Chair or Desk',         wantsCat:'furniture',   minV:150000, maxV:300000 },
    { title:'iPad 9th Generation',       wants:'Android Tablet or Laptop',     wantsCat:'electronics', minV:130000, maxV:280000 },
    { title:'Samsung 43" Smart TV',      wants:'Sound System or Projector',    wantsCat:'electronics', minV:150000, maxV:350000 },
    { title:'LG 32" LED Monitor',        wants:'Gaming Monitor',               wantsCat:'electronics', minV:70000,  maxV:160000 },
    { title:'Sony PlayStation 4',        wants:'Xbox One or Nintendo Switch',  wantsCat:'electronics', minV:80000,  maxV:200000 },
    { title:'Xbox One S',                wants:'PS4 or PS5',                   wantsCat:'electronics', minV:90000,  maxV:200000 },
    { title:'Nintendo Switch',           wants:'PS4 or Xbox',                  wantsCat:'electronics', minV:120000, maxV:250000 },
    { title:'Sony WH-1000XM4 Headphones',wants:'JBL Speaker or Earbuds',      wantsCat:'electronics', minV:60000,  maxV:150000 },
    { title:'JBL Charge 5 Speaker',      wants:'Headphones or Earbuds',        wantsCat:'electronics', minV:35000,  maxV:90000  },
    { title:'Canon EOS M50 Camera',      wants:'Sony Alpha or Nikon Camera',   wantsCat:'electronics', minV:150000, maxV:300000 },
    { title:'Nikon D3500 DSLR',          wants:'Drone or Gimbal',              wantsCat:'electronics', minV:130000, maxV:280000 },
    { title:'DJI Mini 2 Drone',          wants:'Camera or GoPro',              wantsCat:'electronics', minV:200000, maxV:400000 },
    { title:'GoPro Hero 9',              wants:'Gimbal or Camera Lens',        wantsCat:'electronics', minV:80000,  maxV:180000 },
    { title:'Apple Watch Series 6',      wants:'Samsung Galaxy Watch',         wantsCat:'electronics', minV:70000,  maxV:180000 },
    { title:'Samsung Galaxy Watch 4',    wants:'Apple Watch or Smartwatch',    wantsCat:'electronics', minV:50000,  maxV:130000 },
    { title:'Xiaomi Mi 11',              wants:'Samsung or iPhone',            wantsCat:'electronics', minV:90000,  maxV:200000 },
    { title:'Infinix Note 12',           wants:'Laptop or Smart TV',           wantsCat:'electronics', minV:50000,  maxV:120000 },
    { title:'itel A58 Smartphone',       wants:'Better Android Phone',         wantsCat:'electronics', minV:20000,  maxV:60000  },
    { title:'Lenovo ThinkPad X1',        wants:'MacBook or Dell XPS',          wantsCat:'electronics', minV:250000, maxV:500000 },
    { title:'Asus ROG Gaming Laptop',    wants:'PS5 or Xbox Series X',         wantsCat:'electronics', minV:300000, maxV:600000 },
    { title:'Portable Power Station',   wants:'Solar Panel or Inverter',      wantsCat:'electronics', minV:80000,  maxV:200000 },
    { title:'Inverter 2.5KVA',          wants:'Generator or Solar Panels',    wantsCat:'electronics', minV:120000, maxV:280000 },
    { title:'Standing Fan (Binatone)',   wants:'Air Conditioner or Cooler',    wantsCat:'electronics', minV:15000,  maxV:40000  },
    { title:'Washing Machine (Top Load)',wants:'Refrigerator or Freezer',      wantsCat:'electronics', minV:80000,  maxV:200000 },
    { title:'Bluetooth Keyboard & Mouse',wants:'Monitor or Laptop Stand',      wantsCat:'electronics', minV:10000,  maxV:35000  },
  ],
  fashion: [
    { title:'Ankara Print Dress (Size M)',        wants:'Shoes or Bag',              wantsCat:'fashion',   minV:8000,  maxV:25000 },
    { title:'Leather Oxford Shoes (Size 43)',     wants:'Sneakers or Loafers',       wantsCat:'fashion',   minV:12000, maxV:35000 },
    { title:'Nike Air Force 1 (Size 42)',         wants:'Adidas Yeezy or Jordan',    wantsCat:'fashion',   minV:25000, maxV:70000 },
    { title:'Adidas Originals Track Suit',        wants:'Nike Hoodie or Joggers',    wantsCat:'fashion',   minV:15000, maxV:45000 },
    { title:'Designer Wristwatch (Casio)',        wants:'Smartwatch or Sunglasses',  wantsCat:'fashion',   minV:8000,  maxV:25000 },
    { title:'Ray-Ban Sunglasses',                 wants:'Designer Watch',             wantsCat:'fashion',   minV:15000, maxV:40000 },
    { title:'Gucci Belt (Authentic)',             wants:'Louis Vuitton Wallet',       wantsCat:'fashion',   minV:30000, maxV:80000 },
    { title:'Handmade Ankara Bag',                wants:'Leather Bag or Purse',       wantsCat:'fashion',   minV:5000,  maxV:18000 },
    { title:'Men\'s Suit (Slim Fit, Size L)',     wants:'Native Wear or Kaftan',      wantsCat:'fashion',   minV:20000, maxV:60000 },
    { title:'Agbada (Senator Style)',             wants:'Men\'s Suit or Ankara Set',  wantsCat:'fashion',   minV:15000, maxV:45000 },
    { title:'Women\'s Heels (Size 38)',           wants:'Flat Sandals or Sneakers',   wantsCat:'fashion',   minV:6000,  maxV:20000 },
    { title:'Vintage Denim Jacket',               wants:'Leather Jacket or Hoodie',   wantsCat:'fashion',   minV:8000,  maxV:25000 },
    { title:'Men\'s Leather Wallet',              wants:'Belt or Watch',              wantsCat:'fashion',   minV:3000,  maxV:12000 },
    { title:'Children\'s School Uniforms (Set)', wants:'School Bags or Shoes',        wantsCat:'fashion',   minV:4000,  maxV:15000 },
    { title:'Gym Bag (Adidas)',                   wants:'Backpack or Duffel Bag',     wantsCat:'fashion',   minV:5000,  maxV:18000 },
    { title:'Batik Fabric (5 yards)',             wants:'Lace or Sequin Fabric',      wantsCat:'fashion',   minV:6000,  maxV:20000 },
    { title:'Aso-oke Fabric Bundle',              wants:'George Wrapper or Lace',     wantsCat:'fashion',   minV:10000, maxV:35000 },
    { title:'Versace Pour Homme Perfume',         wants:'Creed or Dior Cologne',      wantsCat:'fashion',   minV:12000, maxV:40000 },
    { title:'Sneaker Collection (5 pairs)',       wants:'Laptop Bag or Briefcase',    wantsCat:'fashion',   minV:40000, maxV:100000},
    { title:'Traditional Beaded Necklace',        wants:'Gold Earrings or Bracelet',  wantsCat:'fashion',   minV:5000,  maxV:20000 },
  ],
  furniture: [
    { title:'3-Seater Fabric Sofa',              wants:'Dining Table & Chairs',      wantsCat:'furniture', minV:50000, maxV:150000 },
    { title:'6-Seater Dining Table Set',         wants:'Sofa or TV Stand',           wantsCat:'furniture', minV:80000, maxV:200000 },
    { title:'Queen Size Bed Frame',              wants:'Wardrobe or Chest of Drawers',wantsCat:'furniture',minV:40000, maxV:120000 },
    { title:'King Size Mattress (Mouka Foam)',   wants:'Bed Frame or Bunk Bed',      wantsCat:'furniture', minV:60000, maxV:160000 },
    { title:'4-Door Wardrobe',                   wants:'Dressing Mirror or Cabinet', wantsCat:'furniture', minV:50000, maxV:130000 },
    { title:'Ergonomic Office Chair',            wants:'Standing Desk or Bookshelf', wantsCat:'furniture', minV:25000, maxV:80000  },
    { title:'Executive Office Desk',             wants:'Office Chair or Filing Cabinet',wantsCat:'furniture',minV:40000,maxV:120000 },
    { title:'Glass Coffee Table',                wants:'TV Console or Sideboard',    wantsCat:'furniture', minV:15000, maxV:50000  },
    { title:'Bunk Bed (Children)',               wants:'Single Bed or Mattress',     wantsCat:'furniture', minV:30000, maxV:80000  },
    { title:'Bookshelf (5-Tier)',                wants:'Filing Cabinet or Desk',     wantsCat:'furniture', minV:12000, maxV:35000  },
    { title:'Kitchen Cabinet Set',               wants:'Microwave or Gas Cooker',    wantsCat:'electronics',minV:60000,maxV:160000 },
    { title:'Bar Stool (Set of 4)',              wants:'Dining Chairs or Folding Chairs',wantsCat:'furniture',minV:15000,maxV:50000},
    { title:'Rocking Chair',                     wants:'Garden Chair or Hammock',    wantsCat:'furniture', minV:10000, maxV:30000  },
    { title:'Corner Shelf Unit',                 wants:'Display Cabinet or Bookcase',wantsCat:'furniture', minV:8000,  maxV:25000  },
    { title:'Foam Mattress 4"',                  wants:'Mouka or Vitafoam Mattress', wantsCat:'furniture', minV:20000, maxV:60000  },
    { title:'Plastic Garden Chairs (6)',         wants:'Plastic Table or Hammock',   wantsCat:'furniture', minV:8000,  maxV:25000  },
    { title:'TV Stand with Storage',             wants:'Coffee Table or Wall Shelf', wantsCat:'furniture', minV:12000, maxV:35000  },
    { title:'Study Desk with Chair',             wants:'Bookshelf or Lamp',          wantsCat:'furniture', minV:15000, maxV:45000  },
    { title:'Baby Cot with Mattress',            wants:'High Chair or Stroller',     wantsCat:'others',    minV:15000, maxV:45000  },
    { title:'Shoe Rack (10-Tier)',               wants:'Wardrobe Organiser or Hangers',wantsCat:'furniture',minV:5000, maxV:18000  },
  ],
  books: [
    { title:'JAMB CBT Practice Questions (2024)',wants:'WAEC Past Questions',        wantsCat:'books',  minV:2000, maxV:8000  },
    { title:'WAEC Syllabus & Past Questions',    wants:'JAMB CBT Books',             wantsCat:'books',  minV:2500, maxV:9000  },
    { title:'Medical Biochemistry Textbook',     wants:'Anatomy or Physiology Book', wantsCat:'books',  minV:8000, maxV:25000 },
    { title:'Engineering Mathematics Stroud',    wants:'Physics or Chemistry Text',  wantsCat:'books',  minV:6000, maxV:20000 },
    { title:'Business Law Textbook (Nigerian)',  wants:'Accounting or Economics Book',wantsCat:'books',  minV:5000, maxV:18000 },
    { title:'Chinua Achebe "Things Fall Apart"', wants:'Wole Soyinka or Ngugi Novel',wantsCat:'books',  minV:1500, maxV:5000  },
    { title:'Rich Dad Poor Dad',                 wants:'48 Laws of Power or Think & Grow Rich',wantsCat:'books',minV:2000,maxV:6000},
    { title:'Atomic Habits by James Clear',      wants:'Self-Help or Business Book', wantsCat:'books',  minV:2500, maxV:8000  },
    { title:'Nigerian Law School Bar Finals Pack',wants:'SAN Legal Journals or Cases',wantsCat:'books', minV:20000,maxV:60000 },
    { title:'ICAN Study Pack (Full Set)',        wants:'ACCA Study Materials',       wantsCat:'books',  minV:25000,maxV:70000 },
    { title:'Python for Beginners',              wants:'JavaScript or Data Science Book',wantsCat:'books',minV:3000,maxV:10000},
    { title:'Introduction to Algorithms (CLRS)',wants:'System Design or DevOps Book',wantsCat:'books',  minV:8000, maxV:25000 },
    { title:'Oxford English Dictionary',         wants:'Thesaurus or Grammar Book',  wantsCat:'books',  minV:4000, maxV:15000 },
    { title:'GMAT Official Guide',               wants:'GRE or IELTS Materials',     wantsCat:'books',  minV:6000, maxV:20000 },
    { title:'Bible (NIV Study Bible)',           wants:'Quran or Devotional Books',  wantsCat:'books',  minV:3000, maxV:10000 },
    { title:'Children\'s Encyclopedia Set',     wants:'Story Books or Activity Books',wantsCat:'books', minV:5000, maxV:18000 },
    { title:'Graphic Novel Collection (10)',    wants:'Comic Books or Manga',        wantsCat:'books',  minV:8000, maxV:25000 },
    { title:'Cooking Recipe Book Nigerian',     wants:'Baking or Cocktail Book',     wantsCat:'books',  minV:2000, maxV:7000  },
    { title:'Nursing Fundamentals Textbook',    wants:'Pharmacology or Anatomy Text',wantsCat:'books',  minV:7000, maxV:22000 },
    { title:'CCNA Study Guide',                 wants:'AWS or CompTIA Study Guide',  wantsCat:'books',  minV:5000, maxV:18000 },
  ],
  sports: [
    { title:'Treadmill (Motorised)',             wants:'Exercise Bike or Rowing Machine',wantsCat:'sports',minV:80000,maxV:200000},
    { title:'Exercise Bike (Spin)',              wants:'Treadmill or Elliptical',     wantsCat:'sports',  minV:40000,maxV:120000 },
    { title:'Barbell Set with Weights',          wants:'Dumbbell Set or Bench',       wantsCat:'sports',  minV:25000,maxV:70000  },
    { title:'Adjustable Dumbbell Set',           wants:'Kettlebell or Resistance Bands',wantsCat:'sports',minV:15000,maxV:45000 },
    { title:'Football (Nike Premier League)',    wants:'Gloves or Shin Guards',       wantsCat:'sports',  minV:5000, maxV:15000  },
    { title:'Basketball (Spalding)',             wants:'Football or Tennis Racket',   wantsCat:'sports',  minV:4000, maxV:12000  },
    { title:'Tennis Racket (Wilson)',            wants:'Badminton Set or Squash Racket',wantsCat:'sports',minV:6000, maxV:20000  },
    { title:'Badminton Set (2 Rackets + Net)',   wants:'Tennis or Table Tennis Set',  wantsCat:'sports',  minV:5000, maxV:15000  },
    { title:'Table Tennis Board',               wants:'Football Table or Air Hockey', wantsCat:'sports', minV:20000,maxV:60000  },
    { title:'Swimming Goggles & Cap Set',        wants:'Life Jacket or Fins',         wantsCat:'sports',  minV:3000, maxV:10000  },
    { title:'Yoga Mat & Blocks',                 wants:'Resistance Bands or Jump Rope',wantsCat:'sports', minV:4000, maxV:12000  },
    { title:'Boxing Gloves (Everlast)',          wants:'Punching Bag or Skip Rope',   wantsCat:'sports',  minV:8000, maxV:25000  },
    { title:'Cycling Helmet & Gloves',           wants:'Bicycle Lights or Lock',      wantsCat:'sports',  minV:5000, maxV:15000  },
    { title:'Mountain Bike (26 inch)',           wants:'Road Bike or Electric Scooter',wantsCat:'vehicles',minV:50000,maxV:150000},
    { title:'Inline Roller Skates (Size 41)',    wants:'Skateboard or Scooter',       wantsCat:'sports',  minV:8000, maxV:25000  },
    { title:'Golf Set (7 Clubs)',                wants:'Fishing Gear or Cricket Set', wantsCat:'sports',  minV:30000,maxV:90000  },
    { title:'Fishing Rod & Reel Combo',          wants:'Tackle Box or Life Vest',     wantsCat:'sports',  minV:6000, maxV:20000  },
    { title:'Running Shoes (Nike, Size 43)',     wants:'Adidas or New Balance Shoes', wantsCat:'fashion', minV:15000,maxV:45000  },
    { title:'Football Boots (Adidas Copa)',      wants:'Football or Training Cones',  wantsCat:'sports',  minV:10000,maxV:30000  },
    { title:'Pull-up Bar (Door Frame)',          wants:'Dips Bars or Ab Roller',      wantsCat:'sports',  minV:5000, maxV:15000  },
  ],
  food: [
    { title:'Bag of Ofada Rice (50kg)',          wants:'Beans or Garri',              wantsCat:'food',    minV:30000,maxV:70000  },
    { title:'Bag of Garri (50kg)',               wants:'Rice or Semovita',            wantsCat:'food',    minV:20000,maxV:50000  },
    { title:'Palm Oil (25 litres)',              wants:'Groundnut Oil or Soya Oil',   wantsCat:'food',    minV:25000,maxV:60000  },
    { title:'Groundnut Oil (20 litres)',         wants:'Palm Oil or Coconut Oil',     wantsCat:'food',    minV:20000,maxV:55000  },
    { title:'Dried Fish Assorted (10kg)',        wants:'Stockfish or Ponmo',          wantsCat:'food',    minV:15000,maxV:45000  },
    { title:'Smoked Catfish (5kg)',              wants:'Dried Shrimp or Periwinkle',  wantsCat:'food',    minV:8000, maxV:25000  },
    { title:'Crayfish (2kg)',                    wants:'Pepper or Tomato Paste',      wantsCat:'food',    minV:5000, maxV:15000  },
    { title:'Ogiri / Dawadawa (Bulk)',           wants:'Uziza or Utazi Leaves',       wantsCat:'food',    minV:3000, maxV:10000  },
    { title:'Fresh Tomatoes (Basket)',           wants:'Pepper or Onions',            wantsCat:'food',    minV:8000, maxV:20000  },
    { title:'Honey (Raw, 5 litres)',             wants:'Coconut Oil or Zobo Leaves',  wantsCat:'food',    minV:10000,maxV:30000  },
    { title:'Groundnuts (Raw, 10kg)',            wants:'Cashew Nuts or Tiger Nuts',   wantsCat:'food',    minV:5000, maxV:15000  },
    { title:'Plantain Chips (Bulk, 10kg)',       wants:'Popcorn or Kuli-Kuli',        wantsCat:'food',    minV:8000, maxV:20000  },
    { title:'Farm Fresh Eggs (10 Crates)',       wants:'Fresh Fish or Vegetables',    wantsCat:'food',    minV:15000,maxV:35000  },
    { title:'Zobo Leaves (Dried, 2kg)',          wants:'Ginger or Cloves',            wantsCat:'food',    minV:2000, maxV:8000   },
    { title:'Locust Beans (Iru, 1kg)',           wants:'Fermented Fish or Dawadawa',  wantsCat:'food',    minV:2000, maxV:7000   },
    { title:'Turmeric Powder (1kg)',             wants:'Curry or Thyme Spices',       wantsCat:'food',    minV:2500, maxV:8000   },
    { title:'Shea Butter (Raw, 5kg)',            wants:'Coconut Oil or Black Soap',   wantsCat:'food',    minV:6000, maxV:18000  },
    { title:'Tiger Nuts (Fresh, 5kg)',           wants:'Dates or Groundnuts',         wantsCat:'food',    minV:4000, maxV:12000  },
    { title:'Dried Pepper (Tatashe, 3kg)',       wants:'Cameroon Pepper or Scotch Bonnet',wantsCat:'food',minV:3000,maxV:10000  },
    { title:'Melon/Egusi (Shelled, 2kg)',        wants:'Ogbono or Afang Leaves',      wantsCat:'food',    minV:5000, maxV:15000  },
  ],
  services: [
    { title:'Full-Stack Web Development',        wants:'UI/UX Design or SEO Services',wantsCat:'services',minV:80000, maxV:300000 },
    { title:'Mobile App Development (React Native)',wants:'Backend Dev or Cloud Setup',wantsCat:'services',minV:100000,maxV:400000},
    { title:'Graphic Design & Branding',         wants:'Photography or Video Editing',wantsCat:'services',minV:20000, maxV:80000  },
    { title:'Professional Photography',          wants:'Videography or Drone Footage',wantsCat:'services',minV:30000, maxV:100000 },
    { title:'Videography & Video Editing',       wants:'Photography or Animation',    wantsCat:'services',minV:40000, maxV:150000 },
    { title:'2D/3D Animation',                   wants:'Voice-Over or Sound Design',  wantsCat:'services',minV:50000, maxV:180000 },
    { title:'Catering Services (Events)',        wants:'Event Decoration or DJ',      wantsCat:'services',minV:50000, maxV:200000 },
    { title:'Event Decoration',                  wants:'Catering or MC Services',     wantsCat:'services',minV:30000, maxV:120000 },
    { title:'Home Cleaning Services',            wants:'Laundry or Fumigation',       wantsCat:'services',minV:5000,  maxV:20000  },
    { title:'Tailoring & Fashion Design',        wants:'Fabric or Sewing Machine',    wantsCat:'fashion', minV:10000, maxV:50000  },
    { title:'Generator Repair',                  wants:'Electrical or Plumbing Work', wantsCat:'services',minV:5000,  maxV:25000  },
    { title:'Electrical Installation',           wants:'Plumbing or Tiling Work',     wantsCat:'services',minV:15000, maxV:60000  },
    { title:'Plumbing Services',                 wants:'Tiling or Painting',          wantsCat:'services',minV:10000, maxV:40000  },
    { title:'Painting & Décor',                  wants:'Electrical or Interior Design',wantsCat:'services',minV:15000,maxV:60000  },
    { title:'Private Tutoring (Math/Science)',   wants:'English or Computer Lessons', wantsCat:'services',minV:5000,  maxV:20000  },
    { title:'English Language Tutoring',         wants:'Math or Science Tutoring',    wantsCat:'services',minV:5000,  maxV:20000  },
    { title:'Digital Marketing (SMM)',           wants:'SEO or Content Writing',      wantsCat:'services',minV:20000, maxV:80000  },
    { title:'Copywriting & Content Writing',     wants:'Social Media or Email Marketing',wantsCat:'services',minV:10000,maxV:40000},
    { title:'Driving Lessons',                   wants:'Motorcycle Lessons or Car Hire',wantsCat:'services',minV:10000,maxV:35000 },
    { title:'Hair Styling & Braiding',           wants:'Makeup or Nail Art Services', wantsCat:'services',minV:5000,  maxV:25000  },
    { title:'Makeup Artist Services',            wants:'Hair Stylist or Body Art',    wantsCat:'services',minV:8000,  maxV:35000  },
    { title:'Auto Mechanic Services',            wants:'Electrician or Panel Beater', wantsCat:'services',minV:10000, maxV:50000  },
    { title:'AC Installation & Service',         wants:'Generator Repair or Electrical',wantsCat:'services',minV:10000,maxV:40000 },
    { title:'Security Guard Services',           wants:'CCTV Installation or Alarm',  wantsCat:'services',minV:15000, maxV:60000  },
    { title:'Yoga & Fitness Coaching',           wants:'Nutrition or Massage Therapy',wantsCat:'services',minV:8000,  maxV:30000  },
  ],
  art: [
    { title:'Portrait Painting (Custom)',        wants:'Landscape Art or Sculpture',  wantsCat:'art',     minV:15000,maxV:60000  },
    { title:'Abstract Canvas Painting',          wants:'Watercolor or Oil Painting',  wantsCat:'art',     minV:10000,maxV:45000  },
    { title:'Hand-Carved Wood Sculpture',        wants:'Bronze or Clay Sculpture',    wantsCat:'art',     minV:20000,maxV:80000  },
    { title:'Batik Fabric Art (Framed)',         wants:'Tie-Dye or Adire Art',        wantsCat:'art',     minV:8000, maxV:25000  },
    { title:'Pottery & Ceramic Set',             wants:'Glass Art or Clay Figurines', wantsCat:'art',     minV:5000, maxV:18000  },
    { title:'Handmade Jewelry Set',              wants:'Beaded Necklace or Bracelet', wantsCat:'art',     minV:4000, maxV:15000  },
    { title:'Leather Craft Wallet',              wants:'Leather Bag or Belt',         wantsCat:'fashion', minV:3000, maxV:12000  },
    { title:'Digital Art Print (A2 size)',       wants:'Photography Print or Poster', wantsCat:'art',     minV:5000, maxV:18000  },
    { title:'Charcoal Drawing (Custom)',         wants:'Pastel or Ink Drawing',       wantsCat:'art',     minV:8000, maxV:25000  },
    { title:'Woven Basket Set',                  wants:'Calabash Art or Mat Weaving', wantsCat:'art',     minV:4000, maxV:12000  },
    { title:'Embroidery Wall Art',               wants:'Crochet or Macramé Art',      wantsCat:'art',     minV:5000, maxV:18000  },
    { title:'Photography Print (Framed)',        wants:'Canvas Print or Poster Art',  wantsCat:'art',     minV:6000, maxV:20000  },
    { title:'Music Beats (10 Pack)',             wants:'Sound Design or Mixing Service',wantsCat:'services',minV:10000,maxV:40000},
    { title:'Handmade Candles Set',              wants:'Soap or Skincare Products',   wantsCat:'others',  minV:3000, maxV:10000  },
    { title:'Ankara-covered Notebook',           wants:'Stationery Set or Journal',   wantsCat:'books',   minV:1500, maxV:5000   },
  ],
  vehicles: [
    { title:'Bajaj Boxer Motorcycle (2020)',     wants:'Tricycle or Bicycle',         wantsCat:'vehicles',minV:200000,maxV:450000},
    { title:'Keke NAPEP Tricycle',               wants:'Motorcycle or Generator',     wantsCat:'vehicles',minV:500000,maxV:900000},
    { title:'Tokunbo Toyota Corolla (2009)',     wants:'Honda Accord or Hyundai',     wantsCat:'vehicles',minV:1200000,maxV:2500000},
    { title:'Honda Accord 2004 (Used)',          wants:'Toyota Camry or Corolla',     wantsCat:'vehicles',minV:900000,maxV:1800000},
    { title:'Mountain Bicycle (Used)',           wants:'Motorcycle or Electric Bike', wantsCat:'vehicles',minV:30000,maxV:80000  },
    { title:'Car Tires (4 Pieces, Size 195/65R15)',wants:'Alloy Rims or Shock Absorbers',wantsCat:'vehicles',minV:40000,maxV:90000},
    { title:'Car Stereo (Pioneer)',              wants:'Reverse Camera or Dash Cam',  wantsCat:'electronics',minV:15000,maxV:45000},
    { title:'Electric Scooter',                  wants:'Bicycle or Hoverboard',       wantsCat:'vehicles',minV:60000,maxV:160000 },
    { title:'Generator (Tiger 3.5KVA)',          wants:'Inverter or Solar Panel',     wantsCat:'electronics',minV:80000,maxV:180000},
    { title:'Canopy (10x10 ft)',                 wants:'Plastic Chairs or Tables',    wantsCat:'furniture',minV:20000,maxV:60000  },
    { title:'Aluminum Scaffolding Set',          wants:'Ladder or Power Drill',       wantsCat:'others',  minV:30000,maxV:90000  },
    { title:'Boat Engine (Outboard, 9.9HP)',     wants:'Fishing Net or Life Jackets', wantsCat:'sports',  minV:80000,maxV:200000  },
    { title:'Car Battery (12V 75Ah)',            wants:'Alternator or Jumper Cables', wantsCat:'vehicles',minV:15000,maxV:40000  },
    { title:'Dashboard Camera',                  wants:'Reverse Camera or Phone Mount',wantsCat:'electronics',minV:8000,maxV:25000},
    { title:'Tow Rope & Tool Kit',               wants:'Hydraulic Jack or Wheel Spanner',wantsCat:'vehicles',minV:5000,maxV:15000},
  ],
  others: [
    { title:'Baby Stroller (Chicco)',            wants:'High Chair or Baby Monitor',  wantsCat:'others',  minV:20000,maxV:60000  },
    { title:'Baby Monitor (VTECH)',              wants:'Baby Cot or Carrier',         wantsCat:'others',  minV:8000, maxV:25000  },
    { title:'Sewing Machine (Singer)',           wants:'Embroidery Machine or Fabric',wantsCat:'fashion', minV:20000,maxV:60000  },
    { title:'Sewing Machine (Industrial)',       wants:'Overlock Machine or Iron',    wantsCat:'fashion', minV:50000,maxV:130000 },
    { title:'Toolbox (Complete Set)',            wants:'Power Drill or Level',        wantsCat:'others',  minV:15000,maxV:45000  },
    { title:'Power Drill (DeWalt)',              wants:'Angle Grinder or Jigsaw',     wantsCat:'others',  minV:15000,maxV:45000  },
    { title:'Garden Hoe & Rake Set',             wants:'Wheelbarrow or Sprinkler',    wantsCat:'food',    minV:3000, maxV:10000  },
    { title:'Cooking Gas (12.5kg) + Cylinder',  wants:'Electric Cooker or Microwave',wantsCat:'electronics',minV:15000,maxV:40000},
    { title:'Blender & Juicer (Qasa)',           wants:'Toaster or Electric Kettle',  wantsCat:'others',  minV:8000, maxV:25000  },
    { title:'Microwave Oven (LG)',               wants:'Air Fryer or Electric Cooker',wantsCat:'others',  minV:25000,maxV:70000  },
    { title:'Gas Cooker (3 Burner)',             wants:'Oven or Microwave',           wantsCat:'others',  minV:20000,maxV:55000  },
    { title:'Rechargeable Fan (Solar)',          wants:'Solar Panel or Power Bank',   wantsCat:'electronics',minV:8000,maxV:25000 },
    { title:'Water Dispenser (Hot & Cold)',      wants:'Fridge or Microwave',         wantsCat:'others',  minV:15000,maxV:45000  },
    { title:'Office Printer (HP LaserJet)',      wants:'Scanner or Photocopier',      wantsCat:'electronics',minV:25000,maxV:80000},
    { title:'Potted Plants (Indoor, 5 pcs)',     wants:'Garden Soil or Fertilizer',   wantsCat:'food',    minV:5000, maxV:15000  },
    { title:'Aquarium (3 feet with fish)',       wants:'Bird Cage or Pet Supplies',   wantsCat:'others',  minV:15000,maxV:45000  },
    { title:'Pet Dog (German Shepherd pup)',     wants:'Cat or Other Pet',            wantsCat:'others',  minV:20000,maxV:80000  },
    { title:'Pop-up Tent (2-person)',            wants:'Sleeping Bag or Camping Stove',wantsCat:'others', minV:10000,maxV:30000  },
    { title:'Wedding Dress (Size 10)',           wants:'Bridesmaids Dresses or Veil', wantsCat:'fashion', minV:30000,maxV:90000  },
    { title:'DSTV Decoder & Dish (Installed)',   wants:'Startimes or GoTV Setup',     wantsCat:'electronics',minV:15000,maxV:40000},
    { title:'Padlock Set (Yale)',                wants:'CCTV Camera or Alarm System', wantsCat:'others',  minV:3000, maxV:10000  },
    { title:'Fire Extinguisher (9kg)',           wants:'Smoke Detector or First Aid Kit',wantsCat:'others',minV:8000,maxV:25000  },
    { title:'Typewriter (Vintage)',              wants:'Calculator or Stationery',    wantsCat:'others',  minV:5000, maxV:18000  },
    { title:'Mosquito Net (King size)',          wants:'Insect Repellent or Air Freshener',wantsCat:'others',minV:3000,maxV:10000},
    { title:'Grinding Machine (Table-Top)',      wants:'Blender or Food Processor',   wantsCat:'others',  minV:15000,maxV:45000  },
  ],
};

const DESCS = {
  electronics: [
    'In great working condition. Comes with original accessories and box.',
    'Used for one year, well maintained. Minor cosmetic wear.',
    'Fully functional. Moving abroad, need to sell/swap quickly.',
    'Bought last year, barely used. Excellent condition overall.',
    'Works perfectly. Small dent on the back, does not affect function.',
  ],
  fashion: [
    'Worn twice, still in excellent shape. Dry-cleaned and stored properly.',
    'Brand new, never worn. Too big after weight loss.',
    'Authentic item. Have receipt available on request.',
    'Good condition. Small mark on inner lining, not visible when worn.',
    'Bought in Dubai. High quality material. Letting go due to style change.',
  ],
  furniture: [
    'Solid wood construction. Moving house, cannot carry it along.',
    'Used for 8 months. Still sturdy and comfortable.',
    'Good condition with minor scratches. Fully functional.',
    'Custom made. Letting go because we redecorated.',
    'Very clean. From smoke-free, pet-free home.',
  ],
  books: [
    'Excellent condition, no missing pages or markings.',
    'Highlighted but clean. Very useful study material.',
    'Almost new. Only read twice.',
    'Full set with answers included. Great for exam prep.',
    'Latest edition. All diagrams intact.',
  ],
  sports: [
    'Used a few times. Kept clean and in original bag.',
    'Good condition. Fully functional.',
    'Barely used. Bought but lifestyle changed.',
    'Works perfectly. Just upgrading.',
    'Clean and well maintained. No tears or damage.',
  ],
  food: [
    'Freshly harvested/processed. Packed and ready.',
    'High quality. Sourced directly from farm.',
    'Well dried and stored. No contamination.',
    'Bulk quantity available. Price is negotiable.',
    'Organic, no chemicals. Family farm product.',
  ],
  services: [
    'I offer professional services with proven track record. Portfolio available.',
    '3+ years experience. Over 50 clients served. Very reliable.',
    'Certified professional. Can provide references.',
    'Work remotely or on-site. Fast turnaround time.',
    'Passionate and skilled. Willing to do a test task.',
  ],
  art: [
    'Handcrafted with quality materials. One-of-a-kind piece.',
    'Original artwork. Signed and dated.',
    'Made from locally sourced materials. Unique design.',
    'Can create custom orders. Sample shown in photos.',
    'Ready to hang or display. Properly framed.',
  ],
  vehicles: [
    'Working condition. Papers available. Needs minor servicing.',
    'Well maintained. Serviced 2 months ago. Good condition.',
    'Bought from original owner. Clean documents.',
    'Used for personal trips only. Low mileage.',
    'Functional and roadworthy. Minor bodywork needed.',
  ],
  others: [
    'Barely used. In original packaging.',
    'Good working condition. Selling due to upgrade.',
    'Comes with all accessories. Clean and functional.',
    'From a clean home. No damage.',
    'Well maintained. Ready to use immediately.',
  ],
};

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected!');

  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Listing.deleteMany({}),
    OtpCode.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  const categories = await Category.insertMany(CATEGORIES);
  console.log(`Created ${categories.length} categories`);

  const catMap = {};
  categories.forEach(c => { catMap[c.slug] = c._id; });

  const users = await User.insertMany(TEST_USERS);
  console.log(`Created ${users.length} users`);

  // Build 1000 listings
  const listings = [];
  const slugs = Object.keys(ITEMS);
  let count = 0;
  const target = 1000;

  while (count < target) {
    for (const slug of slugs) {
      if (count >= target) break;
      const pool = ITEMS[slug];
      const template = pick(pool);
      const state = pick(NIGERIAN_STATES);
      const lgas = LGAS[state] || ['Central'];
      const user = pick(users);
      const condition = slug === 'services' ? undefined : pick(CONDITIONS);
      const listingType = slug === 'services' ? 'services' : slug === 'food' ? 'goods' : pick(LISTING_TYPES);
      const descs = DESCS[slug] || DESCS.others;
      const baseValue = roundTo500(rand(template.minV, template.maxV));
      const wantsCatId = catMap[template.wantsCat] || catMap.others;
      const isBoosted = Math.random() < 0.08;

      // Swap eligibility threshold — higher-value items are more likely to require it
      // Electronics/vehicles/furniture above ₦100k: 50% chance; ₦50k–₦100k: 30%; below: 10%
      const HIGH_VALUE_SLUGS = ['electronics', 'vehicles', 'furniture', 'services'];
      const restrictionChance = baseValue >= 100000
        ? (HIGH_VALUE_SLUGS.includes(slug) ? 0.55 : 0.35)
        : baseValue >= 50000
          ? 0.25
          : 0.08;
      // Threshold is 50–80% of the item's own value, rounded to nearest ₦500
      const minSwapValue = Math.random() < restrictionChance
        ? roundTo500(Math.round(baseValue * pick([0.5, 0.6, 0.7, 0.8])))
        : 0;

      const listing = {
        userId: user._id,
        title: template.title,
        description: `${pick(descs)} ${template.title} available for swap in ${state}.`,
        categoryId: catMap[slug] || catMap.others,
        listingType,
        estimatedValue: baseValue,
        minSwapValue,
        images: [],
        wantsTitle: template.wants,
        wantsDescription: `Looking to swap my ${template.title} for ${template.wants}. Open to negotiation.`,
        wantsCategoryId: wantsCatId,
        wantsValueMin: roundTo500(Math.round(baseValue * 0.7)),
        wantsValueMax: roundTo500(Math.round(baseValue * 1.4)),
        locationState: state,
        locationLga: pick(lgas),
        status: 'active',
        isBoosted,
        viewCount: rand(0, 350),
      };

      if (condition) listing.condition = condition;

      listings.push(listing);
      count++;
    }
  }

  const inserted = await Listing.insertMany(listings);
  console.log(`Created ${inserted.length} listings`);

  // Pre-seed OTPs
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await OtpCode.insertMany(
    TEST_USERS.map(u => ({ phone: u.phone, code: '123456', expiresAt, used: false }))
  );
  console.log('Pre-seeded OTP 123456 for all test users');

  console.log('\nTest users:');
  TEST_USERS.forEach(u => console.log(`  ${u.fullName}: ${u.phone} (OTP: 123456)${u._id ? ' [fixed _id]' : ''}`));

  await mongoose.disconnect();
  console.log('\nSeed complete!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
