// src/components/sky-viewer/SkyViewer.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, OrbitControls, Stars, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Star } from "../../types/star";
import CameraControls, { FlyTarget } from "./CameraControls";

interface SkyViewerProps {
  stars: Star[];
  onStarClick?: (star: Star) => void;
  flyToTarget?: FlyTarget | null;
  setFlyToTarget?: (t: FlyTarget | null) => void;
  selectedStar?: Star | null;
  showConstellations?: boolean;
  showGrid?: boolean;
  qualityLevel?: 'low' | 'medium' | 'high';
}

// Expanded star names with more comprehensive catalog
export const STAR_NAMES: Record<number, string> = {
  // Brightest stars (magnitude < 1.0)
  32349: "Sirius", 30438: "Canopus", 71683: "Rigil Kentaurus", 69673: "Arcturus",
  91262: "Vega", 24608: "Capella", 24436: "Rigel", 37279: "Procyon",
  7588: "Achernar", 27989: "Betelgeuse", 68702: "Hadar", 97649: "Altair",
  60718: "Acrux", 21421: "Aldebaran", 65474: "Spica", 80763: "Antares",
  37826: "Pollux", 113368: "Fomalhaut", 62434: "Mimosa", 102098: "Deneb",
  
  // Navigation stars
  11767: "Polaris", 54061: "Dubhe", 67301: "Alkaid", 62956: "Alioth",
  50583: "Phecda", 59774: "Merak", 58001: "Megrez", 95418: "Sadr",
  
  // Prominent named stars
  49669: "Regulus", 33579: "Adhara", 36850: "Castor", 61084: "Gacrux",
  85927: "Shaula", 25336: "Bellatrix", 25428: "Elnath", 45238: "Miaplacidus",
  26311: "Alnilam", 109268: "Alnair", 26727: "Alnitak", 31681: "Alhena",
  46390: "Alphard", 15863: "Mirfak", 95947: "Alderamin", 677: "Alpheratz",
  8645: "Schedar", 3179: "Caph", 17702: "Algol", 39953: "Menkalinan",
  
  // Additional catalog
  34444: "Wezen", 100453: "Gienah", 14135: "Menkar", 68933: "Mizar",
  113881: "Acamar", 9884: "Achird", 85667: "Alwaid", 72607: "Izar",
  84012: "Kochab", 86032: "Alphecca", 80816: "Unukalhai", 72105: "Zubenelgenubi",
  76267: "Zubeneschamali", 90185: "Nunki", 100751: "Altais", 746: "Enif",
  
  // Double stars and variables
  112158: "Hamal", 9640: "Almach", 25930: "Mintaka", 90496: "Kaus Australis",
  85696: "Etamin", 57632: "Cor Caroli", 78401: "Rasalgethi", 88635: "Sheliak"
};

export function getStarName(hip?: number): string | null {
  if (!hip) return null;
  return STAR_NAMES[hip] || null;
}

// ✅ Enhanced scene configuration with better zoom settings
export const SCENE_CONFIG = {
  STAR_DISTANCE_SCALE: 1.2,
  MAX_VISIBLE_MAGNITUDE: 12,
  MIN_STAR_SIZE: 0.2,
  MAX_STAR_SIZE: 12.0,
  BASE_STAR_SIZE: 4.5,
  HOVER_GLOW_SIZE_MULTIPLIER: 1.8,
  CLICK_ZOOM_OFFSET: 200, // ✅ Increased from 45 to 200 for better zoom level
  BRIGHTNESS_BOOST: 1.4,
  SELECTED_STAR_COLOR: 0xff6b47,
  NAMED_STAR_BOOST: 1.3,
  CONSTELLATION_COLOR: 0x4a90e2,
  GRID_COLOR: 0x2c3e50,
  // Quality-based settings
  QUALITY_SETTINGS: {
    low: { maxStars: 5000, spriteSize: 64, backgroundStars: 1000 },
    medium: { maxStars: 15000, spriteSize: 128, backgroundStars: 2000 },
    high: { maxStars: 50000, spriteSize: 256, backgroundStars: 3000 }
  }
} as const;

