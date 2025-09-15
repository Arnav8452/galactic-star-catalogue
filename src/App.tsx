// src/App.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import SkyViewer from "./components/sky-viewer/SkyViewer";
import StoryMode from "./components/sky-viewer/StoryMode";
import StarSearch from "./components/star-search/StarSearch";
import SearchToggle from "./components/star-search/SearchToggle";
import type { Star } from "./types/star";

async function fetchSample() {
  try {
    const res = await fetch("/data/hipparcos_sample.ndjson");
    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);
    const rows = lines.map(l => JSON.parse(l) as Star);
    return rows;
  } catch (e) {
    console.error("Failed to load sample:", e);
    return [];
  }
}

export default function App() {
  // State management
  const [stars, setStars] = useState<Star[]>([]);
  const [selected, setSelected] = useState<Star | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{x:number;y:number;z:number} | null>(null);
  const [playStory, setPlayStory] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load star data
  useEffect(() => {
    fetchSample().then((rows) => {
      console.log("Loaded stars:", rows.length);
      setStars(rows);
      setIsLoading(false);
    });
  }, []);

  // Event handlers
  const handleStarClick = useCallback((star: Star) => {
    console.log("Clicked star", star.hip);
    setSelected(star);
    setIsSearchVisible(false); // Close search when star is clicked
  }, []);

  const handleStarFound = useCallback((star: Star) => {
    setSelected(star);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchVisible(!isSearchVisible);
    if (playStory) {
      setPlayStory(false); // Stop story when opening search
    }
  }, [isSearchVisible, playStory]);

  const toggleStoryMode = useCallback(() => {
    setPlayStory(!playStory);
    if (isSearchVisible) {
      setIsSearchVisible(false); // Close search when starting story
    }
  }, [playStory, isSearchVisible]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchVisible(false);
        setPlayStory(false);
        setSelected(null);
      } else if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        toggleSearch();
      } else if (e.key === 't' && e.ctrlKey) {
        e.preventDefault();
        toggleStoryMode();
      } else if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        setShowDebug(!showDebug);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleSearch, toggleStoryMode, showDebug]);

  // Debug info
  const info = useMemo(() => {
    const namedStars = stars.filter(star => {
      const hipNumbers = [32349, 30438, 71683, 69673, 91262, 24608, 24436, 37279, 7588, 27989]; // Sample from STAR_NAMES
      return star.hip && hipNumbers.includes(star.hip);
    }).length;

    return {
      count: stars.length,
      namedCount: namedStars,
      someHip: stars.length ? stars[0].hip : null,
      brightestMag: stars.length ? Math.min(...stars.filter(s => s.vmag != null).map(s => s.vmag!)) : null,
    };
  }, [stars]);

  if (isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
        color: '#64b5f6',
        fontSize: '18px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(100, 181, 246, 0.3)',
            borderTopColor: '#64b5f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          Loading Hipparcos catalog...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <main style={{ 
      width: "100vw", 
      height: "100vh", 
      background: "#000", 
      position: "relative", 
      overflow: "hidden" 
    }}>
      {/* Main 3D Star Viewer */}
      <SkyViewer
        stars={stars}
        onStarClick={handleStarClick}
        flyToTarget={flyToTarget}
        setFlyToTarget={setFlyToTarget}
        selectedStar={selected}
      />

      {/* Search Toggle Button */}
      <SearchToggle 
        onClick={toggleSearch}
        isSearchVisible={isSearchVisible}
      />

      {/* Story Mode Toggle Button */}
      <button
        onClick={toggleStoryMode}
        style={{
          position: 'absolute',
          top: '20px',
          right: '80px',
          background: 'rgba(0, 0, 20, 0.95)',
          border: '1px solid rgba(100, 181, 246, 0.5)',
          borderRadius: '8px',
          padding: '12px',
          color: playStory ? '#ff6b47' : '#64b5f6',
          cursor: 'pointer',
          fontSize: '16px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.2s ease',
          zIndex: 999
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(100, 181, 246, 0.1)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 20, 0.95)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={playStory ? "Stop story tour" : "Start story tour"}
      >
        {playStory ? '⏹️' : '🎬'}
      </button>

      {/* Search Component */}
      <StarSearch
        stars={stars}
        onStarFound={handleStarFound}
        setFlyToTarget={setFlyToTarget}
        isVisible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
      />

      {/* Story Mode Component */}
      <StoryMode
        stars={stars}
        play={playStory}
        setFlyToTarget={setFlyToTarget}
      />

      {/* Enhanced Debug Panel */}
      {showDebug && (
        <div style={{ 
          position: "absolute", 
          left: 12, 
          top: 12, 
          zIndex: 40, 
          background: "rgba(0, 0, 20, 0.95)",
          border: "1px solid rgba(100, 181, 246, 0.3)",
          borderRadius: "8px",
          padding: "12px 16px",
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          minWidth: "200px"
        }}>
          <div style={{ 
            color: "#64b5f6", 
            fontWeight: "600", 
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <span>📊 Catalog Info</span>
            <button
              onClick={() => setShowDebug(false)}
              style={{
                background: "none",
                border: "none",
                color: "#90a4ae",
                cursor: "pointer",
                fontSize: "12px",
                padding: "2px"
              }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ color: "#ffffff", marginBottom: "4px" }}>
            <span style={{ color: "#90a4ae" }}>Total stars:</span> <strong>{info.count.toLocaleString()}</strong>
          </div>
          <div style={{ color: "#ffffff", marginBottom: "4px" }}>
            <span style={{ color: "#90a4ae" }}>Named stars:</span> <strong>{info.namedCount}</strong>
          </div>
          <div style={{ color: "#ffffff", marginBottom: "8px" }}>
            <span style={{ color: "#90a4ae" }}>Brightest mag:</span> <strong>{info.brightestMag?.toFixed(2) ?? "—"}</strong>
          </div>
          
          <div style={{ 
            display: "flex", 
            gap: "8px", 
            marginBottom: selected ? "12px" : "0"
          }}>
            <button 
              onClick={toggleStoryMode} 
              style={{ 
                padding: "6px 10px", 
                background: playStory ? "rgba(255, 107, 71, 0.2)" : "rgba(100, 181, 246, 0.2)", 
                color: playStory ? "#ff6b47" : "#64b5f6",
                border: "1px solid " + (playStory ? "rgba(255, 107, 71, 0.3)" : "rgba(100, 181, 246, 0.3)"), 
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "inherit",
                transition: "all 0.2s ease"
              }}
            >
              {playStory ? "⏹ Stop Tour" : "🎬 Story Tour"}
            </button>
            <button 
              onClick={toggleSearch}
              style={{ 
                padding: "6px 10px", 
                background: isSearchVisible ? "rgba(255, 107, 71, 0.2)" : "rgba(100, 181, 246, 0.2)", 
                color: isSearchVisible ? "#ff6b47" : "#64b5f6",
                border: "1px solid " + (isSearchVisible ? "rgba(255, 107, 71, 0.3)" : "rgba(100, 181, 246, 0.3)"), 
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "inherit",
                transition: "all 0.2s ease"
              }}
            >
              {isSearchVisible ? "✕ Close" : "🔍 Search"}
            </button>
          </div>

          {selected && (
            <div style={{ 
              borderTop: "1px solid rgba(100, 181, 246, 0.2)",
              paddingTop: "8px",
              marginTop: "8px"
            }}>
              <div style={{ color: "#64b5f6", fontWeight: "600", marginBottom: "4px" }}>
                Selected Star
              </div>
              <div style={{ color: "#ffffff", fontSize: "12px", marginBottom: "2px" }}>
                <span style={{ color: "#90a4ae" }}>HIP:</span> {selected.hip || "—"}
              </div>
              <div style={{ color: "#ffffff", fontSize: "12px", marginBottom: "2px" }}>
                <span style={{ color: "#90a4ae" }}>Magnitude:</span> {selected.vmag?.toFixed(2) ?? "—"}
              </div>
              <div style={{ color: "#ffffff", fontSize: "12px", marginBottom: "6px" }}>
                <span style={{ color: "#90a4ae" }}>Distance:</span> {selected.dist_pc?.toFixed(1) ?? "—"} pc
              </div>
              <button 
                onClick={() => setSelected(null)} 
                style={{ 
                  padding: "4px 8px",
                  background: "rgba(144, 164, 174, 0.2)",
                  color: "#90a4ae",
                  border: "1px solid rgba(144, 164, 174, 0.3)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "inherit"
                }}
              >
                Clear Selection
              </button>
            </div>
          )}

          <div style={{ 
            fontSize: "11px", 
            color: "#90a4ae", 
            marginTop: "12px",
            borderTop: "1px solid rgba(100, 181, 246, 0.1)",
            paddingTop: "8px"
          }}>
            <div>Ctrl+S: Search | Ctrl+T: Tour</div>
            <div>Ctrl+D: Toggle debug | ESC: Close</div>
          </div>
        </div>
      )}

      {/* Instructions Panel (when not showing other UI) */}
      {!isSearchVisible && !playStory && !showDebug && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'rgba(0, 0, 20, 0.8)',
          border: '1px solid rgba(100, 181, 246, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#90a4ae',
          fontSize: '12px',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '300px'
        }}>
          <div style={{ color: '#64b5f6', marginBottom: '8px', fontWeight: '600' }}>
            🌟 Star Explorer Controls
          </div>
          <div>• Click and drag to rotate view</div>
          <div>• Scroll to zoom in/out</div>
          <div>• Click stars for details</div>
          <div>• Press Ctrl+S for search</div>
          <div>• Press Ctrl+T for story tour</div>
          <div>• Press Ctrl+D for debug info</div>
        </div>
      )}
    </main>
  );
}
