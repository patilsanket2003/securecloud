import { pool } from './db-postgres.ts';

export interface Criminal {
  id: number;
  case_id: string;
  full_name: string;
  alias_name?: string;
  crime_type: string;
  arrest_date?: string;
  created_at: string;
}

export interface CriminalPhoto {
  id: number;
  criminal_id: number;
  photo_path: string;
  angle: string;
  face_encoding?: string;
  created_at: string;
}

// Initialize criminal database tables (check if they exist)
export async function initCriminalDb() {
  try {
    // Test connection and check if tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('criminals', 'criminal_photos')
      ORDER BY table_name
    `);
    
    console.log('✅ Criminal database tables found:', result.rows.map(row => row.table_name));
    console.log('✅ Criminal database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing criminal database:', error);
    throw error;
  }
}

// Add a new criminal
export async function addCriminal(criminal: Omit<Criminal, 'id' | 'created_at'>): Promise<Criminal> {
  const result = await pool.query(
    'INSERT INTO criminals (case_id, full_name, alias_name, crime_type, arrest_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [criminal.case_id, criminal.full_name, criminal.alias_name, criminal.crime_type, criminal.arrest_date]
  );
  return result.rows[0];
}

// Add a criminal photo
export async function addCriminalPhoto(photo: Omit<CriminalPhoto, 'id' | 'created_at'>): Promise<CriminalPhoto> {
  const result = await pool.query(
    'INSERT INTO criminal_photos (criminal_id, photo_path, angle, face_encoding) VALUES ($1, $2, $3, $4) RETURNING *',
    [photo.criminal_id, photo.photo_path, photo.angle, photo.face_encoding]
  );
  return result.rows[0];
}

// Get all criminals
export async function getAllCriminals(): Promise<Criminal[]> {
  const result = await pool.query('SELECT * FROM criminals ORDER BY created_at DESC');
  return result.rows;
}

// Get a criminal with their photos
export async function getCriminalWithPhotos(id: number): Promise<Criminal & { photos: CriminalPhoto[] }> {
  const criminalResult = await pool.query('SELECT * FROM criminals WHERE id = $1', [id]);
  const criminal = criminalResult.rows[0];
  
  if (!criminal) {
    throw new Error('Criminal not found');
  }

  const photosResult = await pool.query(
    'SELECT * FROM criminal_photos WHERE criminal_id = $1 ORDER BY angle',
    [id]
  );
  
  return {
    ...criminal,
    photos: photosResult.rows
  };
}

// Search criminals
export async function searchCriminals(query: string): Promise<Criminal[]> {
  const searchPattern = `%${query}%`;
  const result = await pool.query(
    `SELECT * FROM criminals 
     WHERE full_name ILIKE $1 OR alias_name ILIKE $2 OR case_id ILIKE $3
     ORDER BY created_at DESC`,
    [searchPattern, searchPattern, searchPattern]
  );
  return result.rows;
}

// Get all criminal photos
export async function getAllCriminalPhotos(): Promise<CriminalPhoto[]> {
  const result = await pool.query(`
    SELECT cp.*, c.full_name, c.case_id 
    FROM criminal_photos cp
    JOIN criminals c ON cp.criminal_id = c.id
    WHERE cp.photo_path IS NOT NULL
    ORDER BY c.created_at DESC, cp.angle
  `);
  return result.rows;
}
