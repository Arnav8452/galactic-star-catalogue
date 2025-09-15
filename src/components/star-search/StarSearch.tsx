// src/components/star-search/StarSearch.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { STAR_NAMES, getStarName, toCartesian, SCENE_CONFIG } from "../sky-viewer/SkyViewer";
import type { Star } from "../../types/star";

interface StarSearchProps {
  stars: Star[];
  onStarFound: (star: Star) => void;
  setFlyToTarget: (target: { x: number; y: number; z: number; lookAt?: [number, number, number] } | null) => void;
  isVisible?: boolean;
  onClose?: () => void;
}

interface SearchResult {
  star: Star;
  matchType: 'name' | 'hip' | 'partial';
  displayName: string;
}

const StarSearch: React.FC<StarSearchProps> = ({ 
  stars, 
  onStarFound, 
  setFlyToTarget, 
  isVisible = true, 
  onClose 
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search logic
  const searchStars = useCallback((searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Check if query is a HIP number
    const hipNumber = parseInt(query.replace(/^hip\s*/i, ''));
    if (!isNaN(hipNumber)) {
      const star = stars.find(s => s.hip === hipNumber);
      if (star) {
        const starName = getStarName(star.hip);
        results.push({
          star,
          matchType: 'hip',
          displayName: starName ? `${starName} (HIP ${star.hip})` : `HIP ${star.hip}`
        });
      }
    }

    // Search by star name
    for (const star of stars) {
      const starName = getStarName(star.hip);
      if (starName) {
        const lowerName = starName.toLowerCase();
        if (lowerName === query) {
          // Exact match
          results.unshift({
            star,
            matchType: 'name',
            displayName: starName
          });
        } else if (lowerName.includes(query) && query.length >= 2) {
          // Partial match
          results.push({
            star,
            matchType: 'partial',
            displayName: starName
          });
        }
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.star.hip === result.star.hip)
    );

    return uniqueResults.slice(0, 10);
  }, [stars]);

  // Handle search input changes
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    setIsSearching(true);
    
    const searchResults = searchStars(value);
    setResults(searchResults);
    setShowResults(value.length > 0);
    setIsSearching(false);
  }, [searchStars]);

  // Handle star selection with proper centering
  const handleStarSelect = useCallback((star: Star) => {
    if (!star.dist_pc) return;

    setSelectedStar(star);
    onStarFound(star);
    
    // Calculate star's exact position
    const [x, y, z] = toCartesian(star.ra, star.dec, star.dist_pc);
    
    // Position camera to look directly at the star with proper centering
    const cameraDistance = SCENE_CONFIG.CLICK_ZOOM_OFFSET;
    
    // Set flyToTarget with lookAt pointing directly at the star for perfect centering
    setFlyToTarget({ 
      x, 
      y, 
      z: z + cameraDistance,
      lookAt: [x, y, z] // This ensures the star appears in the center of the viewport
    });
    
    // Update search display
    const starName = getStarName(star.hip);
    setQuery(starName || `HIP ${star.hip}` || "");
    setShowResults(false);
  }, [onStarFound, setFlyToTarget]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      setQuery("");
      onClose?.();
    } else if (e.key === 'Enter' && results.length > 0) {
      handleStarSelect(results[0].star);
    }
  }, [results, handleStarSelect, onClose]);

  // Focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      maxWidth: '400px',
      width: '100%'
    }}>
      {/* Search Input */}
      <div style={{
        position: 'relative',
        marginBottom: showResults ? '8px' : '0'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by star name or HIP number..."
          style={{
            width: '100%',
            padding: '12px 16px',
            paddingRight: '40px',
            background: 'rgba(0, 0, 20, 0.95)',
            border: '1px solid rgba(100, 181, 246, 0.5)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            fontFamily: 'system-ui, sans-serif',
            outline: 'none',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
          onFocus={() => setShowResults(query.length > 0)}
        />
        
        {/* Search Icon */}
        <div style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#64b5f6',
          pointerEvents: 'none'
        }}>
          🔍
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '40px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#90a4ae',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '0',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <div style={{
          background: 'rgba(0, 0, 20, 0.95)',
          border: '1px solid rgba(100, 181, 246, 0.3)',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {isSearching ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#90a4ae' }}>
              Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((result, index) => (
              <div
                key={`${result.star.hip}-${index}`}
                onClick={() => handleStarSelect(result.star)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: index < results.length - 1 ? '1px solid rgba(100, 181, 246, 0.1)' : 'none',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(100, 181, 246, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{
                  color: result.matchType === 'name' ? '#64b5f6' : '#ffffff',
                  fontWeight: result.matchType === 'name' ? '600' : '400',
                  marginBottom: '4px'
                }}>
                  {result.displayName}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#90a4ae',
                  display: 'flex',
                  gap: '12px'
                }}>
                  {result.star.vmag != null && (
                    <span>Mag: {result.star.vmag.toFixed(2)}</span>
                  )}
                  {result.star.dist_pc != null && (
                    <span>Dist: {result.star.dist_pc.toFixed(1)} pc</span>
                  )}
                </div>
              </div>
            ))
          ) : query.length > 0 ? (
            <div style={{ 
              padding: '16px', 
              textAlign: 'center', 
              color: '#90a4ae' 
            }}>
              No stars found for "{query}"
            </div>
          ) : null}
        </div>
      )}

      {/* Selected Star Details Panel */}
      {selectedStar && (
        <div style={{
          marginTop: '12px',
          background: 'rgba(0, 0, 20, 0.95)',
          border: '1px solid rgba(100, 181, 246, 0.5)',
          borderRadius: '8px',
          padding: '16px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <div>
              <h3 style={{
                color: '#64b5f6',
                margin: '0 0 4px 0',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                {getStarName(selectedStar.hip) || `HIP ${selectedStar.hip}` || "Unknown Star"}
              </h3>
              {getStarName(selectedStar.hip) && selectedStar.hip && (
                <div style={{ fontSize: '12px', color: '#90a4ae' }}>
                  HIP {selectedStar.hip}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedStar(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#90a4ae',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
            {selectedStar.vmag != null && (
              <div>
                <span style={{ color: '#90a4ae' }}>Magnitude:</span>
                <div style={{ color: '#ffffff', fontWeight: '500' }}>{selectedStar.vmag.toFixed(2)}</div>
              </div>
            )}
            {selectedStar.dist_pc != null && (
              <div>
                <span style={{ color: '#90a4ae' }}>Distance:</span>
                <div style={{ color: '#ffffff', fontWeight: '500' }}>{selectedStar.dist_pc.toFixed(1)} pc</div>
              </div>
            )}
            {selectedStar.temp_k != null && (
              <div>
                <span style={{ color: '#90a4ae' }}>Temperature:</span>
                <div style={{ color: '#ffffff', fontWeight: '500' }}>{Math.round(selectedStar.temp_k)} K</div>
              </div>
            )}
            {selectedStar.sp_type && (
              <div>
                <span style={{ color: '#90a4ae' }}>Spectral Type:</span>
                <div style={{ color: '#ffffff', fontWeight: '500' }}>{selectedStar.sp_type}</div>
              </div>
            )}
            {selectedStar.bv != null && (
              <div>
                <span style={{ color: '#90a4ae' }}>B-V Color:</span>
                <div style={{ color: '#ffffff', fontWeight: '500' }}>{selectedStar.bv.toFixed(3)}</div>
              </div>
            )}
            {selectedStar.absmag != null && (
              <div>
                <span style={{ color: '#90a4ae' }}>Absolute Mag:</span>
                <div style={{ color: '#ffffff', fontWeight: '500' }}>{selectedStar.absmag.toFixed(2)}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', fontSize: '12px', color: '#90a4ae' }}>
            RA: {selectedStar.ra.toFixed(4)}° | Dec: {selectedStar.dec.toFixed(4)}°
          </div>
        </div>
      )}
    </div>
  );
};

export default StarSearch;
