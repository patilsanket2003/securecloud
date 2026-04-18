# SecureCloud - Digital Evidence Management System

A secure cloud-ready web application for filing and managing digital evidence complaints with admin review functionality.

## 🏗️ Architecture Overview

SecureCloud demonstrates cloud computing service models through a practical evidence management system:

- **IaaS** (Infrastructure as a Service): Runs on cloud-managed virtual machines or containers
- **PaaS** (Platform as a Service): Uses Node.js/Vite runtime environment for application lifecycle
- **DBaaS** (Database as a Service): PostgreSQL with managed database connections
- **STaaS** (Storage as a Service): Abstracted storage layer supporting local, AWS S3, and Supabase
- **SECaaS** (Security as a Service): JWT authentication, bcrypt hashing, and input validation

## 🚀 Features

- **User Authentication**: Secure JWT-based login/registration with cookies
- **Complaint Management**: File complaints with categories and evidence attachments
- **Admin Review**: Admin dashboard for reviewing and verifying complaints
- **File Upload**: Secure file handling with integrity verification (SHA-256)
- **Role-Based Access**: User and admin roles with appropriate permissions
- **Cloud Ready**: Abstracted storage and database layers for easy cloud deployment

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 12+ (for production)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd securecloud
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb securecloud
   
   # Or use your cloud provider's database
   ```

5. **Seed admin user**
   ```bash
   npm run seed-admin
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## ⚙️ Environment Variables

### Required Variables
- `JWT_SECRET`: Secret key for JWT token signing (minimum 32 characters)
- `DATABASE_URL`: PostgreSQL connection string

### Optional Variables
- `STORAGE_TYPE`: Storage backend (`local`, `s3`, `supabase`) - defaults to `local`
- `ADMIN_EMAIL`: Admin user email for seeding
- `ADMIN_PASSWORD`: Admin user password for seeding
- `ADMIN_NAME`: Admin user name for seeding

### Cloud Storage Configuration

#### AWS S3 (when STORAGE_TYPE=s3)
- `AWS_S3_BUCKET`: S3 bucket name
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

#### Supabase (when STORAGE_TYPE=supabase)
- `SUPABASE_STORAGE_BUCKET`: Supabase storage bucket name
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_KEY`: Supabase service key

## 🗄️ Database Schema

The application uses PostgreSQL with the following tables:

- **users**: User accounts with role-based access
- **complaints**: Complaint records with status tracking
- **evidence_files**: File attachments with integrity hashes
- **admin_reviews**: Admin review records with remarks

### Schema Constraints
- Complaint status: `Pending`, `Verified`, `Rejected`
- User roles: `user`, `admin`
- File integrity: SHA-256 hash verification
- Foreign key relationships with cascade deletes

## 🔐 Security Features

- **Authentication**: JWT tokens with secure cookie handling
- **Input Validation**: Strict validation for all user inputs
- **File Security**: Filename sanitization, extension validation, size limits
- **Password Security**: bcrypt hashing with salt rounds
- **CSRF Protection**: SameSite cookie settings
- **SQL Injection Prevention**: Parameterized queries

## 📁 Project Structure

```
securecloud/
├── src/
│   ├── server/
│   │   ├── db-postgres.ts    # PostgreSQL database layer
│   │   └── storage.ts        # Storage abstraction layer
│   ├── App.tsx               # React frontend
│   └── main.tsx              # Application entry
├── server.ts                 # Express server
├── seed-admin.ts            # Admin seeding script
├── package.json             # Dependencies and scripts
├── .env.example             # Environment template
└── README.md               # This file
```

## 🧪 Testing

### Manual Testing Checklist

1. **User Registration**
   - [ ] Register new user account
   - [ ] Verify email validation works
   - [ ] Check password requirements

2. **Admin Access**
   - [ ] Login with admin credentials
   - [ ] Access admin dashboard
   - [ ] Verify admin-only routes

3. **Complaint Management**
   - [ ] File new complaint with evidence
   - [ ] Upload various file types (PDF, images, videos)
   - [ ] Verify file size limits
   - [ ] Check file integrity hashing

4. **Admin Review**
   - [ ] Review pending complaints
   - [ ] Update complaint status
   - [ ] Add review remarks
   - [ ] Verify status constraints

5. **Security**
   - [ ] Test JWT token expiration
   - [ ] Verify unauthorized access blocking
   - [ ] Check file upload security
   - [ ] Test input validation

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Cloud Deployment Options

#### Heroku
1. Set environment variables in Heroku dashboard
2. Deploy using Heroku CLI
3. Run database migrations
4. Seed admin user

#### AWS
1. Use RDS for PostgreSQL
2. Deploy to EC2 or Elastic Beanstalk
3. Configure S3 for file storage
4. Set up load balancer and SSL

#### Google Cloud Platform
1. Use Cloud SQL for PostgreSQL
2. Deploy to Cloud Run or App Engine
3. Configure Cloud Storage for files
4. Set up IAM permissions

#### DigitalOcean
1. Use Managed PostgreSQL
2. Deploy to App Platform or Droplets
3. Configure Spaces for file storage
4. Set up firewall rules

## 🔧 Configuration

### Database Migration from SQLite
The project has been migrated from SQLite to PostgreSQL for production readiness:

- Connection pooling with `pg` library
- Parameterized queries for security
- Proper foreign key constraints
- Indexes for performance optimization

### Storage Migration Path
The storage abstraction layer allows easy migration:

1. **Local Storage** (current): Files stored in `uploads/` directory
2. **AWS S3**: Set `STORAGE_TYPE=s3` and configure AWS credentials
3. **Supabase**: Set `STORAGE_TYPE=supabase` and configure Supabase settings

## 📊 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/me` - Get current user info

### Complaints
- `POST /api/complaints` - File new complaint
- `GET /api/complaints` - List complaints (user/admin)
- `GET /api/complaints/:id` - Get complaint details
- `GET /api/files/:complaintId` - Download evidence file

### Admin Only
- `PUT /api/admin/complaints/:id/status` - Update complaint status

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 License

This project is for educational purposes as part of cloud computing curriculum.

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check network connectivity

2. **JWT Secret Error**
   - Ensure JWT_SECRET is set in environment
   - Use minimum 32 character secret

3. **File Upload Issues**
   - Check temp directory permissions
   - Verify file size limits
   - Check storage configuration

4. **Admin Access Issues**
   - Run seed script to create admin
   - Check admin credentials
   - Verify role assignment

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## 📈 Performance Considerations

- Database connection pooling (max 20 connections)
- File size limits (50MB max)
- Input validation limits
- Efficient indexing strategy
- CDN integration ready for static assets

## 🔮 Future Enhancements

- Email notifications for complaint updates
- Two-factor authentication
- Advanced file type validation
- Real-time admin notifications
- Analytics dashboard
- Mobile app API
- Multi-tenant support
