import { db } from './db.mjs';
import { randomBytes } from 'node:crypto';

// Get admin
const admin = db.prepare("SELECT id, name FROM users WHERE role = 'admin' LIMIT 1").get();

if (!admin) {
  console.log('No admin found, skipping sample seeding.');
  process.exit(0);
}

// Check existing folders count
const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders').get().count;

if (folderCount === 0) {
  console.log('Seeding sample categories and folders...');
  const now = new Date().toISOString();

  // Root Folders
  const catExecutive = randomBytes(10).toString('hex');
  const catMarketing = randomBytes(10).toString('hex');
  const catTraining = randomBytes(10).toString('hex');
  const catCustomerSuccess = randomBytes(10).toString('hex');

  db.prepare(
    `
    INSERT INTO folders (id, name, parent_id, created_by, is_shared, created_at) VALUES
    (?, 'Executive & Keynotes', NULL, ?, 1, ?),
    (?, 'Marketing & Launches', NULL, ?, 1, ?),
    (?, 'Training & Onboarding', NULL, ?, 1, ?),
    (?, 'Customer Success & Demos', NULL, ?, 1, ?)
  `,
  ).run(
    catExecutive,
    admin.id,
    now,
    catMarketing,
    admin.id,
    now,
    catTraining,
    admin.id,
    now,
    catCustomerSuccess,
    admin.id,
    now,
  );

  // Subfolders under Marketing
  const subProductDemos = randomBytes(10).toString('hex');
  const subShorts = randomBytes(10).toString('hex');

  db.prepare(
    `
    INSERT INTO folders (id, name, parent_id, created_by, is_shared, created_at) VALUES
    (?, 'Product Feature Demos', ?, ?, 1, ?),
    (?, 'Short-Form Social Videos', ?, ?, 1, ?)
  `,
  ).run(subProductDemos, catMarketing, admin.id, now, subShorts, catMarketing, admin.id, now);

  // Sample Scripts inside folders
  const scriptsToInsert = [
    {
      title: '2026 Annual Keynote - Opening Address',
      folderId: catExecutive,
      content:
        'Welcome everyone to our 2026 Annual Keynote presentation. Today, we are unveiling a breakthrough set of capabilities that transform how creators, broadcasters, and remote teams present with clarity, confidence, and natural eye contact. Let us explore what is possible together.',
    },
    {
      title: 'Q3 Financial & Strategy Briefing',
      folderId: catExecutive,
      content:
        'Good morning stakeholders. During the third quarter, our customer adoption accelerated by forty-five percent quarter over quarter. Our team remained relentlessly focused on performance, efficiency, and reliability across our core distributed infrastructure.',
    },
    {
      title: 'Product Walkthrough: Smart Voice Tracking',
      folderId: subProductDemos,
      content:
        'In this video demonstration, we will show you how our private on-device speech tracking automatically synchronizes teleprompter text as you speak. Notice how the scroll speed naturally adapts to pauses, emphasis, and speed variations without any remote control or pedals needed.',
    },
    {
      title: '60-Second Feature Teaser: Instant Script Library',
      folderId: subShorts,
      content:
        'Tired of losing your presentation scripts in messy docs? Introducing the all-new Folder Tree Explorer in Teleprompter WTF. Group your scripts into nested categories, search across hundreds of takes in milliseconds, and start recording with one click!',
    },
    {
      title: 'New Team Member Orientation',
      folderId: catTraining,
      content:
        'Welcome to the team! This orientation guide covers everything you need to know for your first two weeks, from environment setup and communications channels to our core engineering values and customer support philosophy.',
    },
    {
      title: 'Enterprise Customer Kickoff Call Script',
      folderId: catCustomerSuccess,
      content:
        'Thank you for joining our enterprise onboarding kickoff call. Our goal for today is to outline the migration plan, verify network requirements, and ensure your team has everything necessary for a seamless rollout next Monday.',
    },
  ];

  for (const s of scriptsToInsert) {
    const sid = randomBytes(10).toString('hex');
    db.prepare(
      `
      INSERT INTO scripts (id, title, content, created_by, creator_name, is_shared, folder_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `,
    ).run(sid, s.title, s.content, admin.id, admin.name, s.folderId, now, now);
  }

  console.log('Seeded sample folders and scripts successfully.');
} else {
  console.log('Folders already exist, skipping seeding.');
}