// Enhanced stellar color mapping with better accuracy
function getEnhancedStarColor(temp_k?: number | null, bv?: number | null, sp_type?: string | null): THREE.Color {
  // Use spectral type if available for more accuracy
  if (sp_type) {
    const spectral = sp_type.charAt(0).toUpperCase();
    switch (spectral) {
      case 'O': return new THREE.Color(0x9bb0ff); // Blue
      case 'B': return new THREE.Color(0xaabfff); // Blue-white
      case 'A': return new THREE.Color(0xcad7ff); // White
      case 'F': return new THREE.Color(0xf8f7ff); // Yellow-white
      case 'G': return new THREE.Color(0xfff4ea); // Yellow (Sun-like)
      case 'K': return new THREE.Color(0xffd2a1); // Orange
      case 'M': return new THREE.Color(0xffad51); // Red
    }
  }
  
  // Enhanced temperature-based coloring
  if (temp_k != null && !Number.isNaN(temp_k)) {
    const t = Math.max(1000, Math.min(50000, temp_k));
    
    if (t < 2000) return new THREE.Color(0xff4500); // Deep red
    if (t < 3000) return new THREE.Color(0xff6b47); // Red dwarf
    if (t < 3700) return new THREE.Color(0xff8247); // Orange-red
    if (t < 4500) return new THREE.Color(0xffb347); // Orange
    if (t < 5200) return new THREE.Color(0xffd947); // Yellow-orange
    if (t < 6000) return new THREE.Color(0xfff5d6); // Yellow
    if (t < 7500) return new THREE.Color(0xffffff); // White
    if (t < 10000) return new THREE.Color(0xd6e5ff); // Blue-white
    if (t < 20000) return new THREE.Color(0xb3d1ff); // Blue
    if (t < 30000) return new THREE.Color(0x9bb5ff); // Hot blue
    return new THREE.Color(0x8da6ff); // Very hot blue
  }
  
  // Enhanced B-V color index mapping
  if (bv != null && !Number.isNaN(bv)) {
    if (bv > 1.8) return new THREE.Color(0xff4500); // Very red
    if (bv > 1.4) return new THREE.Color(0xff6b47); // Red
    if (bv > 1.0) return new THREE.Color(0xff8247); // Orange-red
    if (bv > 0.8) return new THREE.Color(0xffb347); // Orange
    if (bv > 0.6) return new THREE.Color(0xffd947); // Yellow-orange
    if (bv > 0.4) return new THREE.Color(0xfff5d6); // Yellow
    if (bv > 0.2) return new THREE.Color(0xffffff); // White
    if (bv > 0.0) return new THREE.Color(0xf0f8ff); // Blue-white
    if (bv > -0.2) return new THREE.Color(0xd6e5ff); // Light blue
    return new THREE.Color(0xb3d1ff); // Blue
  }
  
  return new THREE.Color(0xffffff); // Default white
}

export function toCartesian(ra: number, dec: number, dist: number): [number, number, number] {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const d = Math.max(0.1, dist) * SCENE_CONFIG.STAR_DISTANCE_SCALE;
  
  const x = d * Math.cos(decRad) * Math.cos(raRad);
  const y = d * Math.sin(decRad);
  const z = d * Math.cos(decRad) * Math.sin(raRad);
  
  return [x, y, z];
}

