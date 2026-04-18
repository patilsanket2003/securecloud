import React, { useState, useEffect } from 'react';
import { Search, Plus, Camera, Download, User, Calendar, AlertCircle, CheckCircle, Trash } from 'lucide-react';

interface Criminal {
  id: number;
  case_id: string;
  full_name: string;
  alias_name?: string;
  crime_type: string;
  arrest_date?: string;
  created_at: string;
}

interface CriminalPhoto {
  id: number;
  criminal_id: number;
  photo_path: string;
  angle: string;
  created_at: string;
}

interface CriminalWithPhotos {
  criminal: Criminal;
  photos: CriminalPhoto[];
}

interface FaceMatch {
  criminal_id: number;
  full_name: string;
  case_id: string;
  match_score: number;
  photo_path: string;
  angle?: string;
  confidence_level: 'low' | 'medium' | 'high' | 'very_high';
  imageData?: string; // Add base64 image data
}

function CriminalManagement() {
  const [criminals, setCriminals] = useState<Criminal[]>([]);
  const [selectedCriminal, setSelectedCriminal] = useState<CriminalWithPhotos | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    case_id: '',
    full_name: '',
    alias_name: '',
    crime_type: '',
    arrest_date: ''
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [suspectPhoto, setSuspectPhoto] = useState<File | null>(null);
  const [suspectPhotos, setSuspectPhotos] = useState<File[]>([]);
  const [useMultipleAngles, setUseMultipleAngles] = useState(false);
  const [faceMatches, setFaceMatches] = useState<FaceMatch[]>([]);

  useEffect(() => {
    fetchCriminals();
  }, []);

  const fetchCriminals = async () => {
    console.log('🔄 Fetching criminals...');
    try {
      const res = await fetch('/api/admin/criminals', {
        credentials: 'include'
      });
      console.log('📡 Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Criminals loaded:', data);
        setCriminals(data);
      } else if (res.status === 401) {
        console.error('❌ Authentication required - please login');
        setCriminals([]);
      } else {
        console.error('❌ Failed to load criminals:', res.status);
        setCriminals([]);
      }
    } catch (err) {
      console.error('❌ Failed to fetch criminals:', err);
      setCriminals([]);
    }
  };

  const handleSubmitCriminal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append('case_id', formData.case_id);
    data.append('full_name', formData.full_name);
    data.append('alias_name', formData.alias_name);
    data.append('crime_type', formData.crime_type);
    data.append('arrest_date', formData.arrest_date);
    
    photos.forEach(photo => {
      data.append('photos', photo);
    });

    try {
      const res = await fetch('/api/admin/criminals', {
        method: 'POST',
        body: data,
        credentials: 'include'
      });

      if (res.ok) {
        alert('Criminal added successfully!');
        setShowAddForm(false);
        setFormData({ case_id: '', full_name: '', alias_name: '', crime_type: '', arrest_date: '' });
        setPhotos([]);
        fetchCriminals();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add criminal');
      }
    } catch (err) {
      alert('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceRecognition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const photosToUse = useMultipleAngles ? suspectPhotos : [suspectPhoto];
    if (photosToUse.length === 0 || photosToUse[0] == null) return;

    setLoading(true);

    if (useMultipleAngles) {
      // Multiple angles processing
      const data = new FormData();
      photosToUse.forEach(photo => {
        data.append('suspect_photos', photo);
      });

      try {
        const res = await fetch('/api/admin/face-recognition-multiple', {
          method: 'POST',
          body: data,
          credentials: 'include'
        });

        if (res.ok) {
          const result = await res.json();
          // For multiple photos, we don't have criminal matches, just face detection results
          // Convert to expected format for display
          const displayMatches = result.results.map((face: any, index: number) => ({
            criminal_id: null,
            photo_path: null,
            similarity: 0,
            confidence: face.confidence,
            full_name: `Detected Face ${index + 1}`,
            case_id: 'N/A',
            angle: 'front',
            fileName: face.fileName
          }));
          
          setFaceMatches(displayMatches);
          setShowFaceRecognition(true);
        } else {
          const err = await res.json();
          alert(err.error || 'Face recognition failed');
        }
      } catch (err) {
        alert('Connection failed');
      }
    } else {
      // Single photo processing
      const data = new FormData();
      data.append('suspect_photo', suspectPhoto!);

      try {
        const res = await fetch('/api/admin/face-recognition', {
          method: 'POST',
          body: data,
          credentials: 'include'
        });

        if (res.ok) {
          const result = await res.json();
          
          // Fetch criminal details for each match
          const matchesWithDetails = await Promise.all(
            result.matches.map(async (match: any) => {
              try {
                console.log(`🔍 Fetching details for criminal ID: ${match.criminal_id}`);
                const criminalRes = await fetch(`/api/admin/criminals/${match.criminal_id}`, {
                  credentials: 'include'
                });
                
                if (criminalRes.ok) {
                  const criminal = await criminalRes.json();
                  console.log(`✅ Criminal details fetched: ${criminal.full_name}`);
                  
                  // Fetch photos with image data
                  const photosRes = await fetch(`/api/criminal-photos/${match.criminal_id}`, {
                    credentials: 'include'
                  });
                  let imageData = null;
                  if (photosRes.ok) {
                    const photos = await photosRes.json();
                    imageData = photos[0]?.imageData || null;
                    console.log(`✅ Photo data fetched: ${imageData ? 'YES' : 'NO'}`);
                  } else {
                    console.error('❌ Failed to fetch photos:', photosRes.status);
                  }
                  
                  return {
                    ...match,
                    full_name: criminal.full_name,
                    case_id: criminal.case_id,
                    angle: 'front', // Default angle since we don't have photo-specific angle info
                    imageData: imageData // Use base64 image data
                  };
                } else {
                  console.error(`❌ Failed to fetch criminal details: ${criminalRes.status}`);
                  return {
                    ...match,
                    full_name: 'Unknown Criminal',
                    case_id: 'N/A',
                    angle: 'front',
                    imageData: null
                  };
                }
              } catch (error) {
                console.error('❌ Error fetching criminal details:', error);
                return {
                  ...match,
                  full_name: 'Error Loading',
                  case_id: 'N/A',
                  angle: 'front',
                  imageData: null
                };
              }
            })
          );
          
          setFaceMatches(matchesWithDetails);
          setShowFaceRecognition(true);
        } else {
          const err = await res.json();
          alert(err.error || 'Face recognition failed');
        }
      } catch (err) {
        alert('Connection failed');
      }
    }

    setLoading(false);
  };

  const fetchCriminalDetails = async (criminalId: number) => {
    try {
      const res = await fetch(`/api/admin/criminals/${criminalId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Fetch photos with image data
        const photosRes = await fetch(`/api/admin/criminals/${criminalId}/photos`, {
          credentials: 'include'
        });
        if (photosRes.ok) {
          const photos = await photosRes.json();
          // Merge criminal data with photos that have imageData
          setSelectedCriminal({
            ...data,
            photos: photos
          });
        } else {
          setSelectedCriminal(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch criminal details:', err);
    }
  };

  const searchCriminals = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const res = await fetch(`/api/admin/criminals/search?query=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCriminals(data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleDeleteCriminal = async (criminalId: number) => {
    if (!confirm('Are you sure you want to delete this criminal and all their photos? This action cannot be undone.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/criminals/${criminalId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (res.ok) {
        alert('Criminal deleted successfully');
        fetchCriminals(); // Refresh the list
        if (selectedCriminal?.criminal.id === criminalId) {
          setSelectedCriminal(null); // Close details if deleted
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete criminal');
      }
    } catch (err) {
      console.error('Failed to delete criminal:', err);
      alert('Failed to delete criminal');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Criminal Management</h1>
        <p className="text-zinc-600">Manage criminal database with face recognition capabilities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Criminal Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-900">Add New Criminal</h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                {showAddForm ? 'Cancel' : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleSubmitCriminal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Case ID</label>
                  <input
                    type="text"
                    required
                    value={formData.case_id}
                    onChange={e => setFormData({...formData, case_id: e.target.value})}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., CASE-2024-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Alias Name</label>
                  <input
                    type="text"
                    value={formData.alias_name}
                    onChange={e => setFormData({...formData, alias_name: e.target.value})}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Known aliases"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Crime Type</label>
                  <select
                    required
                    value={formData.crime_type}
                    onChange={e => setFormData({...formData, crime_type: e.target.value})}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select crime type</option>
                    <option value="theft">Theft</option>
                    <option value="assault">Assault</option>
                    <option value="fraud">Fraud</option>
                    <option value="burglary">Burglary</option>
                    <option value="drug">Drug Offense</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Arrest Date</label>
                  <input
                    type="date"
                    value={formData.arrest_date}
                    onChange={e => setFormData({...formData, arrest_date: e.target.value})}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Photos (Front/Side/Profile)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={e => setPhotos(Array.from(e.target.files || []))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                  />
                  {photos.length > 0 && (
                    <div className="mt-2 text-sm text-zinc-600">
                      {photos.length} photo(s) selected
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Criminal'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Face Recognition */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 mb-6">Advanced Face Recognition</h2>
            
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMultipleAngles}
                  onChange={e => setUseMultipleAngles(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-zinc-700">
                  Use Multiple Angles (Higher Accuracy)
                </span>
              </label>
              <p className="text-xs text-zinc-500 mt-1">
                Upload multiple photos from different angles for 95%+ accuracy
              </p>
            </div>
            
            <form onSubmit={handleFaceRecognition} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {useMultipleAngles ? 'Suspect Photos (Front, Side, Profile)' : 'Suspect Photo'}
                </label>
                <input
                  type="file"
                  multiple={useMultipleAngles}
                  accept="image/*"
                  onChange={e => {
                    if (useMultipleAngles) {
                      setSuspectPhotos(Array.from(e.target.files || []));
                    } else {
                      setSuspectPhoto(e.target.files?.[0] || null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                />
                {useMultipleAngles && suspectPhotos.length > 0 && (
                  <div className="mt-2 text-sm text-zinc-600">
                    {suspectPhotos.length} photo(s) selected - Recommended: 3 angles (front, side, profile)
                  </div>
                )}
                {!useMultipleAngles && suspectPhoto && (
                  <div className="mt-2 text-sm text-zinc-600">
                    Selected: {suspectPhoto.name}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || (useMultipleAngles ? suspectPhotos.length === 0 : !suspectPhoto)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : `Analyze Face${useMultipleAngles ? 's' : ''}`}
              </button>
            </form>

            {faceMatches.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Face Matches ({faceMatches.length})</h3>
                <div className="space-y-3">
                  {faceMatches.map((match, index) => (
                    <div key={`${match.criminal_id}-${match.angle || 'unknown'}-${index}`} className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div className="flex items-center gap-4">
                        {/* Criminal Photo */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-zinc-200">
                          {match.imageData ? (
                            <img 
                              src={match.imageData}
                              alt={`${match.full_name} - ${match.angle || 'photo'}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-500">No Photo</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Match Details */}
                        <div className="flex-1">
                          <p className="font-medium text-zinc-900">{match.full_name}</p>
                          <p className="text-sm text-zinc-600">Case: {match.case_id}</p>
                          <p className="text-sm text-zinc-600">Photo: {match.angle || 'front'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm font-bold text-green-600">Match Score: {(match.similarity ? (match.similarity * 100).toFixed(1) : '0.0')}%</p>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              (match.similarity && match.similarity > 0.9) ? 'bg-purple-100 text-purple-800' :
                              (match.similarity && match.similarity > 0.8) ? 'bg-blue-100 text-blue-800' :
                              (match.similarity && match.similarity > 0.7) ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {(match.similarity && match.similarity > 0.9) ? 'Very High' :
                               (match.similarity && match.similarity > 0.8) ? 'High' :
                               (match.similarity && match.similarity > 0.7) ? 'Medium' : 'Low'} Confidence
                            </span>
                          </div>
                        </div>
                        
                        {/* Action Button */}
                        <button
                          onClick={() => fetchCriminalDetails(match.criminal_id)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Criminal Database */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-900">Criminal Database</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search criminals..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={searchCriminals}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {criminals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-400">No criminals found</p>
                  <p className="text-xs text-zinc-400 mt-1">Try adding a criminal or check your connection</p>
                </div>
              ) : (
                criminals.map((criminal) => (
                  <div key={criminal.id} className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 hover:bg-zinc-100">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => fetchCriminalDetails(criminal.id)}
                      >
                        <p className="font-medium text-zinc-900">{criminal.full_name}</p>
                        <p className="text-sm text-zinc-600">Case: {criminal.case_id}</p>
                        <p className="text-sm text-zinc-600">{criminal.crime_type}</p>
                        {criminal.alias_name && (
                          <p className="text-sm text-zinc-500">Alias: {criminal.alias_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchCriminalDetails(criminal.id);
                          }}
                          className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          title="View Details"
                        >
                          <User className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCriminal(criminal.id);
                          }}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          title="Delete Criminal"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Criminal Details Modal */}
      {selectedCriminal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
             onClick={() => setSelectedCriminal(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Criminal Details</h2>
              <button
                onClick={() => setSelectedCriminal(null)}
                className="p-2 bg-zinc-600 text-white rounded-lg hover:bg-zinc-700"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Case ID</p>
                    <p className="text-zinc-900">{selectedCriminal.case_id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Full Name</p>
                    <p className="text-zinc-900">{selectedCriminal.full_name}</p>
                  </div>
                  {selectedCriminal.alias_name && (
                    <div>
                      <p className="text-sm font-medium text-zinc-700">Alias Name</p>
                      <p className="text-zinc-900">{selectedCriminal.alias_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Crime Type</p>
                    <p className="text-zinc-900">{selectedCriminal.crime_type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Arrest Date</p>
                    <p className="text-zinc-900">{selectedCriminal.arrest_date || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Photos</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedCriminal.photos.map((photo) => (
                    <div key={`photo-${photo.id}-${photo.angle}`} className="text-center">
                      {photo.imageData ? (
                        <img 
                          src={photo.imageData}
                          alt={`${photo.angle} view`}
                          className="w-full h-32 object-cover rounded-lg border border-zinc-200"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-200 flex items-center justify-center rounded-lg border border-zinc-200">
                          <span className="text-sm text-gray-500">Photo Error</span>
                        </div>
                      )}
                      <p className="text-sm text-zinc-600 mt-2 capitalize">{photo.angle}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CriminalManagement;
