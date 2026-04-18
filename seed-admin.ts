import bcrypt from 'bcryptjs';
import db, { initDb } from './src/server/db.ts';
import dotenv from 'dotenv';

dotenv.config();

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@securecloud.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is required');
    process.exit(1);
  }

  try {
    // Check if admin already exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
    
    if (existingAdmin) {
      console.log('Admin user already exists:', adminEmail);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Insert admin user
    const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
    const info = stmt.run(adminName, adminEmail, hashedPassword, 'admin');
    
    console.log('✅ Admin user created successfully');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('User ID:', info.lastInsertRowid);
    console.log('');
    console.log('⚠️  Please change the default password after first login!');
    console.log('⚠️  Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables for custom credentials');
    
  } catch (error: any) {
    console.error('❌ Failed to create admin user:', error.message);
    process.exit(1);
  }
}

// Initialize database and seed admin
db.exec('SELECT 1'); // Test connection
seedAdmin().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seed script failed:', error);
  process.exit(1);
});