// Enhanced star sprite with quality options
function createAdvancedStarSprite(size: number = 128): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  
  const center = size / 2;
  const radius = center;
  
  // Clear canvas
  ctx.clearRect(0, 0, size, size);
  
  // Create main star body with multiple gradients
  const coreGrad = ctx.createRadialGradient(center, center, 0, center, center, radius * 0.15);
  coreGrad.addColorStop(0, "rgba(255,255,255,1.0)");
  coreGrad.addColorStop(1, "rgba(255,255,255,0.9)");
  
  const innerGrad = ctx.createRadialGradient(center, center, 0, center, center, radius * 0.4);
  innerGrad.addColorStop(0, "rgba(255,255,255,0.9)");
  innerGrad.addColorStop(0.5, "rgba(255,255,255,0.7)");
  innerGrad.addColorStop(1, "rgba(220,220,255,0.3)");
  
  const outerGrad = ctx.createRadialGradient(center, center, radius * 0.4, center, center, radius);
  outerGrad.addColorStop(0, "rgba(200,220,255,0.2)");
  outerGrad.addColorStop(0.6, "rgba(180,200,255,0.1)");
  outerGrad.addColorStop(1, "rgba(0,0,0,0)");
  
  // Draw gradients
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = innerGrad;
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);
  
  // Add diffraction spikes for bright stars
  if (size >= 128) {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, center * 0.2);
    ctx.lineTo(center, center * 1.8);
    ctx.moveTo(center * 0.2, center);
    ctx.lineTo(center * 1.8, center);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBAFormat;
  texture.needsUpdate = true;
  
  return texture;
}

// Coordinate grid component
const CoordinateGrid: React.FC<{ visible: boolean }> = ({ visible }) => {
  const gridRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (gridRef.current) {
      gridRef.current.visible = visible;
    }
  });
  
  if (!visible) return null;
  
  return (
    <group ref={gridRef}>
      {/* Equatorial grid */}
      <gridHelper 
        args={[2000, 24, SCENE_CONFIG.GRID_COLOR, SCENE_CONFIG.GRID_COLOR]} 
        rotation={[Math.PI / 2, 0, 0]} 
      />
      {/* Meridian lines */}
      <gridHelper 
        args={[2000, 12, SCENE_CONFIG.GRID_COLOR, SCENE_CONFIG.GRID_COLOR]} 
        rotation={[0, 0, Math.PI / 2]} 
      />
    </group>
  );
};

