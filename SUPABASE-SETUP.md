# 🗄️ Supabase Database Migration Guide

## 📋 Overview
This guide will help you migrate SecureCloud from SQLite to Supabase database.

## 🚀 Quick Setup Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub/Google
4. Create new project:
   - **Organization**: Your organization name
   - **Project Name**: securecloud
   - **Database Password**: Generate a strong password
   - **Region**: Choose nearest region
5. Wait for project to be created (2-3 minutes)

### 2. Get Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy these values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **service_role** key: `eyJ...` (long string)

### 3. Update Environment Variables
Edit your `.env` file:

```bash
# Supabase Database Configuration
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Supabase Storage Configuration
SUPABASE_STORAGE_BUCKET="securecloud-uploads"
SUPABASE_ANON_KEY="your-anon-key-here"

# Use Supabase storage
STORAGE_TYPE="supabase"
```

### 4. Create Database Tables
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-migration.sql`
4. Click **Run** to execute the SQL

### 5. Run Migration Script
```bash
# Install dependencies
npm install @supabase/supabase-js

# Run migration
node migrate-to-supabase.js
```

### 6. Start the Application
```bash
npm run dev
```

## 🔧 Detailed Instructions

### Database Schema
The migration will create these tables:
- `users` - User accounts and authentication
- `complaints` - Digital evidence complaints
- `evidence_files` - Uploaded evidence files
- `admin_reviews` - Admin review records
- `criminals` - Criminal records
- `criminal_photos` - Criminal photos
- `digital_evidence` - Digital evidence items
- `admin_activity` - Admin activity logs

### Migration Process
The migration script will:
1. Connect to your SQLite database
2. Connect to your Supabase database
3. Migrate all data table by table
4. Preserve relationships and data integrity
5. Provide progress feedback

### Features After Migration
- ✅ All existing data preserved
- ✅ Real-time database updates
- ✅ Better performance and scalability
- ✅ Automatic backups by Supabase
- ✅ Row Level Security (RLS)
- ✅ Database functions and triggers

## 🚨 Important Notes

### Security
- Use `service_role` key for server-side operations
- Never expose `service_role` key in frontend
- Enable Row Level Security (RLS) for production

### Data Backup
- Supabase automatically backs up your data
- You can also export data manually from SQL Editor
- Keep your SQLite file as backup

### Performance
- Supabase provides better performance than SQLite
- Automatic indexing and optimization
- Handles concurrent connections better

## 🛠️ Troubleshooting

### Common Issues

#### 1. Connection Error
```
Error: Missing Supabase environment variables
```
**Solution**: Check your `.env` file for correct SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

#### 2. SQL Execution Error
```
Error: relation "users" does not exist
```
**Solution**: Run the `supabase-migration.sql` script first

#### 3. Migration Fails
```
Error: duplicate key value violates unique constraint
```
**Solution**: Clear Supabase tables before running migration

### Testing Migration
1. Check Supabase dashboard → Table Editor
2. Verify data appears in all tables
3. Test application functionality
4. Check browser console for errors

## 🔄 Switching Back to SQLite
If you need to switch back to SQLite:
```bash
# Update .env file
STORAGE_TYPE="local"

# Restart application
npm run dev
```

## 📞 Support

For additional help:
1. Check Supabase documentation: https://supabase.com/docs
2. Review the migration script logs
3. Test with a small dataset first

## ✅ Migration Checklist

- [ ] Create Supabase project
- [ ] Get API credentials
- [ ] Update .env file
- [ ] Run SQL schema script
- [ ] Run migration script
- [ ] Test application
- [ ] Verify all data migrated
- [ ] Test all features
- [ ] Update production environment

---

**🎉 Congratulations! Your SecureCloud is now running on Supabase!**
