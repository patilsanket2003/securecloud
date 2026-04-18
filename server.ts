import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';

// Import database after dotenv is configured
import { pool } from './src/server/db-postgres.ts';
import { initCriminalDb, addCriminal, addCriminalPhoto, getAllCriminals, getCriminalWithPhotos, searchCriminals, getAllCriminalPhotos } from './src/server/criminal-db.ts';
import { SimpleAuthenticFaceRecognitionService } from './src/server/simple-authentic-face-recognition.ts';
import { uploadEvidenceFile, uploadCriminalPhoto, downloadPrivateFile, generateSignedUrl } from './src/server/supabase-storage.ts';
import { ActivityTracker, AuditLogger, auditActions, auditModules } from './src/server/activity-tracker.ts';

const PORT = parseInt(process.env.PORT || '10000', 10);
const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY) {
  throw new Error('JWT_SECRET environment variable is required');
}

async function startServer() {
  // Initialize PostgreSQL database
  console.log('✅ Using Supabase PostgreSQL database');
  
  await initCriminalDb();
  
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // File upload configuration - use memory storage for Supabase upload
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        console.log('File rejected:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          extname: path.extname(file.originalname).toLowerCase()
        });
        cb(new Error('Invalid file type'));
      }
    }
  });

  // Middleware for authentication
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  };

  const authorizeRole = (role: string) => (req: any, res: any, next: any) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };

  // --- Authentication Routes ---
  app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    // Input validation
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2-100 characters' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Force role to 'user' - admin accounts cannot be created via public registration
    const role = 'user';

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const result = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, email, hashedPassword, role]
      );
      
      res.status(201).json({ 
        message: 'User registered successfully', 
        userId: result.rows[0].id,
        role: role
      });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error during registration' });
      }
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, SECRET_KEY, { expiresIn: '24h' });
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Create session and track login
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const session = await ActivityTracker.createSession(user.id, ipAddress, userAgent);
    
    // Log login action
    await AuditLogger.logAction({
      user_id: user.id,
      role: user.role,
      action_type: auditActions.LOGIN,
      module_name: auditModules.SYSTEM,
      description: `User ${user.name} (${user.email}) logged in`,
      ip_address: ipAddress,
      user_agent: userAgent
    });
    
    res.cookie('token', token, cookieOptions);
    res.json({ 
      message: 'Login successful', 
      user: { id: user.id, name: user.name, role: user.role }, 
      token,
      session_id: session.id
    });
  });

  // Logout endpoint
  app.post('/api/logout', authenticateToken, async (req: any, res) => {
    const { session_id } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    try {
      if (session_id) {
        await ActivityTracker.endSession(session_id);
      }
      
      // Log logout action
      await AuditLogger.logAction({
        user_id: req.user.id,
        role: req.user.role,
        action_type: auditActions.LOGOUT,
        module_name: auditModules.SYSTEM,
        description: `User ${req.user.name} (${req.user.email}) logged out`,
        ip_address: ipAddress,
        user_agent: userAgent
      });
      
      res.clearCookie('token');
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Heartbeat endpoint for active time tracking
  app.post('/api/heartbeat', authenticateToken, async (req: any, res) => {
    const { session_id } = req.body;
    
    try {
      if (session_id) {
        await ActivityTracker.updateSessionActivity(session_id);
      }
      res.json({ status: 'active', timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Heartbeat error:', error);
      res.status(500).json({ error: 'Heartbeat failed' });
    }
  });

  // Admin-only registration endpoint
  app.post('/api/admin/register', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { name, email, password, role = 'user' } = req.body;
    
    // Strict input validation
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2-100 characters' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Validate role (only admins can specify role)
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const result = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, email, hashedPassword, role]
      );
      
      res.status(201).json({ 
        message: `${role === 'admin' ? 'Admin' : 'User'} registered successfully`, 
        userId: result.rows[0].id,
        role: role
      });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        console.error('Admin registration error:', err);
        res.status(500).json({ error: 'Server error during registration' });
      }
    }
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
  });

  // --- User Routes ---
  app.get('/api/me', authenticateToken, (req: any, res) => {
    res.json(req.user);
  });

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      const userResult = await pool.query('SELECT COUNT(*) as count FROM users');
      const complaintResult = await pool.query('SELECT COUNT(*) as count FROM complaints');
      const criminalResult = await pool.query('SELECT COUNT(*) as count FROM criminals');
      const timeResult = await pool.query('SELECT NOW() as current_time');
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        database: {
          users: parseInt(userResult.rows[0].count),
          complaints: parseInt(complaintResult.rows[0].count),
          criminals: parseInt(criminalResult.rows[0].count),
          connected: true,
          time: timeResult.rows[0].current_time
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // --- Complaint Routes ---
  // Test complaint route without file upload
  app.post('/api/complaints/test', authenticateToken, async (req: any, res) => {
    try {
      const { title, description, category } = req.body;

      // Validation
      if (!title || !description || !category) {
        return res.status(400).json({ error: 'Title, description, and category are required' });
      }

      // Database transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const complaintResult = await client.query(
          'INSERT INTO complaints (user_id, title, description, category) VALUES ($1, $2, $3, $4) RETURNING id',
          [req.user.id, title, description, category.toLowerCase()]
        );
        const complaintId = complaintResult.rows[0].id;

        await client.query('COMMIT');
        res.status(201).json({ message: 'Test complaint submitted successfully', complaintId });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error in test complaint submission:', err);
      res.status(500).json({ error: 'Failed to submit complaint', details: err.message });
    }
  });

  app.post('/api/complaints', authenticateToken, upload.array('evidence', 5), async (req: any, res) => {
    const { title, description, category } = req.body;
    const files = req.files as Express.Multer.File[];

    // Validation
    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Title, description, and category are required' });
    }

    try {
      // Process uploaded files to Supabase Storage
      const uploadedFiles = [];
      for (const file of files) {
        try {
          const uploadResult = await uploadEvidenceFile(file);
          
          // Generate hash for the file
          const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
          
          uploadedFiles.push({
            originalName: file.originalname,
            filePath: uploadResult.path, // Store as bucket:path format
            mimeType: file.mimetype,
            hash: hash
          });
        } catch (uploadError) {
          console.error('Error uploading file to Supabase:', uploadError);
          throw new Error(`Failed to upload file ${file.originalname}: ${uploadError.message}`);
        }
      }

      // Database transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const complaintResult = await client.query(
          'INSERT INTO complaints (user_id, title, description, category) VALUES ($1, $2, $3, $4) RETURNING id',
          [req.user.id, title, description, category.toLowerCase()]
        );
        const complaintId = complaintResult.rows[0].id;

        // Insert evidence files with Supabase storage paths
        for (const uploadedFile of uploadedFiles) {
          await client.query(
            'INSERT INTO evidence_files (complaint_id, file_name, file_path, file_type, file_hash) VALUES ($1, $2, $3, $4, $5)',
            [complaintId, uploadedFile.originalName, uploadedFile.filePath, uploadedFile.mimeType, uploadedFile.hash]
          );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Complaint submitted successfully', complaintId, filesCount: uploadedFiles.length });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error in complaint submission:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        code: err.code
      });
      res.status(500).json({ error: 'Failed to submit complaint', details: err.message });
    }
  });

  app.get('/api/complaints', authenticateToken, async (req: any, res) => {
    try {
      let complaints;
      if (req.user.role === 'admin') {
        complaints = await pool.query(`
          SELECT c.*, u.name as user_name, ef.file_name, ef.file_path, ef.file_hash 
          FROM complaints c 
          JOIN users u ON c.user_id = u.id 
          LEFT JOIN evidence_files ef ON c.id = ef.complaint_id
          ORDER BY c.created_at DESC
        `);
      } else {
        complaints = await pool.query(`
          SELECT c.*, ef.file_name, ef.file_path, ef.file_hash 
          FROM complaints c 
          LEFT JOIN evidence_files ef ON c.id = ef.complaint_id
          WHERE c.user_id = $1
          ORDER BY c.created_at DESC
        `, [req.user.id]);
      }
      res.json(complaints.rows);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      res.status(500).json({ error: 'Failed to fetch complaints' });
    }
  });

  // --- Criminal Management Routes ---
  app.post('/api/admin/criminals', authenticateToken, authorizeRole('admin'), upload.array('photos', 5), async (req: any, res) => {
    try {
      console.log('🔍 Criminal upload request received');
      console.log('📋 Request body:', req.body);
      console.log('📁 Files received:', req.files ? req.files.length : 0);
      
      const { case_id, full_name, alias_name, crime_type, arrest_date } = req.body;
      const files = req.files as Express.Multer.File[];

      // Validate required fields
      if (!case_id || !full_name || !crime_type) {
        console.log('❌ Validation failed - missing required fields');
        return res.status(400).json({ error: 'Case ID, full name, and crime type are required' });
      }

      console.log('✅ Validation passed, creating criminal record...');

      // Create criminal record
      const criminal = await addCriminal({
        case_id,
        full_name,
        alias_name: alias_name || null,
        crime_type,
        arrest_date: arrest_date || null
      });

      // Upload photos if provided
      if (files && files.length > 0) {
        console.log(`📤 Processing ${files.length} photos for criminal ${criminal.id}`);
        for (const file of files) {
          try {
            console.log(`📤 Uploading photo: ${file.originalname} (${file.size} bytes)`);
            const uploadResult = await uploadCriminalPhoto(file, criminal.id.toString());
            console.log(`✅ Upload successful: ${uploadResult.path}`);
            
            await addCriminalPhoto({
              criminal_id: criminal.id,
              photo_path: uploadResult.path, // Store as bucket:path format
              angle: 'front', // Default angle, can be enhanced later
              face_encoding: null
            });
            console.log(`✅ Database entry created for ${file.originalname}`);
          } catch (uploadError) {
            console.error('❌ Error uploading criminal photo to Supabase:', uploadError);
            throw new Error(`Failed to upload criminal photo ${file.originalname}: ${uploadError.message}`);
          }
        }
        console.log(`✅ All ${files.length} photos uploaded successfully`);
      } else {
        console.log('ℹ️ No photos provided for this criminal');
      }

      // Log audit action
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      await AuditLogger.logAction({
        user_id: req.user.id,
        role: req.user.role,
        action_type: auditActions.CREATE,
        module_name: auditModules.CRIMINALS,
        record_id: criminal.id.toString(),
        target_table: 'criminals',
        description: `Created criminal record: ${full_name} (Case: ${case_id})`,
        new_values: { case_id, full_name, alias_name, crime_type, arrest_date },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      res.status(201).json({ 
        message: 'Criminal added successfully', 
        criminalId: criminal.id,
        photosCount: files?.length || 0
      });
    } catch (error) {
      console.error('Error adding criminal:', error);
      res.status(500).json({ error: 'Failed to add criminal' });
    }
  });

  app.get('/api/admin/criminals', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const criminals = await getAllCriminals();
      res.json(criminals);
    } catch (error) {
      console.error('Error fetching criminals:', error);
      res.status(500).json({ error: 'Failed to fetch criminals' });
    }
  });

  app.get('/api/admin/criminals/:id', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const criminalId = parseInt(req.params.id);
      const criminal = await getCriminalWithPhotos(criminalId);
      res.json(criminal);
    } catch (error) {
      console.error('Error fetching criminal details:', error);
      res.status(500).json({ error: 'Failed to fetch criminal details' });
    }
  });

  // Serve criminal photos from Supabase Storage
  app.get('/api/criminal-photos/:criminalId', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const criminalId = req.params.criminalId;
      console.log(`🔍 Looking for photos for criminal ID: ${criminalId}`);
      
      // Get all photos for this criminal
      const photos = await getAllCriminalPhotos();
      console.log(`📸 Found ${photos.length} total photos in database`);
      
      const criminalPhotos = photos.filter(p => p.criminal_id === criminalId);
      console.log(`🎯 Found ${criminalPhotos.length} photos for criminal ${criminalId}`);
      
      if (criminalPhotos.length === 0) {
        console.log(`❌ No photos found for criminal ${criminalId}`);
        return res.status(404).json({ error: 'No photos found for this criminal' });
      }
      
      console.log(`📥 Serving ${criminalPhotos.length} photos for criminal ${criminalId}`);
      
      // Download and encode all photos
      const photosWithData = [];
      
      for (const photo of criminalPhotos) {
        try {
          console.log(`📥 Downloading photo: ${photo.photo_path}`);
          
          // Try to download from Supabase Storage
          const photoData = await downloadPrivateFile(photo.photo_path);
          
          photosWithData.push({
            ...photo,
            imageData: `data:image/jpeg;base64,${photoData.data.toString('base64')}`,
            photoSize: photoData.data.length,
            contentType: photoData.contentType
          });
        } catch (error) {
          console.error(`❌ Failed to serve photo ${photo.photo_path}:`, error);
          // Add placeholder for failed photos
          photosWithData.push({
            ...photo,
            imageData: null,
            error: error.message
          });
        }
      }
      
      console.log(`✅ Successfully serving ${photosWithData.length} photos with image data`);
      res.json(photosWithData);
    } catch (error) {
      console.error('Error serving criminal photos:', error);
      res.status(500).json({ error: 'Failed to serve criminal photos' });
    }
  });

  app.get('/api/admin/criminals/:id/photos', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const criminalId = req.params.id; // Keep as string
      const photos = await getAllCriminalPhotos();
      const criminalPhotos = photos.filter(photo => photo.criminal_id === criminalId);
      
      // Serve photos with actual image data from Supabase Storage
      const photosWithData = [];
      
      for (const photo of criminalPhotos) {
        try {
          console.log(`📥 Serving criminal photo: ${photo.photo_path}`);
          
          // Try to download from Supabase Storage
          const photoData = await downloadPrivateFile(photo.photo_path);
          photosWithData.push({
            ...photo,
            imageData: `data:image/jpeg;base64,${photoData.data.toString('base64')}`
          });
        } catch (error) {
          console.error(`❌ Failed to serve photo ${photo.photo_path}:`, error);
          // Add placeholder for failed photos
          photosWithData.push({
            ...photo,
            imageData: null,
            error: error.message
          });
        }
      }
      
      res.json(photosWithData);
    } catch (error) {
      console.error('Error fetching criminal photos:', error);
      res.status(500).json({ error: 'Failed to fetch criminal photos' });
    }
  });

  // --- Face Recognition Routes ---
  app.post('/api/admin/face-recognition', authenticateToken, authorizeRole('admin'), upload.single('suspect_photo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Suspect photo is required' });
      }

      console.log('🔍 Starting face recognition analysis...');
      
      // Initialize face recognition service
      await SimpleAuthenticFaceRecognitionService.loadModels();
      
      // Analyze the uploaded suspect photo from memory buffer
      const analysis = await SimpleAuthenticFaceRecognitionService.extractRealFaceFeatures(req.file.buffer);
      
      if (analysis.faceCount === 0) {
        return res.status(400).json({ 
          error: 'No face detected in the uploaded photo',
          faceCount: 0
        });
      }

      // Get all criminal photos for comparison
      const criminalPhotos = await getAllCriminalPhotos();
      
      if (criminalPhotos.length === 0) {
        return res.status(400).json({ 
          error: 'No criminal photos found in database',
          totalCriminals: 0
        });
      }

      console.log(`🔍 Comparing against ${criminalPhotos.length} criminal photos...`);

      // Compare against all criminal photos
      const matches = [];
      const criminalMatches = new Map(); // Group matches by criminal_id

      for (const photo of criminalPhotos) {
        try {
          // Handle both old local paths and new Supabase storage paths
          let photoBuffer: Buffer;
          
          if (photo.photo_path.includes(':')) {
            // New Supabase storage format (bucket:path)
            const { data } = await downloadPrivateFile(photo.photo_path);
            photoBuffer = data;
          } else {
            // Legacy local file path (for backward compatibility)
            const photoPath = photo.photo_path.startsWith('/') ? photo.photo_path.slice(1) : photo.photo_path;
            const fullPhotoPath = path.resolve(photoPath);
            
            if (!fs.existsSync(fullPhotoPath)) {
              console.warn(`⚠️ Photo file not found: ${fullPhotoPath}`);
              continue;
            }
            photoBuffer = fs.readFileSync(fullPhotoPath);
          }
          
          const criminalAnalysis = await SimpleAuthenticFaceRecognitionService.extractRealFaceFeatures(photoBuffer);
          
          // Calculate face similarity using simplified authentic method
          const distance = SimpleAuthenticFaceRecognitionService.calculateFaceDistance(analysis.faceDescriptor, criminalAnalysis.faceDescriptor);
          const similarity = SimpleAuthenticFaceRecognitionService.calculateSimilarity(distance);
          
          console.log(`🔍 Comparing faces - Distance: ${distance.toFixed(4)}, Similarity: ${similarity.toFixed(4)}`);
          
          if (similarity > 0.15) { // Much lower threshold to get any matches
            const match = {
              criminal_id: photo.criminal_id,
              photoPath: photo.photo_path,
              similarity: similarity,
              confidence: analysis.confidence
            };
            
            matches.push(match);
            
            // Group by criminal_id to find best match per criminal
            if (!criminalMatches.has(photo.criminal_id) || (criminalMatches.get(photo.criminal_id) as any).similarity < similarity) {
              criminalMatches.set(photo.criminal_id, match);
            }
          }
        } catch (error) {
          console.error('Error analyzing criminal photo:', error);
        }
      }

      // Get the best match for each criminal
      const bestMatches = Array.from(criminalMatches.values());
      
      // Sort by similarity (highest first)
      bestMatches.sort((a: any, b: any) => (b as any).similarity - (a as any).similarity);

      res.json({
        success: true,
        faceCount: analysis.faceCount,
        confidence: analysis.confidence,
        matches: bestMatches,
        totalComparisons: criminalPhotos.length,
        highestMatch: bestMatches.length > 0 ? (bestMatches[0] as any).similarity : 0
      });

    } catch (error) {
      console.error('Face recognition error:', error);
      
      res.status(500).json({ 
        error: 'Face recognition failed',
        details: error.message 
      });
    }
  });

  app.post('/api/admin/face-recognition-multiple', authenticateToken, authorizeRole('admin'), upload.array('suspect_photos', 5), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'At least one suspect photo is required' });
      }

      console.log(`🔍 Starting face recognition analysis for ${files.length} photos...`);
      
      // Initialize face recognition service
      await SimpleAuthenticFaceRecognitionService.loadModels();
      
      const results = [];
      
      for (const file of files) {
        try {
          const analysis = await SimpleAuthenticFaceRecognitionService.extractRealFaceFeatures(file.buffer);
          
          if (analysis.faceCount > 0) {
            results.push({
              fileName: file.originalname,
              faceCount: analysis.faceCount,
              confidence: analysis.confidence,
              faceDescriptor: analysis.faceDescriptor
            });
          }
          
          // Clean up temp file
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Error analyzing ${file.originalname}:`, error);
          // Clean up temp file on error
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      if (results.length === 0) {
        return res.status(400).json({ 
          error: 'No faces detected in any of the uploaded photos',
          totalPhotos: files.length
        });
      }

      res.json({
        success: true,
        totalPhotos: files.length,
        analyzedPhotos: results.length,
        results: results
      });

    } catch (error) {
      console.error('Multiple face recognition error:', error);
      
      // Clean up temp files on error
      if (req.files) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      
      res.status(500).json({ 
        error: 'Multiple face recognition failed',
        details: error.message 
      });
    }
  });

  // Serve files from Supabase Storage
  app.get('/api/files/:complaintId', authenticateToken, async (req: any, res) => {
    try {
      // Get file info from database
      const fileResult = await pool.query('SELECT * FROM evidence_files WHERE complaint_id = $1', [req.params.complaintId]);
      const file = fileResult.rows[0];
      if (!file) return res.status(404).json({ error: 'File not found' });

      const complaintResult = await pool.query('SELECT user_id FROM complaints WHERE id = $1', [req.params.complaintId]);
      const complaint = complaintResult.rows[0];
      if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

      // Check access
      if (req.user.role !== 'admin' && complaint.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if file path is in Supabase format (bucket:path)
      if (file.file_path.includes(':')) {
        try {
          // Generate fresh signed URL for Supabase file
          const signedUrl = await generateSignedUrl(file.file_path);
          res.redirect(signedUrl);
        } catch (error) {
          console.error('Error generating signed URL:', error);
          res.status(500).json({ error: 'Failed to generate file URL' });
        }
      } else {
        // Legacy local file path - serve directly (for backward compatibility)
        const filePath = path.resolve(file.file_path);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'File not found on disk' });
        }
        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  });

  // Serve criminal photos from Supabase Storage
  app.get('/api/criminal-photos/:criminalId/:photoId', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const { criminalId, photoId } = req.params;
      
      // Get photo info from database
      const photoResult = await pool.query(
        'SELECT * FROM criminal_photos WHERE criminal_id = $1 AND id = $2',
        [criminalId, photoId]
      );
      const photo = photoResult.rows[0];
      if (!photo) return res.status(404).json({ error: 'Photo not found' });

      // Check if photo path is in Supabase format (bucket:path)
      if (photo.photo_path.includes(':')) {
        try {
          // Generate fresh signed URL for Supabase file
          const signedUrl = await generateSignedUrl(photo.photo_path);
          res.redirect(signedUrl);
        } catch (error) {
          console.error('Error generating signed URL for criminal photo:', error);
          res.status(500).json({ error: 'Failed to generate photo URL' });
        }
      } else {
        // Legacy local file path - serve directly (for backward compatibility)
        const filePath = path.resolve(photo.photo_path);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'Photo not found on disk' });
        }
        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error serving criminal photo:', error);
      res.status(500).json({ error: 'Failed to serve criminal photo' });
    }
  });

  // Delete criminal (with cascade delete for photos)
  app.delete('/api/admin/criminals/:id', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const criminalId = parseInt(req.params.id);
      console.log(`🗑️ Deleting criminal with ID: ${criminalId}`);
      
      // Use transaction for atomic operations
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // First check if criminal exists
        const criminalResult = await client.query('SELECT * FROM criminals WHERE id = $1', [criminalId]);
        
        if (criminalResult.rows.length === 0) {
          await client.query('ROLLBACK');
          console.log(`⚠️ No criminal found with ID ${criminalId}`);
          return res.status(404).json({ error: 'Criminal not found' });
        }
        
        // Delete all associated photos
        const photosResult = await client.query('DELETE FROM criminal_photos WHERE criminal_id = $1', [criminalId]);
        console.log(`📸 Deleted ${photosResult.rowCount} photos for criminal ${criminalId}`);
        
        // Then delete the criminal
        const result = await client.query('DELETE FROM criminals WHERE id = $1', [criminalId]);
        
        await client.query('COMMIT');
        console.log(`✅ Successfully deleted criminal ${criminalId}`);
        res.json({ message: 'Criminal deleted successfully', criminalId, photosDeleted: photosResult.rowCount });
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error deleting criminal:', error);
      res.status(500).json({ error: 'Failed to delete criminal' });
    }
  });

  // Admin Activity Tracking API Endpoints
  
  // Get all users with activity summary
  app.get('/api/admin/users/activity', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          u.id, u.name, u.email, u.role, u.created_at, u.last_login_at, 
          u.last_logout_at, u.total_time_spent_seconds, u.is_online, u.session_count,
          COALESCE(activity.total_sessions, 0) as total_sessions,
          COALESCE(activity.avg_session_seconds, 0) as avg_session_seconds,
          COALESCE(activity.last_activity, u.last_login_at) as last_activity
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as total_sessions,
            COALESCE(AVG(session_duration_seconds), 0) as avg_session_seconds,
            MAX(last_activity_at) as last_activity
          FROM user_sessions 
          GROUP BY user_id
        ) activity ON u.id = activity.user_id
        ORDER BY u.created_at DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  });

  // Get user session history
  app.get('/api/admin/users/:userId/sessions', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      
      const sessions = await ActivityTracker.getUserSessionHistory(userId, limit);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      res.status(500).json({ error: 'Failed to fetch user sessions' });
    }
  });

  // Get user activity summary
  app.get('/api/admin/users/:userId/summary', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const summary = await ActivityTracker.getUserActivitySummary(userId);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching user summary:', error);
      res.status(500).json({ error: 'Failed to fetch user summary' });
    }
  });

  // Get currently active users
  app.get('/api/admin/users/active', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const activeUsers = await ActivityTracker.getActiveSessions();
      res.json(activeUsers);
    } catch (error) {
      console.error('Error fetching active users:', error);
      res.status(500).json({ error: 'Failed to fetch active users' });
    }
  });

  // Get audit logs with filters
  app.get('/api/admin/audit-logs', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const filters = {
        user_id: req.query.user_id ? parseInt(req.query.user_id as string) : undefined,
        role: req.query.role as string,
        action_type: req.query.action_type as string,
        module_name: req.query.module_name as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };
      
      const logs = await AuditLogger.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // Get audit statistics
  app.get('/api/admin/audit-stats', authenticateToken, authorizeRole('admin'), async (req: any, res) => {
    try {
      const stats = await AuditLogger.getAuditStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      res.status(500).json({ error: 'Failed to fetch audit stats' });
    }
  });

  // Create Vite server in development mode and add as fallback
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 SecureCloud Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