// Enhanced loading with progress
const LoadingState: React.FC<{ progress?: number }> = ({ progress = 0 }) => (
  <div 
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
      color: '#64b5f6',
      fontSize: '18px',
      fontFamily: 'system-ui, sans-serif',
      zIndex: 10
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div 
        style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(100, 181, 246, 0.2)',
          borderTopColor: '#64b5f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}
      />
      <div style={{ marginBottom: '10px' }}>Loading star catalog...</div>
      {progress > 0 && (
        <div style={{ fontSize: '14px', opacity: 0.8 }}>
          {Math.round(progress * 100)}% complete
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

// Enhanced tooltip with more information
interface StarTooltipProps {
  star: Star | null;
  position: { x: number; y: number };
}

const StarTooltip: React.FC<StarTooltipProps> = ({ star, position }) => {
  if (!star) return null;
  
  const starName = getStarName(star.hip);
  
  const getStarClass = (star: Star): string => {
    if (star.vmag == null) return "Unknown";
    if (star.vmag < 0) return "Exceptionally Bright";
    if (star.vmag < 1) return "Very Bright";
    if (star.vmag < 2) return "Bright";
    if (star.vmag < 3) return "Easily Visible";
    if (star.vmag < 4) return "Clearly Visible";
    if (star.vmag < 5) return "Faint";
    if (star.vmag < 6) return "Very Faint";
    return "Telescope Required";
  };
  
  const getDistanceInLY = (distPc?: number | null): string => {
    if (!distPc) return "Unknown";
    const ly = distPc * 3.26156;
    if (ly < 1) return `${(ly * 1000).toFixed(1)} mly`;
    if (ly < 100) return `${ly.toFixed(1)} ly`;
    if (ly < 1000) return `${Math.round(ly)} ly`;
    return `${(ly / 1000).toFixed(1)} kly`;
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        left: Math.min(position.x + 15, window.innerWidth - 300),
        top: Math.max(position.y - 10, 10),
        background: 'rgba(0, 0, 20, 0.95)',
        border: '1px solid rgba(100, 181, 246, 0.5)',
        borderRadius: '12px',
        padding: '16px 20px',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        maxWidth: '320px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(15px)',
        zIndex: 1000,
        pointerEvents: 'none',
        transform: 'translateY(-50%)'
      }}
    >
      <div style={{ 
        fontWeight: '700', 
        color: starName ? '#64b5f6' : '#90a4ae', 
        marginBottom: '8px',
        fontSize: starName ? '16px' : '15px',
        borderBottom: '1px solid rgba(100, 181, 246, 0.2)',
        paddingBottom: '8px'
      }}>
        {starName || `HIP ${star.hip}` || "Unnamed Star"}
      </div>
      
      {starName && star.hip && (
        <div style={{ fontSize: '12px', color: '#90a4ae', marginBottom: '12px' }}>
          Hipparcos {star.hip} • {getStarClass(star)}
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px' }}>
        {star.vmag != null && (
          <div>
            <div style={{ color: '#90a4ae', fontSize: '11px' }}>Magnitude</div>
            <div style={{ color: '#ffffff', fontWeight: '600' }}>{star.vmag.toFixed(2)}</div>
          </div>
        )}
        
        {star.dist_pc != null && (
          <div>
            <div style={{ color: '#90a4ae', fontSize: '11px' }}>Distance</div>
            <div style={{ color: '#ffffff', fontWeight: '600' }}>{getDistanceInLY(star.dist_pc)}</div>
          </div>
        )}
        
        {star.temp_k != null && (
          <div>
            <div style={{ color: '#90a4ae', fontSize: '11px' }}>Temperature</div>
            <div style={{ color: '#ffffff', fontWeight: '600' }}>{Math.round(star.temp_k).toLocaleString()} K</div>
          </div>
        )}
        
        {star.sp_type && (
          <div>
            <div style={{ color: '#90a4ae', fontSize: '11px' }}>Spectral Type</div>
            <div style={{ color: '#ffffff', fontWeight: '600' }}>{star.sp_type}</div>
          </div>
        )}
        
        {star.bv != null && (
          <div>
            <div style={{ color: '#90a4ae', fontSize: '11px' }}>B-V Color</div>
            <div style={{ color: '#ffffff', fontWeight: '600' }}>{star.bv.toFixed(3)}</div>
          </div>
        )}
        
        {star.absmag != null && (
          <div>
            <div style={{ color: '#90a4ae', fontSize: '11px' }}>Absolute Mag</div>
            <div style={{ color: '#ffffff', fontWeight: '600' }}>{star.absmag.toFixed(2)}</div>
          </div>
        )}
      </div>
      
      <div style={{ 
        marginTop: '12px', 
        fontSize: '11px', 
        color: '#70a4ae',
        borderTop: '1px solid rgba(100, 181, 246, 0.1)',
        paddingTop: '8px'
      }}>
        RA {star.ra.toFixed(4)}° • Dec {star.dec.toFixed(4)}°
      </div>
    </div>
  );
};

// Enhanced star glow with better effects
const StarGlow: React.FC<{ 
  star: Star; 
  type: 'hover' | 'selected';
}> = ({ star, type }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      if (type === 'hover') {
        const pulse = Math.sin(time * 4) * 0.15 + 1;
        meshRef.current.scale.setScalar(pulse);
      } else {
        const pulse = Math.sin(time * 2) * 0.25 + 1.3;
        meshRef.current.scale.setScalar(pulse);
        if (ringRef.current) {
          ringRef.current.rotation.z = time * 0.5;
        }
      }
    }
  });
  
  const [x, y, z] = toCartesian(star.ra, star.dec, star.dist_pc || 1);
  const baseSize = star.vmag ? Math.max(1.5, (6 - star.vmag) * 1.0) : 2.5;
  const glowSize = baseSize * (type === 'selected' ? 2.5 : SCENE_CONFIG.HOVER_GLOW_SIZE_MULTIPLIER);
  const glowColor = type === 'selected' ? SCENE_CONFIG.SELECTED_STAR_COLOR : 0x64b5f6;
  const opacity = type === 'selected' ? 0.3 : 0.15;
  
  return (
    <group position={[x, y, z]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[glowSize, 16, 12]} />
        <meshBasicMaterial 
          color={glowColor}
          opacity={opacity}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {type === 'selected' && (
        <mesh ref={ringRef}>
          <ringGeometry args={[glowSize * 1.5, glowSize * 1.7, 32]} />
          <meshBasicMaterial 
            color={glowColor}
            opacity={0.4}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};

// Enhanced performance stats
const PerformanceStats: React.FC<{ 
  starCount: number; 
  namedStars: number; 
  renderTime: number;
  fps: number;
  qualityLevel: string;
}> = ({ starCount, namedStars, renderTime, fps, qualityLevel }) => (
  <div style={{
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    background: 'rgba(0, 0, 20, 0.9)',
    border: '1px solid rgba(100, 181, 246, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '11px',
    color: '#90a4ae',
    fontFamily: 'monospace',
    minWidth: '160px',
    pointerEvents: 'none'
  }}>
    <div style={{ color: '#64b5f6', marginBottom: '6px', fontWeight: '600' }}>
      Performance ({qualityLevel})
    </div>
    <div>Stars: {starCount.toLocaleString()}</div>
    <div>Named: {namedStars}</div>
    <div>Render: {renderTime}ms</div>
    <div>FPS: {fps}</div>
  </div>
);

export default function SkyViewer({ 
  stars, 
  onStarClick, 
  flyToTarget, 
  setFlyToTarget, 
  selectedStar,
  showConstellations = false,
  showGrid = false,
  qualityLevel = 'medium'
}: SkyViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState<string>('default');
  const [showStats, setShowStats] = useState(false);
  const [renderTime, setRenderTime] = useState(0);
  const [fps, setFps] = useState(60);
  
  const qualitySettings = SCENE_CONFIG.QUALITY_SETTINGS[qualityLevel];
  const spriteTex = useMemo(() => createAdvancedStarSprite(qualitySettings.spriteSize), [qualitySettings.spriteSize]);
  const pointRef = useRef<any>(null);
  
  // FPS counter
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    
    const updateFps = () => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(updateFps);
    };
    
    const rafId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(rafId);
  }, []);
  
  const { positions, colors, sizes, starRefs } = useMemo(() => {
    const startTime = performance.now();
    setLoadingProgress(0.1);
    
    const posArr: number[] = [];
    const colorArr: number[] = [];
    const sizeArr: number[] = [];
    const refs: Star[] = [];
    
    if (!stars || stars.length === 0) {
      setIsLoading(false);
      return {
        positions: new Float32Array(),
        colors: new Float32Array(), 
        sizes: new Float32Array(),
        starRefs: [] as Star[],
      };
    }
    
    // Sort stars by magnitude for better rendering (bright stars first)
    const sortedStars = [...stars]
      .filter(st => st && st.dist_pc != null && (st.vmag == null || st.vmag <= SCENE_CONFIG.MAX_VISIBLE_MAGNITUDE))
      .sort((a, b) => (a.vmag || 10) - (b.vmag || 10))
      .slice(0, qualitySettings.maxStars);
    
    setLoadingProgress(0.3);
    
    for (let i = 0; i < sortedStars.length; i++) {
      const st = sortedStars[i];
      
      // Progress update
      if (i % 1000 === 0) {
        setLoadingProgress(0.3 + (i / sortedStars.length) * 0.6);
      }
      
      const [x, y, z] = toCartesian(st.ra, st.dec, st.dist_pc!);
      posArr.push(x, y, z);
      
      const starColor = getEnhancedStarColor(st.temp_k, st.bv, st.sp_type);
      let brightnessFactor = Math.max(0.3, 1 - ((st.vmag ?? 8) + 1) / 15) * SCENE_CONFIG.BRIGHTNESS_BOOST;
      
      // Enhanced brightness calculation
      const isNamed = getStarName(st.hip);
      if (isNamed) {
        brightnessFactor *= SCENE_CONFIG.NAMED_STAR_BOOST;
      }
      
      // Boost very bright stars
      if (st.vmag != null && st.vmag < 0) {
        brightnessFactor *= 1.5;
      }
      
      colorArr.push(
        starColor.r * brightnessFactor,
        starColor.g * brightnessFactor,
        starColor.b * brightnessFactor
      );
      
      // Enhanced size calculation
      const magnitude = st.vmag ?? 8;
      let size = Math.max(
        SCENE_CONFIG.MIN_STAR_SIZE,
        Math.min(SCENE_CONFIG.MAX_STAR_SIZE, (7 - magnitude) * 0.8 + 1)
      );
      
      if (isNamed) {
        size *= SCENE_CONFIG.NAMED_STAR_BOOST;
      }
      
      // Extra boost for very bright stars
      if (magnitude < 0) {
        size *= 1.5;
      }
      
      sizeArr.push(size);
      refs.push(st);
    }
    
    const endTime = performance.now();
    const namedStars = refs.filter(star => getStarName(star.hip)).length;
    const renderTimeMs = Math.round(endTime - startTime);
    
    console.log(`SkyViewer: Rendered ${refs.length}/${stars.length} stars (${namedStars} named, quality: ${qualityLevel}) in ${renderTimeMs}ms`);
    
    setRenderTime(renderTimeMs);
    setLoadingProgress(1.0);
    
    setTimeout(() => setIsLoading(false), 200);
    
    return {
      positions: new Float32Array(posArr),
      colors: new Float32Array(colorArr),
      sizes: new Float32Array(sizeArr),
      starRefs: refs,
    };
  }, [stars, qualityLevel, qualitySettings.maxStars]);
  
  const selectedStarIndex = useMemo(() => {
    if (!selectedStar) return -1;
    return starRefs.findIndex(star => 
      star.hip === selectedStar.hip && 
      Math.abs(star.ra - selectedStar.ra) < 0.001 && 
      Math.abs(star.dec - selectedStar.dec) < 0.001
    );
  }, [selectedStar, starRefs]);
  
  const handlePointerMove = useCallback((e: any) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    
    const idx = e.index;
    setHoveredIndex(typeof idx === "number" ? idx : null);
    setHoveredStar(typeof idx === "number" && idx >= 0 && idx < starRefs.length ? starRefs[idx] : null);
    setCursor(typeof idx === "number" ? 'pointer' : 'grab');
    
    if (e.nativeEvent) {
      setMousePosition({
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY
      });
    }
  }, [starRefs]);
  
  const handlePointerOut = useCallback((e: any) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    
    setHoveredIndex(null);
    setHoveredStar(null);
    setCursor('grab');
  }, []);
  
  // ✅ Fixed: Better distance calculation for proper zoom level and centering
  const handlePointerDown = useCallback((e: any) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    
    const idx = e.index;
    if (typeof idx === "number" && idx >= 0 && idx < starRefs.length) {
      const clicked = starRefs[idx];
      if (clicked) {
        onStarClick?.(clicked);
        if (setFlyToTarget) {
          const [x, y, z] = toCartesian(clicked.ra, clicked.dec, clicked.dist_pc || 1);
          
          // ✅ Better distance calculation for proper zoom level
          const starDistance = clicked.dist_pc || 1;
          const optimalDistance = Math.max(100, starDistance * 0.5); // Adaptive distance
          
          setFlyToTarget({ 
            x, 
            y, 
            z: z + optimalDistance, // Use calculated distance instead of fixed offset
            lookAt: [x, y, z], // Look directly at the star position for perfect centering
            duration: 2.5,
            easing: 'easeInOut'
          });
        }
      }
    }
  }, [starRefs, onStarClick, setFlyToTarget]);
  
  // Enhanced keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 'p':
            setShowStats(!showStats);
            e.preventDefault();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showStats]);
  
  if (isLoading) {
    return <LoadingState progress={loadingProgress} />;
  }
  
  return (
    <>
      <div 
        style={{ 
          position: "absolute", 
          inset: 0, 
          cursor,
          background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 50%, #0f1419 100%)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <Canvas 
          style={{ 
            position: "absolute", 
            inset: 0,
            touchAction: 'none',
            userSelect: 'none'
          }} 
          camera={{ position: [0, 0, 500], fov: 60, far: 15000 }}
          gl={{
            antialias: qualityLevel !== 'low',
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
          }}
          dpr={qualityLevel === 'high' ? 2 : 1}
          onPointerMissed={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
          }}
        >
          <Suspense fallback={null}>
            {/* Enhanced background */}
            <Stars 
              radius={qualitySettings.backgroundStars * 4}
              depth={400}
              count={qualitySettings.backgroundStars}
              factor={8}
              saturation={0.08}
              fade
            />
            
            {/* Coordinate grid */}
            <CoordinateGrid visible={showGrid} />
            
            {/* Enhanced lighting */}
            <ambientLight intensity={0.12} color={0x404080} />
            <pointLight position={[1000, 1000, 1000]} intensity={0.25} color={0x8080ff} />
            <pointLight position={[-1000, -1000, 400]} intensity={0.18} color={0xff8080} />
            <pointLight position={[0, 1000, -1000]} intensity={0.15} color={0x80ff80} />
            
            {/* Main star field */}
            <group>
              <Points
                ref={pointRef}
                positions={positions}
                colors={colors}
                stride={3}
                onPointerMove={handlePointerMove}
                onPointerOut={handlePointerOut}
                onPointerDown={handlePointerDown}
              >
                <PointMaterial
                  map={spriteTex}
                  vertexColors
                  size={SCENE_CONFIG.BASE_STAR_SIZE}
                  sizeAttenuation
                  transparent
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  alphaTest={0.001}
                />
              </Points>
              
              {/* Hover effect */}
              {hoveredIndex != null && hoveredIndex >= 0 && hoveredIndex < starRefs.length && (
                <StarGlow star={starRefs[hoveredIndex]} type="hover" />
              )}
              
              {/* Selection effect */}
              {selectedStarIndex >= 0 && selectedStarIndex < starRefs.length && (
                <StarGlow star={starRefs[selectedStarIndex]} type="selected" />
              )}
            </group>
            
            {/* ✅ Enhanced camera controls with better settings */}
            <OrbitControls 
              enablePan 
              enableZoom 
              enableRotate
              zoomSpeed={0.5} // ✅ Reduced zoom speed for more control
              rotateSpeed={0.6}
              panSpeed={1.0}
              minDistance={50} // ✅ Minimum zoom distance
              maxDistance={1000} // ✅ Reduced max distance to prevent over-zooming
              enableDamping
              dampingFactor={0.06} // ✅ Slightly more damping for smoother movement
              maxPolarAngle={Math.PI}
              minPolarAngle={0}
            />
            
          </Suspense>
        </Canvas>
      </div>
      
      {/* Enhanced tooltip */}
      <StarTooltip star={hoveredStar} position={mousePosition} />
      
      {/* Performance stats */}
      {showStats && (
        <PerformanceStats 
          starCount={starRefs.length}
          namedStars={starRefs.filter(star => getStarName(star.hip)).length}
          renderTime={renderTime}
          fps={fps}
          qualityLevel={qualityLevel}
        />
      )}
    </>
  );
}
