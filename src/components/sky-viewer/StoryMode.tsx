// src/components/sky-viewer/StoryMode.tsx
import React, { useEffect, useState, useCallback } from "react";
import { STAR_NAMES, getStarName, toCartesian, SCENE_CONFIG } from "./SkyViewer";
import type { Star } from "../../types/star";

interface StoryModeProps {
  stars: Star[]; // Changed from starsByName to stars
  play: boolean;
  setFlyToTarget: (t: {x:number;y:number;z:number} | null) => void;
}

// Helper function to find star by name
const findStarByName = (stars: Star[], targetName: string): Star | null => {
  const hipNumber = Object.entries(STAR_NAMES).find(([_, name]) => name === targetName)?.[0];
  if (hipNumber) {
    const star = stars.find(star => star.hip === parseInt(hipNumber));
    if (star) return star;
  }
  return null;
};

// Enhanced keyframes
const keyframes = [
  { 
    name: "Sirius", 
    text: "Sirius — brightest star in our night sky",
    subtitle: "The Dog Star, 8.6 light-years away"
  },
  { 
    name: "Betelgeuse", 
    text: "Betelgeuse — red supergiant in Orion",
    subtitle: "A massive star nearing the end of its life"
  },
  { 
    name: "Vega", 
    text: "Vega — the summer triangle's brightest star",
    subtitle: "Once the northern pole star, will be again"
  },
  { 
    name: "Polaris", 
    text: "Polaris — our current North Star",
    subtitle: "The reliable guide for navigation"
  }
];

export default function StoryMode({ stars, play, setFlyToTarget }: StoryModeProps) {
  const [step, setStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [availableStars, setAvailableStars] = useState<string[]>([]);

  // Check which stars are available
  useEffect(() => {
    const available = keyframes
      .map(kf => kf.name)
      .filter(name => findStarByName(stars, name) !== null);
    setAvailableStars(available);
    console.log(`StoryMode: Found ${available.length} available stars:`, available);
  }, [stars]);

  // Handle story progression
  const navigateToStar = useCallback((starName: string) => {
    const star = findStarByName(stars, starName);
    if (star && star.dist_pc != null) {
      setIsAnimating(true);
      const [x, y, z] = toCartesian(star.ra, star.dec, star.dist_pc);
      setFlyToTarget({ x, y, z: z + SCENE_CONFIG.CLICK_ZOOM_OFFSET });
      setTimeout(() => setIsAnimating(false), 1000);
    }
  }, [stars, setFlyToTarget]);

  useEffect(() => {
    if (!play) { 
      setStep(0);
      setIsAnimating(false);
      return; 
    }
    
    if (step >= keyframes.length) return;
    
    const kf = keyframes[step];
    if (availableStars.includes(kf.name)) {
      navigateToStar(kf.name);
    }
    
    const timeout = setTimeout(() => setStep(s => s + 1), 4500);
    return () => clearTimeout(timeout);
  }, [play, step, availableStars, navigateToStar]);

  const handleSkip = useCallback(() => {
    if (step < keyframes.length - 1) {
      setStep(step + 1);
    }
  }, [step]);

  if (!play || step >= keyframes.length) return null;

  const currentKeyframe = keyframes[step];
  const starExists = availableStars.includes(currentKeyframe.name);

  return (
    <>
      {/* Progress indicator */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: 1000
      }}>
        {Array.from({ length: keyframes.length }, (_, i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: i === step ? '#64b5f6' : 'rgba(100, 181, 246, 0.3)',
              transition: 'background-color 0.3s ease'
            }}
          />
        ))}
      </div>
      
      {/* Main story panel */}
      <div style={{
        position: 'absolute', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        bottom: '20px', 
        maxWidth: '500px',
        margin: '0 20px'
      }}>
        <div style={{
          padding: '16px 20px', 
          background: 'rgba(0, 0, 20, 0.95)',
          border: '1px solid rgba(100, 181, 246, 0.5)',
          borderRadius: '12px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          transform: isAnimating ? 'scale(1.05)' : 'scale(1)'
        }}>
          {!starExists && (
            <div style={{
              fontSize: '12px',
              color: '#ff9800',
              marginBottom: '8px',
              opacity: 0.8
            }}>
              ⚠ Star not found in current dataset
            </div>
          )}
          
          <div style={{ 
            fontSize: '18px', 
            fontWeight: '600',
            color: starExists ? '#64b5f6' : '#90a4ae',
            marginBottom: currentKeyframe.subtitle ? '6px' : '0',
            lineHeight: 1.3
          }}>
            {currentKeyframe.text}
          </div>
          
          {currentKeyframe.subtitle && (
            <div style={{ 
              fontSize: '14px', 
              color: '#90a4ae',
              fontStyle: 'italic',
              marginBottom: '12px'
            }}>
              {currentKeyframe.subtitle}
            </div>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            marginTop: '12px'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64b5f6',
              opacity: 0.8
            }}>
              {step + 1} of {keyframes.length}
            </div>
            
            <button
              onClick={handleSkip}
              style={{
                background: 'rgba(100, 181, 246, 0.1)',
                border: '1px solid rgba(100, 181, 246, 0.3)',
                borderRadius: '6px',
                color: '#64b5f6',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(100, 181, 246, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(100, 181, 246, 0.1)';
              }}
            >
              Skip →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
