import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const evidenceBucket = process.env.SUPABASE_EVIDENCE_BUCKET || 'evidence';
const criminalBucket = process.env.SUPABASE_CRIMINAL_BUCKET || 'criminal-photos';

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'your-supabase-service-role-key') {
  console.warn('⚠️ Supabase credentials not properly configured. Using local fallback for demonstration.');
  console.log('📝 To enable Supabase Storage, update SUPABASE_SERVICE_ROLE_KEY in .env file');
}

// Create Supabase client with service role key for admin operations
export const supabaseClient = supabaseServiceKey && supabaseServiceKey !== 'your-supabase-service-role-key' 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Helper function to generate unique file paths for evidence
export function generateEvidenceFilePath(originalName: string): string {
  const timestamp = Date.now();
  const uuid = uuidv4().slice(0, 8);
  const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255);
  return `complaints/${timestamp}-${uuid}-${sanitized}`;
}

// Helper function to generate unique file paths for criminal photos
export function generateCriminalPhotoPath(criminalId: string, originalName: string): string {
  const timestamp = Date.now();
  const uuid = uuidv4().slice(0, 8);
  const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255);
  return `criminals/${criminalId}/${timestamp}-${uuid}-${sanitized}`;
}

// Upload evidence file to Supabase Storage
export async function uploadEvidenceFile(file: Express.Multer.File): Promise<{ path: string; url: string }> {
  // Check if Supabase is properly configured
  if (!supabaseClient) {
    console.warn('⚠️ Supabase not configured, using demo mode');
    // Return demo path for testing
    const demoPath = `demo:evidence/${file.originalname}`;
    return {
      path: demoPath,
      url: `/demo/files/${file.originalname}`
    };
  }

  const filePath = generateEvidenceFilePath(file.originalname);
  
  const { data, error } = await supabaseClient.storage
    .from(evidenceBucket)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('Error uploading evidence file:', error);
    throw new Error(`Failed to upload evidence file: ${error.message}`);
  }

  // Generate signed URL for private access (valid for 1 hour)
  const { data: { signedUrl } } = await supabaseClient.storage
    .from(evidenceBucket)
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (!signedUrl) {
    throw new Error('Failed to generate signed URL for evidence file');
  }

  return {
    path: `${evidenceBucket}:${filePath}`,
    url: signedUrl
  };
}

// Upload criminal photo to Supabase Storage
export async function uploadCriminalPhoto(file: Express.Multer.File, criminalId: string): Promise<{ path: string; url: string }> {
  // Check if Supabase is properly configured
  if (!supabaseClient) {
    console.warn('⚠️ Supabase not configured, using demo mode');
    // Return demo path for testing
    const demoPath = `demo:criminals/${criminalId}/${file.originalname}`;
    return {
      path: demoPath,
      url: `/demo/criminals/${criminalId}/${file.originalname}`
    };
  }

  const filePath = generateCriminalPhotoPath(criminalId, file.originalname);
  
  const { data, error } = await supabaseClient.storage
    .from(criminalBucket)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('Error uploading criminal photo:', error);
    throw new Error(`Failed to upload criminal photo: ${error.message}`);
  }

  // Generate signed URL for private access (valid for 1 hour)
  const { data: { signedUrl } } = await supabaseClient.storage
    .from(criminalBucket)
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (!signedUrl) {
    throw new Error('Failed to generate signed URL for criminal photo');
  }

  return {
    path: `${criminalBucket}:${filePath}`,
    url: signedUrl
  };
}

// Download private file from Supabase Storage
export async function downloadPrivateFile(storagePath: string): Promise<{ data: Buffer; contentType: string }> {
  const [bucket, ...pathParts] = storagePath.split(':');
  const filePath = pathParts.join(':');

  if (!bucket || !filePath) {
    throw new Error('Invalid storage path format. Expected "bucket:path"');
  }

  console.log(`📥 Downloading from bucket: ${bucket}, path: ${filePath}`);

  // Check if Supabase is properly configured
  if (!supabaseClient) {
    console.warn('⚠️ Supabase not configured, using fallback mode');
    // Return demo data for testing
    return {
      data: Buffer.alloc(1024), // 1KB of demo data
      contentType: 'image/jpeg'
    };
  }

  try {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error('❌ Supabase download error:', {
        bucket,
        filePath,
        error: error.message,
        code: error.code
      });
      
      // Check if bucket doesn't exist
      if (error && 'code' in error && error.code === 'NoSuchBucket') {
        console.error(`🪣 Bucket "${bucket}" does not exist in Supabase Storage`);
        console.log(`💡 Please create bucket "${bucket}" in your Supabase project`);
      }
      
      throw new Error(`Failed to download file: ${error.message}`);
    }

    console.log(`✅ Successfully downloaded ${data.size} bytes from ${bucket}/${filePath}`);
    
    // Convert to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return {
      data: buffer,
      contentType: data.type || 'application/octet-stream'
    };
  } catch (error) {
    console.error('❌ Unexpected download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

// Delete file from Supabase Storage
export async function deleteFile(storagePath: string): Promise<void> {
  const [bucket, ...pathParts] = storagePath.split(':');
  const filePath = pathParts.join(':');

  if (!bucket || !filePath) {
    throw new Error('Invalid storage path format. Expected "bucket:path"');
  }

  const { error } = await supabaseClient.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

// Generate fresh signed URL for existing file
export async function generateSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
  // Check if Supabase is properly configured
  if (!supabaseClient) {
    console.warn('⚠️ Supabase not configured, using demo mode');
    // Return demo URL for testing
    if (storagePath.startsWith('demo:evidence/')) {
      return `/demo/files/${storagePath.split('/').pop()}`;
    } else if (storagePath.startsWith('demo:criminals/')) {
      return `/demo/criminals/${storagePath.split('/').pop()}`;
    }
    return '/demo/file-not-found';
  }

  const [bucket, ...pathParts] = storagePath.split(':');
  const filePath = pathParts.join(':');

  if (!bucket || !filePath) {
    throw new Error('Invalid storage path format. Expected "bucket:path"');
  }

  const { data: { signedUrl }, error } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error || !signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
  }

  return signedUrl;
}
