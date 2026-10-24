require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const LabourType = require('../models/LabourType');
const Material = require('../models/Material');
const ContractType = require('../models/ContractType');
const WebsiteContent = require('../models/WebsiteContent');
const SqftPricing = require('../models/SqftPricing');
const Terms = require('../models/Terms');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // ---- Superadmin ----
    const existingSuperadmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperadmin) {
      console.log('Superadmin already exists. Skipping superadmin creation.');
    } else {
      const email = process.env.SUPERADMIN_INIT_EMAIL;
      const password = process.env.SUPERADMIN_INIT_PASSWORD;
      if (!email || !password) {
        console.error('SUPERADMIN_INIT_EMAIL and SUPERADMIN_INIT_PASSWORD must be set in .env');
        process.exit(1);
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await User.create({
        name: 'Superadmin',
        email: email.toLowerCase(),
        passwordHash,
        role: 'superadmin',
      });
      console.log(`Superadmin created: ${email}`);
    }

    // ---- Default Website Content ----
    const sections = [
      { section: 'companyInformation', data: {
        nameEn: 'Balu Hari Builders',
        nameTa: 'பாலு ஹரி பில்டர்ஸ்',
        address: '123 Main Street, Chennai, Tamil Nadu',
        phone: '+91 98765 43210',
        email: 'info@baluhari.com',
        mapUrl: 'https://maps.google.com',
      }},
      { section: 'hero', data: {
        headingEn: 'Building Your Dreams, One Brick at a Time',
        headingTa: 'உங்கள் கனவுகளை கட்டியெழுப்புகிறோம்',
        descriptionEn: 'Quality construction services you can trust. Over 15 years of excellence.',
        descriptionTa: '15 ஆண்டுகளுக்கும் மேலான திறமை மற்றும் தரமான கட்டுமான சேவைகள்.',
        ctaText: 'Get a Free Quote',
        ctaTextTa: 'இலவச மதிப்பீடு பெறுங்கள்',
        image: '',
      }},
      { section: 'about', data: {
        headingEn: 'About Us',
        headingTa: 'எங்களை பற்றி',
        descriptionEn: 'Balu Hari Builders has been delivering quality construction for over 15 years.',
        descriptionTa: 'பாலு ஹரி பில்டர்ஸ் 15 ஆண்டுகளுக்கும் மேலாக தரமான கட்டுமான சேவைகளை வழங்கி வருகிறது.',
      }},
      { section: 'founder', data: {
        nameEn: 'Balu Kumar',
        nameTa: 'பாலு குமார்',
        roleEn: 'Founder & Director',
        roleTa: 'நிறுவனர் & இயக்குனர்',
        bioEn: 'Founder with 20+ years of construction expertise.',
        bioTa: '20+ ஆண்டுகள் கட்டுமான அனுபவம் கொண்ட நிறுவனர்.',
        photo: '',
      }},
      { section: 'coFounder', data: {
        nameEn: 'Hari Shankar',
        nameTa: 'ஹரி சங்கர்',
        roleEn: 'Co-Founder & Operations',
        roleTa: 'இணை நிறுவனர் & செயல்பாடுகள்',
        bioEn: 'Co-founder managing operations and client relations.',
        bioTa: 'செயல்பாடுகள் மற்றும் வாடிக்கையாளர் உறவுகளை நிர்வகிக்கும் இணை நிறுவனர்.',
        photo: '',
      }},
      { section: 'trackRecord', data: {
        stats: [
          { valueEn: '20+', valueTa: '20+', labelEn: 'Projects Completed', labelTa: 'திட்டங்கள் நிறைவு' },
          { valueEn: '15+', valueTa: '15+', labelEn: 'Years in Service', labelTa: 'சேவை ஆண்டுகள்' },
          { valueEn: '500+', valueTa: '500+', labelEn: 'Happy Clients', labelTa: 'மகிழ்ச்சியான வாடிக்கையாளர்கள்' },
          { valueEn: '₹50Cr+', valueTa: '₹50Cr+', labelEn: 'Projects Value', labelTa: 'திட்ட மதிப்பு' },
        ],
      }},
      { section: 'contact', data: {
        address: '123 Main Street, Chennai, Tamil Nadu 600001',
        phone: '+91 98765 43210',
        email: 'info@baluhari.com',
        mapUrl: 'https://maps.google.com/?q=Chennai,Tamil+Nadu',
      }},
    ];

    for (const s of sections) {
      await WebsiteContent.findOneAndUpdate(
        { section: s.section },
        { $setOnInsert: { data: s.data } },
        { upsert: true }
      );
    }
    console.log('Website content defaults ensured.');

    // ---- Default Sqft Pricing ----
    const sqftExists = await SqftPricing.findOne({});
    if (!sqftExists) {
      await SqftPricing.create({ label: 'Standard Construction', ratePerSqft: 2200, active: true });
      console.log('Default sqft pricing created: ₹2,200/sqft');
    }

    // ---- Default Terms ----
    const termsExists = await Terms.findOne({});
    if (!termsExists) {
      await Terms.create({
        textEn: '1. This quotation is valid for 30 days from the date of issue.\n2. 50% advance payment required before commencement of work.\n3. Balance to be paid on completion.\n4. Any changes in design may affect the quoted price.\n5. Government taxes applicable as per norms.',
        textTa: '1. இந்த மதிப்பீடு வெளியீட்டு தேதியிலிருந்து 30 நாட்களுக்கு செல்லுபடியாகும்.\n2. பணி தொடங்குவதற்கு முன் 50% முன்பணம் தேவை.\n3. நிறைவில் மீதி தொகை செலுத்தப்படும்.\n4. வடிவமைப்பில் மாற்றங்கள் மதிப்பீட்டு விலையை பாதிக்கலாம்.\n5. அரசு வரிகள் விதிமுறைகளின்படி பொருந்தும்.',
      });
      console.log('Default terms created.');
    }

    // ---- Sample Labour Types ----
    const labourTypes = [
      { name: 'Engineer', ratePerDay: 1500 },
      { name: 'Electrician', ratePerDay: 800 },
      { name: 'Plumber', ratePerDay: 700 },
      { name: 'Mason', ratePerDay: 600 },
      { name: 'Helper', ratePerDay: 400 },
      { name: 'Carpenter', ratePerDay: 750 },
      { name: 'Painter', ratePerDay: 650 },
    ];
    for (const lt of labourTypes) {
      await LabourType.findOneAndUpdate(
        { name: lt.name },
        { $setOnInsert: lt },
        { upsert: true }
      );
    }
    console.log('Labour types ensured.');

    // ---- Sample Materials ----
    const materials = [
      { name: 'Sand', units: [{ unitName: 'per kg', ratePerUnit: 2 }, { unitName: 'per load', ratePerUnit: 3500 }, { unitName: 'per truck', ratePerUnit: 8000 }] },
      { name: 'Cement', units: [{ unitName: 'per bag (50kg)', ratePerUnit: 380 }, { unitName: 'per ton', ratePerUnit: 7200 }] },
      { name: 'Steel', units: [{ unitName: 'per kg', ratePerUnit: 75 }, { unitName: 'per ton', ratePerUnit: 72000 }] },
      { name: 'Bricks', units: [{ unitName: 'per piece', ratePerUnit: 8 }, { unitName: 'per 1000', ratePerUnit: 7500 }] },
      { name: 'Wire', units: [{ unitName: 'per meter', ratePerUnit: 45 }, { unitName: 'per roll', ratePerUnit: 1800 }] },
      { name: 'Tiles', units: [{ unitName: 'per sqft', ratePerUnit: 55 }, { unitName: 'per box', ratePerUnit: 650 }] },
    ];
    for (const m of materials) {
      await Material.findOneAndUpdate(
        { name: m.name },
        { $setOnInsert: { name: m.name, units: m.units } },
        { upsert: true }
      );
    }
    console.log('Materials ensured.');

    // ---- Sample Contract Types ----
    const contractTypes = [
      { name: 'Labour Contract', defaultPrice: 0 },
      { name: 'Material Contract', defaultPrice: 0 },
      { name: 'Turnkey Contract', defaultPrice: 0 },
      { name: 'Full Construction Contract', defaultPrice: 0 },
    ];
    for (const ct of contractTypes) {
      await ContractType.findOneAndUpdate(
        { name: ct.name },
        { $setOnInsert: ct },
        { upsert: true }
      );
    }
    console.log('Contract types ensured.');

    console.log('\nSeed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();
