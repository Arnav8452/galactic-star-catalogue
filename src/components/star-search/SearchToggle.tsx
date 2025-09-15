// src/components/star-search/SearchToggle.tsx
import React from "react";

interface SearchToggleProps {
  onClick: () => void;
  isSearchVisible: boolean;
}

const SearchToggle: React.FC<SearchToggleProps> = ({ onClick, isSearchVisible }) => (
  <button
    onClick={onClick}
    style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'rgba(0, 0, 20, 0.95)',
      border: '1px solid rgba(100, 181, 246, 0.5)',
      borderRadius: '8px',
      padding: '12px',
      color: '#64b5f6',
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
    title={isSearchVisible ? "Close search" : "Search stars"}
  >
    {isSearchVisible ? '✕' : '🔍'}
  </button>
);

export default SearchToggle;
