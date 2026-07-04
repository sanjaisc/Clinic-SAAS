// =============================================================================
// Database Seed Script — Demo Data for Medical Marketplace
// Run: npx tsx prisma/seed.ts  OR  bunx tsx prisma/seed.ts
// =============================================================================

import { db } from '../src/lib/db';
import {
  CLINIC_STATUS,
  PROVIDER_STATUS,
  SLOT_STATUS,
  SLOT_MODALITY,
  STAFF_ROLE,
} from '../src/lib/enums';
import { hashPassword } from '../src/lib/crypto';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a NYC local date + time string to a UTC Date object.
 *  EST = UTC-5 (we ignore DST for seed simplicity). */
function nycToUTC(
  date: Date,
  hours: number,
  minutes: number
): Date {
  const utc = new Date(date);
  utc.setUTCHours(hours + 5, minutes, 0, 0); // NYC EST is UTC-5 → add 5
  return utc;
}

/** Add N days to a date, returning a new Date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Return a date-only UTC Date for the given day offset from today. */
function dayOffset(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// Standard hours-of-operation JSON
const HOURS_OF_OPERATION = JSON.stringify({
  mon: { open: '09:00', close: '17:00' },
  tue: { open: '09:00', close: '17:00' },
  wed: { open: '09:00', close: '17:00' },
  thu: { open: '09:00', close: '17:00' },
  fri: { open: '09:00', close: '17:00' },
  sat: { open: '09:00', close: '13:00' },
  sun: null,
});

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database with demo data...\n');

  // ── 0. Clean existing data (idempotent re-runs) ────────────────────────────

  console.log('0️⃣  Cleaning existing data for idempotent re-run...');
  // Delete in reverse dependency order to avoid FK violations (sequential)
  await db.auditLog.deleteMany();
  await db.internalNote.deleteMany();
  await db.review.deleteMany();
  await db.appointmentLedger.deleteMany();
  await db.token.deleteMany();
  await db.slotLock.deleteMany();
  await db.appointment.deleteMany();
  await db.waitlistEntry.deleteMany();
  await db.clinicClosure.deleteMany();
  await db.user.deleteMany();
  await db.slot.deleteMany();
  await db.slotTemplate.deleteMany();
  await db.providerService.deleteMany();
  await db.providerLanguage.deleteMany();
  await db.clinicInsurance.deleteMany();
  await db.serviceInsurance.deleteMany();
  await db.provider.deleteMany();
  await db.clinic.deleteMany();
  await db.service.deleteMany();
  await db.insurance.deleteMany();
  await db.specialty.deleteMany();
  await db.language.deleteMany();
  await db.systemConfig.deleteMany();
  console.log('   ✅ All existing data cleared\n');

  // ── 1. SystemConfig ────────────────────────────────────────────────────────

  console.log('1️⃣  Creating SystemConfig...');
  await db.systemConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      minDepositCents: 0,
      maxDepositCents: 50000,
      lockTtlSeconds: 600,
      slotGenerationWindowDays: 90,
      waitlistProcessingDelayMin: 3,
      zeroDepositRequireCard: false,
      platformFeeCents: 0,
    },
  });
  console.log('   ✅ SystemConfig created\n');

  // ── 2. Specialties ─────────────────────────────────────────────────────────

  console.log('2️⃣  Creating Specialties...');
  const specialtiesData = [
    { name: 'Family Medicine', slug: 'family-medicine', icon: '🩺', description: 'Comprehensive primary care for patients of all ages.', sortOrder: 1 },
    { name: 'Cardiology', slug: 'cardiology', icon: '❤️', description: 'Diagnosis and treatment of heart and cardiovascular conditions.', sortOrder: 2 },
    { name: 'Dermatology', slug: 'dermatology', icon: '🔬', description: 'Skin, hair, and nail conditions — medical and cosmetic.', sortOrder: 3 },
    { name: 'Pediatrics', slug: 'pediatrics', icon: '👶', description: 'Specialized care for infants, children, and adolescents.', sortOrder: 4 },
    { name: 'Orthopedics', slug: 'orthopedics', icon: '🦴', description: 'Musculoskeletal conditions, injuries, and joint care.', sortOrder: 5 },
  ];

  const specialties: Record<string, string> = {};
  for (const s of specialtiesData) {
    const record = await db.specialty.create({ data: s });
    specialties[s.slug] = record.id;
    console.log(`   ✅ ${s.name} (${record.id})`);
  }
  console.log('');

  // ── 3. Services (2 per specialty) ──────────────────────────────────────────

  console.log('3️⃣  Creating Services...');
  const servicesData = [
    // Family Medicine
    { name: 'Annual Physical', slug: 'annual-physical', specialtySlug: 'family-medicine', durationMinutes: 30, selfPayPriceCents: 15000, copayDemoCents: 0, description: 'Comprehensive yearly health examination and preventive screening.', sortOrder: 1 },
    { name: 'Sick Visit', slug: 'sick-visit', specialtySlug: 'family-medicine', durationMinutes: 30, selfPayPriceCents: 12000, copayDemoCents: 2500, description: 'Urgent same-day visit for acute illness symptoms.', sortOrder: 2 },
    // Cardiology
    { name: 'Heart Screening', slug: 'heart-screening', specialtySlug: 'cardiology', durationMinutes: 45, selfPayPriceCents: 25000, copayDemoCents: 5000, description: 'Cardiovascular risk assessment including blood pressure, cholesterol review, and ECG.', sortOrder: 1 },
    { name: 'ECG Consultation', slug: 'ecg-consultation', specialtySlug: 'cardiology', durationMinutes: 30, selfPayPriceCents: 18000, copayDemoCents: 0, description: 'Electrocardiogram interpretation and cardiac consultation.', sortOrder: 2 },
    // Dermatology
    { name: 'Skin Check', slug: 'skin-check', specialtySlug: 'dermatology', durationMinutes: 20, selfPayPriceCents: 15000, copayDemoCents: 3000, description: 'Full-body skin examination for moles, lesions, and signs of skin cancer.', sortOrder: 1 },
    { name: 'Acne Consultation', slug: 'acne-consultation', specialtySlug: 'dermatology', durationMinutes: 20, selfPayPriceCents: 12000, copayDemoCents: 2500, description: 'Evaluation and treatment planning for acne and related skin conditions.', sortOrder: 2 },
    // Pediatrics
    { name: 'Well Child Visit', slug: 'well-child-visit', specialtySlug: 'pediatrics', durationMinutes: 30, selfPayPriceCents: 15000, copayDemoCents: 0, description: 'Routine well-child checkup including growth assessment and vaccinations.', sortOrder: 1 },
    { name: 'Pediatric Sick Visit', slug: 'pediatric-sick-visit', specialtySlug: 'pediatrics', durationMinutes: 30, selfPayPriceCents: 12000, copayDemoCents: 2500, description: 'Same-day visit for acute childhood illness.', sortOrder: 2 },
    // Orthopedics
    { name: 'Joint Assessment', slug: 'joint-assessment', specialtySlug: 'orthopedics', durationMinutes: 30, selfPayPriceCents: 20000, copayDemoCents: 4000, description: 'Comprehensive evaluation of joint pain, stiffness, or mobility issues.', sortOrder: 1 },
    { name: 'Sports Injury Evaluation', slug: 'sports-injury-evaluation', specialtySlug: 'orthopedics', durationMinutes: 30, selfPayPriceCents: 18000, copayDemoCents: 3000, description: 'Assessment and treatment plan for sports-related injuries.', sortOrder: 2 },
  ];

  const services: Record<string, string> = {};
  const serviceCopays: Record<string, number> = {};
  for (const s of servicesData) {
    const record = await db.service.create({
      data: {
        name: s.name,
        slug: s.slug,
        description: s.description,
        specialtyId: specialties[s.specialtySlug],
        durationMinutes: s.durationMinutes,
        selfPayPriceCents: s.selfPayPriceCents,
        selfPayPaymentType: 'STANDARD_DEPOSIT',
        isActive: true,
        sortOrder: s.sortOrder,
      },
    });
    services[s.slug] = record.id;
    serviceCopays[s.slug] = s.copayDemoCents;
    console.log(`   ✅ ${s.name} (${record.id})`);
  }
  console.log('');

  // ── 4. Insurances ──────────────────────────────────────────────────────────

  console.log('4️⃣  Creating Insurances...');
  const insurancesData = [
    { name: 'Demo Insurance', slug: 'demo-insurance', isDemo: true, sortOrder: 1 },
    { name: 'Aetna', slug: 'aetna', isDemo: false, sortOrder: 2 },
    { name: 'Blue Cross Blue Shield', slug: 'blue-cross-blue-shield', isDemo: false, sortOrder: 3 },
  ];

  const insurances: Record<string, string> = {};
  for (const ins of insurancesData) {
    const record = await db.insurance.create({ data: ins });
    insurances[ins.slug] = record.id;
    console.log(`   ✅ ${ins.name} (${record.id})`);
  }
  console.log('');

  // ── 5. ServiceInsurance entries ────────────────────────────────────────────

  console.log('5️⃣  Creating ServiceInsurance entries...');
  const demoInsuranceId = insurances['demo-insurance'];
  const serviceInsuranceRows = servicesData.map((s) => ({
    serviceId: services[s.slug],
    insuranceId: demoInsuranceId,
    copayCents: s.copayDemoCents,
    isActive: true,
  }));

  await db.serviceInsurance.createMany({ data: serviceInsuranceRows });
  console.log(`   ✅ Created ${serviceInsuranceRows.length} ServiceInsurance entries\n`);

  // ── 11. Languages (created early for ProviderLanguage FK) ──────────────────

  console.log('6️⃣  Creating Languages...');
  const languagesData = [
    { name: 'English', code: 'en', sortOrder: 1 },
    { name: 'Spanish', code: 'es', sortOrder: 2 },
    { name: 'Mandarin', code: 'zh', sortOrder: 3 },
    { name: 'Hindi', code: 'hi', sortOrder: 4 },
    { name: 'Korean', code: 'ko', sortOrder: 5 },
  ];

  const languages: Record<string, string> = {};
  for (const lang of languagesData) {
    const record = await db.language.create({ data: lang });
    languages[lang.code] = record.id;
    console.log(`   ✅ ${lang.name} (${record.id})`);
  }
  console.log('');

  // ── 6. Clinics ─────────────────────────────────────────────────────────────

  console.log('7️⃣  Creating Clinics...');
  const clinicsData = [
    {
      name: 'Downtown Medical Group',
      slug: 'downtown-medical-group',
      streetAddress: '100 Broadway, Suite 400',
      city: 'New York',
      state: 'NY',
      zipCode: '10005',
      latitude: 40.7128,
      longitude: -74.006,
      phoneNumber: '(212) 555-0101',
      email: 'info@downtownmedical.com',
      website: 'https://downtownmedical.example.com',
      tagline: 'Comprehensive care in the heart of Lower Manhattan',
      description: 'Downtown Medical Group has been serving the Lower Manhattan community for over 15 years. Our board-certified physicians provide personalized primary care with a focus on preventive medicine and patient education.',
      inPersonDepositCents: 2500,
      videoDepositCents: 1500,
      selfPayFlatRateCents: 20000,
    },
    {
      name: 'Midtown Health Center',
      slug: 'midtown-health-center',
      streetAddress: '350 Fifth Avenue, Floor 18',
      city: 'New York',
      state: 'NY',
      zipCode: '10118',
      latitude: 40.7549,
      longitude: -73.984,
      phoneNumber: '(212) 555-0202',
      email: 'info@midtownhealth.com',
      website: 'https://midtownhealth.example.com',
      tagline: 'Expert cardiac care in Midtown Manhattan',
      description: 'Midtown Health Center is a premier cardiology practice offering state-of-the-art cardiovascular diagnostics and treatment. Our team of fellowship-trained cardiologists is dedicated to heart health and prevention.',
      inPersonDepositCents: 2500,
      videoDepositCents: 1500,
      selfPayFlatRateCents: 20000,
    },
    {
      name: 'Brooklyn Family Care',
      slug: 'brooklyn-family-care',
      streetAddress: '189 Atlantic Avenue',
      city: 'Brooklyn',
      state: 'NY',
      zipCode: '11201',
      latitude: 40.6782,
      longitude: -73.9442,
      phoneNumber: '(718) 555-0303',
      email: 'info@brooklynfamilycare.com',
      website: 'https://brooklynfamilycare.example.com',
      tagline: 'Your neighborhood dermatology experts in Brooklyn Heights',
      description: 'Brooklyn Family Care provides expert dermatological services in a warm, welcoming environment. We treat everything from routine skin checks to complex dermatological conditions using the latest evidence-based approaches.',
      inPersonDepositCents: 2500,
      videoDepositCents: 1500,
      selfPayFlatRateCents: 20000,
    },
    {
      name: 'Upper East Side Clinic',
      slug: 'upper-east-side-clinic',
      streetAddress: '720 Park Avenue, Suite 2B',
      city: 'New York',
      state: 'NY',
      zipCode: '10021',
      latitude: 40.7736,
      longitude: -73.9566,
      phoneNumber: '(212) 555-0404',
      email: 'info@uesclinic.com',
      website: 'https://uesclinic.example.com',
      tagline: 'Trusted pediatric care on the Upper East Side',
      description: 'Upper East Side Clinic specializes in comprehensive pediatric care from newborn through adolescence. Our child-friendly environment and experienced team make every visit comfortable for both children and parents.',
      inPersonDepositCents: 2500,
      videoDepositCents: 1500,
      selfPayFlatRateCents: 20000,
    },
    {
      name: 'Harlem Wellness Center',
      slug: 'harlem-wellness-center',
      streetAddress: '2080 Adam Clayton Powell Jr. Blvd',
      city: 'New York',
      state: 'NY',
      zipCode: '10027',
      latitude: 40.8116,
      longitude: -73.9465,
      phoneNumber: '(212) 555-0505',
      email: 'info@harlemwellness.com',
      website: 'https://harlemwellness.example.com',
      tagline: 'Holistic family medicine serving the Harlem community',
      description: 'Harlem Wellness Center is dedicated to providing accessible, high-quality family medicine. We believe in treating the whole person — body, mind, and spirit — with culturally sensitive care that honors our diverse community.',
      inPersonDepositCents: 2500,
      videoDepositCents: 1500,
      selfPayFlatRateCents: 20000,
    },
    {
      name: 'Queens Medical Associates',
      slug: 'queens-medical-associates',
      streetAddress: '28-20 Astoria Boulevard',
      city: 'Astoria',
      state: 'NY',
      zipCode: '11102',
      latitude: 40.7282,
      longitude: -73.7949,
      phoneNumber: '(718) 555-0606',
      email: 'info@queensmedical.com',
      website: 'https://queensmedical.example.com',
      tagline: 'Orthopedic excellence in the heart of Astoria, Queens',
      description: 'Queens Medical Associates offers comprehensive orthopedic care including sports medicine, joint replacement, and fracture management. Our state-of-the-art facility and experienced orthopedic surgeons help patients regain mobility and live pain-free.',
      inPersonDepositCents: 2500,
      videoDepositCents: 1500,
      selfPayFlatRateCents: 20000,
    },
  ];

  const clinics: Record<string, string> = {};
  for (const c of clinicsData) {
    const record = await db.clinic.create({
      data: {
        ...c,
        hoursOfOperation: HOURS_OF_OPERATION,
        status: CLINIC_STATUS.PUBLISHED,
        commonInstructions: 'Please arrive 15 minutes before your appointment. Bring a valid photo ID and your insurance card.',
        intakeReminderDays: '3,1',
      },
    });
    clinics[c.slug] = record.id;
    console.log(`   ✅ ${c.name} (${record.id})`);
  }
  console.log('');

  // ── 7. Providers (1 per clinic, strict 1:1) ────────────────────────────────

  console.log('8️⃣  Creating Providers...');
  const providersData = [
    {
      firstName: 'Sarah', lastName: 'Chen', credentials: 'MD',
      slug: 'dr-sarah-chen',
      bio: 'Dr. Sarah Chen is a board-certified family medicine physician with over 12 years of experience. She graduated from Columbia University College of Physicians and Surgeons and completed her residency at NYU Langone. Dr. Chen is passionate about preventive care and building long-term patient relationships.',
      clinicSlug: 'downtown-medical-group',
      yearsExperience: 12, rating: 4.8, reviewCount: 67,
      specialtySlugs: ['annual-physical', 'sick-visit', 'well-child-visit'],
      languageCodes: ['en', 'zh'],
    },
    {
      firstName: 'Michael', lastName: 'Rodriguez', credentials: 'MD, FACC',
      slug: 'dr-michael-rodriguez',
      bio: 'Dr. Michael Rodriguez is a fellowship-trained cardiologist and Fellow of the American College of Cardiology. With 18 years of clinical experience, he specializes in preventive cardiology, heart failure management, and cardiac imaging. He completed his training at Mount Sinai Hospital.',
      clinicSlug: 'midtown-health-center',
      yearsExperience: 18, rating: 4.9, reviewCount: 95,
      specialtySlugs: ['heart-screening', 'ecg-consultation', 'joint-assessment'],
      languageCodes: ['en', 'es'],
    },
    {
      firstName: 'Emily', lastName: 'Watson', credentials: 'MD, FAAD',
      slug: 'dr-emily-watson',
      bio: 'Dr. Emily Watson is a board-certified dermatologist and Fellow of the American Academy of Dermatology. She has 8 years of experience treating a wide range of skin conditions with a special interest in skin cancer screening and acne management. She earned her medical degree from Weill Cornell Medicine.',
      clinicSlug: 'brooklyn-family-care',
      yearsExperience: 8, rating: 4.6, reviewCount: 42,
      specialtySlugs: ['skin-check', 'acne-consultation', 'annual-physical'],
      languageCodes: ['en'],
    },
    {
      firstName: 'James', lastName: 'Okafor', credentials: 'MD, FAAP',
      slug: 'dr-james-okafor',
      bio: 'Dr. James Okafor is a board-certified pediatrician and Fellow of the American Academy of Pediatrics. He has been caring for children in the New York area for over 10 years. Dr. Okafor is known for his gentle bedside manner and thorough approach to child wellness.',
      clinicSlug: 'upper-east-side-clinic',
      yearsExperience: 10, rating: 4.7, reviewCount: 54,
      specialtySlugs: ['well-child-visit', 'pediatric-sick-visit', 'sick-visit'],
      languageCodes: ['en'],
    },
    {
      firstName: 'Priya', lastName: 'Sharma', credentials: 'MD',
      slug: 'dr-priya-sharma',
      bio: 'Dr. Priya Sharma is a compassionate family medicine physician with 15 years of experience. She completed her medical education at Johns Hopkins University School of Medicine and her residency at Stanford. Dr. Sharma takes a holistic approach to primary care, emphasizing wellness and prevention.',
      clinicSlug: 'harlem-wellness-center',
      yearsExperience: 15, rating: 4.5, reviewCount: 38,
      specialtySlugs: ['annual-physical', 'sick-visit', 'well-child-visit'],
      languageCodes: ['en', 'hi'],
    },
    {
      firstName: 'David', lastName: 'Kim', credentials: 'MD',
      slug: 'dr-david-kim',
      bio: 'Dr. David Kim is a board-certified orthopedic surgeon specializing in sports medicine and joint replacement. He has 14 years of experience and serves as team physician for several local sports organizations. Dr. Kim completed his orthopedic surgery residency at Hospital for Special Surgery.',
      clinicSlug: 'queens-medical-associates',
      yearsExperience: 14, rating: 4.8, reviewCount: 73,
      specialtySlugs: ['joint-assessment', 'sports-injury-evaluation', 'heart-screening'],
      languageCodes: ['en', 'ko'],
    },
  ];

  const providers: Record<string, string> = {};
  for (const p of providersData) {
    const record = await db.provider.create({
      data: {
        clinicId: clinics[p.clinicSlug],
        firstName: p.firstName,
        lastName: p.lastName,
        credentials: p.credentials,
        slug: p.slug,
        bio: p.bio,
        yearsExperience: p.yearsExperience,
        rating: p.rating,
        reviewCount: p.reviewCount,
        slotDurationMinutes: 30,
        status: PROVIDER_STATUS.ACTIVE,
      },
    });
    providers[p.slug] = record.id;
    console.log(`   ✅ ${p.firstName} ${p.lastName} (${record.id})`);
  }
  console.log('');

  // ── 8. ProviderService entries ──────────────────────────────────────────────

  console.log('9️⃣  Creating ProviderService entries...');
  const providerServiceRows: Array<{ providerId: string; serviceId: string }> = [];
  for (const p of providersData) {
    for (const serviceSlug of p.specialtySlugs) {
      providerServiceRows.push({
        providerId: providers[p.slug],
        serviceId: services[serviceSlug],
      });
    }
  }

  await db.providerService.createMany({ data: providerServiceRows });
  console.log(`   ✅ Created ${providerServiceRows.length} ProviderService entries\n`);

  // ── 9. ClinicInsurance entries ──────────────────────────────────────────────

  console.log('🔟 Creating ClinicInsurance entries...');
  const clinicInsuranceRows: Array<{ clinicId: string; insuranceId: string }> = [];
  const insuranceIds = Object.values(insurances);

  // Each clinic gets Demo Insurance + 2 real insurances (cycling through Aetna, BCBS)
  const clinicSlugs = clinicsData.map((c) => c.slug);
  for (let i = 0; i < clinicSlugs.length; i++) {
    clinicInsuranceRows.push(
      { clinicId: clinics[clinicSlugs[i]], insuranceId: insurances['demo-insurance'] },
      { clinicId: clinics[clinicSlugs[i]], insuranceId: insuranceIds[1] }, // Aetna
      { clinicId: clinics[clinicSlugs[i]], insuranceId: insuranceIds[2] }, // BCBS
    );
  }

  await db.clinicInsurance.createMany({ data: clinicInsuranceRows });
  console.log(`   ✅ Created ${clinicInsuranceRows.length} ClinicInsurance entries\n`);

  // ── 10. ProviderLanguage entries ────────────────────────────────────────────

  console.log('1️⃣1️⃣  Creating ProviderLanguage entries...');
  const providerLanguageRows: Array<{ providerId: string; languageId: string }> = [];
  for (const p of providersData) {
    for (const langCode of p.languageCodes) {
      providerLanguageRows.push({
        providerId: providers[p.slug],
        languageId: languages[langCode],
      });
    }
  }

  await db.providerLanguage.createMany({ data: providerLanguageRows });
  console.log(`   ✅ Created ${providerLanguageRows.length} ProviderLanguage entries\n`);

  // ── 12. Slots for next 14 days ─────────────────────────────────────────────

  console.log('1️⃣2️⃣  Generating Slots (next 14 days)...');

  // Morning and afternoon slot times in NYC local (EST = UTC-5)
  const MORNING_SLOTS = [9, 9, 10, 10, 11, 11]; // pairs → every 30 min
  const MORNING_MINUTES = [0, 30, 0, 30, 0, 30];
  const AFTERNOON_SLOTS = [13, 13, 14, 14, 15, 15];
  const AFTERNOON_MINUTES = [0, 30, 0, 30, 0, 30];

  const allSlotData: Array<{
    clinicId: string;
    providerId: string;
    startTime: Date;
    endTime: Date;
    modality: string;
    status: string;
  }> = [];

  const providerList = providersData.map((p) => ({
    providerId: providers[p.slug],
    clinicId: clinics[p.clinicSlug],
  }));

  let totalSlots = 0;

  for (const { providerId, clinicId } of providerList) {
    for (let day = 0; day < 14; day++) {
      const baseDate = dayOffset(day);
      const dayOfWeek = baseDate.getUTCDay(); // 0=Sun, 6=Sat

      // Skip Sundays entirely
      if (dayOfWeek === 0) continue;

      // Saturdays: only morning slots (4)
      const isSaturday = dayOfWeek === 6;
      const numMorningSlots = isSaturday ? 4 : 6;
      const numAfternoonSlots = isSaturday ? 0 : 6;

      // Morning slots
      for (let i = 0; i < numMorningSlots; i++) {
        const start = nycToUTC(baseDate, MORNING_SLOTS[i], MORNING_MINUTES[i]);
        const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min

        // Determine modality: roughly 70% IN_PERSON, 30% VIDEO
        const modality = Math.random() < 0.7 ? SLOT_MODALITY.IN_PERSON : SLOT_MODALITY.VIDEO;

        // Determine status: mostly AVAILABLE, some BOOKED/BLOCKED for realism
        let status = SLOT_STATUS.AVAILABLE;

        // Make some past or early slots BOOKED/BLOCKED
        if (day <= 1 && Math.random() < 0.2) {
          status = SLOT_STATUS.BOOKED;
        } else if (day <= 3 && Math.random() < 0.1) {
          status = SLOT_STATUS.BLOCKED;
        }

        // Ensure at least 3 AVAILABLE slots today/tomorrow per provider
        // (we'll fix this after generation)

        allSlotData.push({ clinicId, providerId, startTime: start, endTime: end, modality, status });
        totalSlots++;
      }

      // Afternoon slots
      for (let i = 0; i < numAfternoonSlots; i++) {
        const start = nycToUTC(baseDate, AFTERNOON_SLOTS[i], AFTERNOON_MINUTES[i]);
        const end = new Date(start.getTime() + 30 * 60 * 1000);

        const modality = Math.random() < 0.7 ? SLOT_MODALITY.IN_PERSON : SLOT_MODALITY.VIDEO;

        let status = SLOT_STATUS.AVAILABLE;
        if (day <= 1 && Math.random() < 0.15) {
          status = SLOT_STATUS.BOOKED;
        } else if (day <= 2 && Math.random() < 0.08) {
          status = SLOT_STATUS.BLOCKED;
        }

        allSlotData.push({ clinicId, providerId, startTime: start, endTime: end, modality, status });
        totalSlots++;
      }
    }
  }

  // Insert all slots in batches (SQLite has limits on batch size)
  const BATCH_SIZE = 500;
  for (let i = 0; i < allSlotData.length; i += BATCH_SIZE) {
    const batch = allSlotData.slice(i, i + BATCH_SIZE);
    await db.slot.createMany({ data: batch });
  }
  console.log(`   ✅ Created ${totalSlots} slots across 6 providers × 14 days\n`);

  // ── 13. Reviews (need past completed appointments) ──────────────────────────

  console.log('1️⃣3️⃣  Creating Reviews with completed appointments...');

  // Create 5 completed appointments in the past for review purposes
  // We'll create BOOKED slots in the past, then appointments, then reviews
  const reviewData = [
    {
      providerSlug: 'dr-sarah-chen',
      patientName: 'Maria Gonzalez',
      patientDob: new Date('1988-03-15'),
      patientPhone: '(212) 555-1001',
      patientEmail: 'maria.gonzalez@example.com',
      serviceSlug: 'annual-physical',
      daysAgo: 14,
      overallRating: 5, waitTimeRating: 4, bedsideRating: 5, staffRating: 5,
      comment: 'Dr. Chen is incredibly thorough and took the time to explain everything. The staff was friendly and the office was very clean. Highly recommend!',
    },
    {
      providerSlug: 'dr-michael-rodriguez',
      patientName: 'John Mitchell',
      patientDob: new Date('1975-07-22'),
      patientPhone: '(646) 555-1002',
      patientEmail: 'john.mitchell@example.com',
      serviceSlug: 'heart-screening',
      daysAgo: 10,
      overallRating: 5, waitTimeRating: 5, bedsideRating: 5, staffRating: 4,
      comment: 'Outstanding cardiologist. Dr. Rodriguez explained my test results clearly and put me at ease. The screening was comprehensive and well-organized.',
    },
    {
      providerSlug: 'dr-james-okafor',
      patientName: 'Rebecca Torres',
      patientDob: new Date('1992-11-08'),
      patientPhone: '(917) 555-1003',
      patientEmail: 'rebecca.torres@example.com',
      serviceSlug: 'well-child-visit',
      daysAgo: 7,
      overallRating: 4, waitTimeRating: 4, bedsideRating: 5, staffRating: 5,
      comment: 'My 3-year-old actually enjoyed his visit! Dr. Okafor is so gentle and patient with kids. The waiting area has toys and books which was a nice touch.',
    },
    {
      providerSlug: 'dr-priya-sharma',
      patientName: 'Alex Nguyen',
      patientDob: new Date('1990-01-30'),
      patientPhone: '(347) 555-1004',
      patientEmail: 'alex.nguyen@example.com',
      serviceSlug: 'sick-visit',
      daysAgo: 4,
      overallRating: 4, waitTimeRating: 3, bedsideRating: 4, staffRating: 4,
      comment: 'Dr. Sharma was very thorough in diagnosing my condition. The wait was a bit long but the care quality made up for it. She prescribed the right treatment and I felt better within days.',
    },
    {
      providerSlug: 'dr-david-kim',
      patientName: 'Patricia Williams',
      patientDob: new Date('1983-05-12'),
      patientPhone: '(718) 555-1005',
      patientEmail: 'patricia.williams@example.com',
      serviceSlug: 'joint-assessment',
      daysAgo: 2,
      overallRating: 5, waitTimeRating: 5, bedsideRating: 4, staffRating: 5,
      comment: 'Finally found an orthopedist who listens! Dr. Kim took the time to understand my knee issues and created a detailed treatment plan. The facility is modern and well-equipped.',
    },
  ];

  const clinicForProvider: Record<string, string> = {};
  for (const p of providersData) {
    clinicForProvider[p.slug] = clinics[p.clinicSlug];
  }

  // Get specialtyId for each service
  const serviceSpecialty: Record<string, string> = {};
  for (const s of servicesData) {
    serviceSpecialty[s.slug] = specialties[s.specialtySlug];
  }

  for (const r of reviewData) {
    const providerId = providers[r.providerSlug];
    const clinicId = clinicForProvider[r.providerSlug];
    const serviceId = services[r.serviceSlug];
    const specialtyId = serviceSpecialty[r.serviceSlug];

    // Create a past slot for this appointment
    const slotDate = dayOffset(-r.daysAgo);
    const dayOfWeek = slotDate.getUTCDay();
    if (dayOfWeek === 0) {
      // Shift to Monday if it landed on Sunday
      slotDate.setDate(slotDate.getDate() + 1);
    }
    const slotStart = nycToUTC(slotDate, 10, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    const slot = await db.slot.create({
      data: {
        clinicId,
        providerId,
        startTime: slotStart,
        endTime: slotEnd,
        modality: SLOT_MODALITY.IN_PERSON,
        status: SLOT_STATUS.BOOKED,
      },
    });

    // Create a completed appointment
    const appointment = await db.appointment.create({
      data: {
        slotId: slot.id,
        clinicId,
        providerId,
        specialtyId,
        serviceId,
        patientName: r.patientName,
        patientDob: r.patientDob,
        patientPhone: r.patientPhone,
        patientEmail: r.patientEmail,
        patientType: r.serviceSlug.startsWith('well-child') || r.serviceSlug.startsWith('pediatric') ? 'PEDIATRIC' : 'ADULT',
        reasonForVisit: `Follow-up / ${r.serviceSlug.replace(/-/g, ' ')}`,
        insuranceId: demoInsuranceId,
        isDemoInsurance: true,
        depositCents: 2500,
        paymentStatus: 'CAPTURED',
        paymentMethod: 'MANUAL_WAIVER',
        modality: SLOT_MODALITY.IN_PERSON,
        startTime: slotStart,
        endTime: slotEnd,
        status: 'COMPLETED',
        intakeCompleted: true,
        insuranceVerified: true,
      },
    });

    // Create the review
    await db.review.create({
      data: {
        appointmentId: appointment.id,
        clinicId,
        providerId,
        overallRating: r.overallRating,
        waitTimeRating: r.waitTimeRating,
        bedsideRating: r.bedsideRating,
        staffRating: r.staffRating,
        comment: r.comment,
        isVerified: true,
      },
    });

    console.log(`   ✅ Review for ${r.providerSlug} (${r.overallRating}/5)`);
  }
  console.log('');

  // ── 14. SlotTemplates ──────────────────────────────────────────────────────

  console.log('1️⃣4️⃣  Creating SlotTemplates...');

  // Mon=1 through Sat=6
  const DAY_OF_WEEK_MAP: Record<string, number> = {
    mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };

  const slotTemplateRows: Array<{
    providerId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    modality: string;
  }> = [];

  for (const p of providersData) {
    const pid = providers[p.slug];

    // Morning block: 09:00-12:00 IN_PERSON
    // Afternoon block: 13:00-16:00 IN_PERSON (Mon-Fri only)
    // Video block: 09:00-12:00 VIDEO
    for (const dayCode of Object.keys(DAY_OF_WEEK_MAP)) {
      const dow = DAY_OF_WEEK_MAP[dayCode];
      const isSaturday = dow === 6;

      slotTemplateRows.push(
        { providerId: pid, dayOfWeek: dow, startTime: '09:00', endTime: '12:00', modality: SLOT_MODALITY.IN_PERSON },
        { providerId: pid, dayOfWeek: dow, startTime: '09:00', endTime: '12:00', modality: SLOT_MODALITY.VIDEO },
      );
      if (!isSaturday) {
        slotTemplateRows.push(
          { providerId: pid, dayOfWeek: dow, startTime: '13:00', endTime: '16:00', modality: SLOT_MODALITY.IN_PERSON },
        );
      }
    }
  }

  await db.slotTemplate.createMany({ data: slotTemplateRows });
  console.log(`   ✅ Created ${slotTemplateRows.length} SlotTemplate entries (2-3 templates × 6 days × 6 providers)\n`);

  // ── 15. Staff User Accounts ─────────────────────────────────────────────

  console.log('1️⃣5️⃣  Creating Staff User Accounts...');

  // System Manager (no clinic)
  const sysMgrHash = await hashPassword('sysadmin123');
  const sysMgr = await db.user.create({
    data: {
      email: 'sysadmin@clinicbook.com',
      name: 'System Manager',
      passwordHash: sysMgrHash,
      role: STAFF_ROLE.SYSTEM_MANAGER,
      clinicId: null,
      isActive: true,
    },
  });
  console.log(`   ✅ ${sysMgr.email} (${sysMgr.role})`);

  // One admin + one receptionist per clinic
  const staffCount = { admin: 0, reception: 0 };
  for (const clinicInfo of clinicsData) {
    const clinicRec = await db.clinic.findFirst({ where: { slug: clinicInfo.slug }, select: { id: true, name: true } });
    if (!clinicRec) continue;
    const clinicDomain = clinicInfo.slug.replace(/-/g, '');

    const adminHash = await hashPassword('admin123');
    await db.user.create({
      data: {
        email: `admin@${clinicDomain}.clinicbook.com`,
        name: `${clinicRec.name} Admin`,
        passwordHash: adminHash,
        role: STAFF_ROLE.CLINIC_ADMIN,
        clinicId: clinicRec.id,
        isActive: true,
      },
    });
    staffCount.admin++;
    console.log(`   ✅ admin@${clinicDomain}.clinicbook.com (CLINIC_ADMIN) → ${clinicRec.name}`);

    const receptionHash = await hashPassword('reception123');
    await db.user.create({
      data: {
        email: `reception@${clinicDomain}.clinicbook.com`,
        name: `${clinicRec.name} Reception`,
        passwordHash: receptionHash,
        role: STAFF_ROLE.CLINIC_RECEPTION,
        clinicId: clinicRec.id,
        isActive: true,
      },
    });
    staffCount.reception++;
    console.log(`   ✅ reception@${clinicDomain}.clinicbook.com (CLINIC_RECEPTION) → ${clinicRec.name}`);
  }
  console.log(`   Total staff: 1 system manager + ${staffCount.admin} admins + ${staffCount.reception} receptionists\n`);

  // ── Done ───────────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ Seed complete! Summary:');
  console.log(`   • SystemConfig: 1`);
  console.log(`   • Specialties: ${specialtiesData.length}`);
  console.log(`   • Services: ${servicesData.length}`);
  console.log(`   • Insurances: ${insurancesData.length}`);
  console.log(`   • ServiceInsurance: ${serviceInsuranceRows.length}`);
  console.log(`   • Languages: ${languagesData.length}`);
  console.log(`   • Clinics: ${clinicsData.length}`);
  console.log(`   • Providers: ${providersData.length}`);
  console.log(`   • ProviderService: ${providerServiceRows.length}`);
  console.log(`   • ClinicInsurance: ${clinicInsuranceRows.length}`);
  console.log(`   • ProviderLanguage: ${providerLanguageRows.length}`);
  console.log(`   • Slots: ${totalSlots}`);
  console.log(`   • Appointments (completed): ${reviewData.length}`);
  console.log(`   • Reviews: ${reviewData.length}`);
  console.log(`   • SlotTemplates: ${slotTemplateRows.length}`);
  console.log(`   • Staff Users: ${1 + staffCount.admin + staffCount.reception}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

// ── Run ────────────────────────────────────────────────────────────────────────

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:');
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });