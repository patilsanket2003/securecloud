import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabaseClient } from './supabase-storage.js';

// Storage interface for cloud abstraction
export interface StorageProvider {
  uploadFile(file: Express.Multer.File, userId: string): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
  getFileUrl(filePath: string): Promise<string>;
}

// Local storage implementation (current)
export class LocalStorageProvider implements StorageProvider {
  private uploadsDir: string;

  constructor(uploadsDir: string = 'uploads') {
    this.uploadsDir = uploadsDir;
    this.ensureUploadsDirectory();
  }

  private ensureUploadsDirectory(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_').substring(0, 255);
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    const userDir = path.join(this.uploadsDir, String(userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const sanitizedOriginalName = this.sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileName = `${uniqueSuffix}-${sanitizedOriginalName}`;
    const filePath = path.join(userDir, fileName);

    // Move file to destination
    fs.copyFileSync(file.path, filePath);
    fs.unlinkSync(file.path); // Clean up temp file

    // Return relative path for database storage
    return path.relative(process.cwd(), filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    // For local storage, return API endpoint path
    const relativePath = path.relative(process.cwd(), filePath);
    return `/api/files/${path.basename(path.dirname(relativePath))}/${path.basename(relativePath)}`;
  }
}

// AWS S3 storage implementation (for future cloud migration)
export class S3StorageProvider implements StorageProvider {
  private bucketName: string;
  private region: string;

  constructor(bucketName: string, region: string = 'us-east-1') {
    this.bucketName = bucketName;
    this.region = region;
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    // TODO: Implement AWS S3 upload
    // This would use AWS SDK v3
    const fileName = `${userId}/${Date.now()}-${file.originalname}`;
    
    // Implementation would include:
    // - Create S3 client
    // - Upload file with proper ACLs
    // - Return S3 key/path
    
    throw new Error('S3 storage not implemented yet');
  }

  async deleteFile(filePath: string): Promise<void> {
    // TODO: Implement S3 delete
    throw new Error('S3 storage not implemented yet');
  }

  async getFileUrl(filePath: string): Promise<string> {
    // TODO: Return S3 signed URL or CloudFront URL
    throw new Error('S3 storage not implemented yet');
  }
}

// Supabase storage implementation
export class SupabaseStorageProvider implements StorageProvider {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
    
    // Validate Supabase credentials immediately
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase Storage');
    }
    
    // Test connection by checking if service key is valid format
    if (process.env.SUPABASE_SERVICE_ROLE_KEY === 'your-supabase-service-role-key') {
      throw new Error('Please update SUPABASE_SERVICE_ROLE_KEY with actual Supabase service role key');
    }
  }

  private async ensureBucket(): Promise<void> {
    // Check if bucket exists, create if it doesn't
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === this.bucketName);
    
    if (!bucketExists) {
      await supabaseClient.storage.createBucket(this.bucketName, {
        public: false, // Keep buckets private for security
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        fileSizeLimit: 10485760 // 10MB limit
      });
    }
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    await this.ensureBucket();

    // Generate unique file path
    const filePath = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;

    // Read file buffer
    const fileBuffer = fs.readFileSync(file.path);

    // Upload to Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from(this.bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    // Clean up temp file
    fs.unlinkSync(file.path);

    // Return the storage path (not full URL)
    return filePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabaseClient.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file from Supabase: ${error.message}`);
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    // For Supabase, return signed URL for private buckets
    // Generate signed URL valid for 1 hour
    const { data, error } = await supabaseClient.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  // Additional method for getting public URL if needed
  getPublicUrl(filePath: string): string {
    const { data } = supabaseClient.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}

// Storage factory - determines which provider to use
export class StorageFactory {
  static createStorage(): StorageProvider {
    const storageType = process.env.STORAGE_TYPE || 'local';
    
    switch (storageType.toLowerCase()) {
      case 'local':
        return new LocalStorageProvider();
      case 's3':
        const bucketName = process.env.AWS_S3_BUCKET;
        const region = process.env.AWS_REGION || 'us-east-1';
        if (!bucketName) {
          throw new Error('AWS_S3_BUCKET environment variable is required for S3 storage');
        }
        return new S3StorageProvider(bucketName, region);
      case 'supabase':
        const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET;
        if (!supabaseBucket) {
          throw new Error('SUPABASE_STORAGE_BUCKET environment variable is required for Supabase storage');
        }
        return new SupabaseStorageProvider(supabaseBucket);
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }
}

// Export default storage provider
export const storage = StorageFactory.createStorage();
