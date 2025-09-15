// src/components/sky-viewer/CameraControls.tsx
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

export type FlyTarget = {
  x: number;
  y: number;
  z: number;
  lookAt?: [number, number, number];
  duration?: number;
  easing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' | 'bounce' | 'elastic';
  onComplete?: () => void;
  onStart?: () => void;
};

interface CameraControlsProps {
  flyToTarget: FlyTarget | null;
  enabled?: boolean;
  minDistance?: number;
  maxDistance?: number;
}

// Enhanced easing functions with better performance
const easingFunctions = {
  linear: (t: number): number => t,
  easeInOut: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeIn: (t: number): number => t * t * t,
  easeOut: (t: number): number => (--t) * t * t + 1,
  elastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    const p = 0.3;
    const s = p / 4;
    return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
  },
  bounce: (t: number): number => {
    if (t < 1/2.75) {
      return 7.5625 * t * t;
    } else if (t < 2/2.75) {
      return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
    } else if (t < 2.5/2.75) {
      return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
    }
  }
} as const;

interface AnimationState {
  target: FlyTarget;
  startTime: number;
  startPosition: THREE.Vector3;
  startLookAt: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetLookAt: THREE.Vector3;
  duration: number;
  easing: keyof typeof easingFunctions;
  onComplete?: () => void;
  hasStarted: boolean;
}

export default function CameraControls({ 
  flyToTarget, 
  enabled = true,
  minDistance = 0.5,
  maxDistance = 5000
}: CameraControlsProps) {
  const { camera, controls } = useThree(); // ✅ Add controls to access OrbitControls
  
  const [isAnimating, setIsAnimating] = useState(false);
  const animationStateRef = useRef<AnimationState | null>(null);
  
  // Pre-allocated vectors for better performance
  const tempPosition = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());
  const worldDirection = useRef(new THREE.Vector3());

  // Validate coordinates safely
  const isValidCoordinate = useCallback((val: any): val is number => {
    return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);
  }, []);

  // Validate and clamp distance
  const validateDistance = useCallback((pos: THREE.Vector3): THREE.Vector3 => {
    const distance = pos.length();
    if (distance < minDistance) {
      return pos.normalize().multiplyScalar(minDistance);
    }
    if (distance > maxDistance) {
      return pos.normalize().multiplyScalar(maxDistance);
    }
    return pos;
  }, [minDistance, maxDistance]);

  // Get current camera look-at target safely
  const getCurrentLookAt = useCallback((): THREE.Vector3 => {
    try {
      // ✅ FIX: Get current OrbitControls target if available
      if (controls && 'target' in controls) {
        return (controls as any).target.clone();
      }
      
      camera.getWorldDirection(worldDirection.current);
      return worldDirection.current
        .multiplyScalar(-1000)
        .add(camera.position);
    } catch (error) {
      console.warn('Failed to get camera direction, using default');
      return new THREE.Vector3(0, 0, 0);
    }
  }, [camera, controls]);

  // Start animation with comprehensive validation
  const startAnimation = useCallback((target: FlyTarget) => {
    if (!enabled || !target) return;

    try {
      // Comprehensive coordinate validation
      const { x, y, z } = target;
      if (!isValidCoordinate(x) || !isValidCoordinate(y) || !isValidCoordinate(z)) {
        console.error('Invalid target coordinates:', { x, y, z });
        return;
      }

      // Create and validate target position
      const targetPos = validateDistance(new THREE.Vector3(x, y, z));
      
      // Handle lookAt with multiple fallback strategies
      let targetLookAtPos: THREE.Vector3;
      
      if (target.lookAt && Array.isArray(target.lookAt) && target.lookAt.length === 3) {
        const [lx, ly, lz] = target.lookAt;
        if (isValidCoordinate(lx) && isValidCoordinate(ly) && isValidCoordinate(lz)) {
          targetLookAtPos = new THREE.Vector3(lx, ly, lz);
        } else {
          console.warn('Invalid lookAt coordinates, using star position');
          targetLookAtPos = new THREE.Vector3(x, y, z);
        }
      } else {
        // Default to looking at the star position itself for centering
        targetLookAtPos = new THREE.Vector3(x, y, z);
      }

      // Validate duration with sensible bounds
      let duration = 2.0; // default
      if (typeof target.duration === 'number' && target.duration > 0 && target.duration < 30) {
        duration = target.duration;
      }
      
      // Validate easing function
      const easing = (target.easing && target.easing in easingFunctions) 
        ? target.easing 
        : 'easeInOut';

      // Create animation state
      animationStateRef.current = {
        target,
        startTime: performance.now(),
        startPosition: camera.position.clone(),
        startLookAt: getCurrentLookAt(),
        targetPosition: targetPos,
        targetLookAt: targetLookAtPos,
        duration,
        easing,
        onComplete: target.onComplete,
        hasStarted: false
      };
      
      setIsAnimating(true);
      
    } catch (error) {
      console.error('Error starting camera animation:', error);
      setIsAnimating(false);
      animationStateRef.current = null;
    }
  }, [enabled, validateDistance, getCurrentLookAt, camera, isValidCoordinate]);

  // Handle flyToTarget changes with debouncing
  useEffect(() => {
    if (flyToTarget && enabled) {
      startAnimation(flyToTarget);
    } else {
      // Cancel current animation smoothly
      if (animationStateRef.current) {
        animationStateRef.current = null;
        setIsAnimating(false);
      }
    }
  }, [flyToTarget, enabled, startAnimation]);

  // ✅ FIXED: Animation loop that works with OrbitControls
  useFrame(() => {
    const animState = animationStateRef.current;
    if (!animState || !enabled) return;

    try {
      const now = performance.now();
      const elapsed = (now - animState.startTime) / 1000;
      const progress = Math.min(Math.max(elapsed / animState.duration, 0), 1);

      // Call onStart callback once
      if (!animState.hasStarted) {
        if (typeof animState.target.onStart === 'function') {
          try {
            animState.target.onStart();
          } catch (error) {
            console.error('Error in onStart callback:', error);
          }
        }
        animState.hasStarted = true;
      }

      // Apply easing safely
      const easingFunction = easingFunctions[animState.easing] || easingFunctions.easeInOut;
      const easedProgress = easingFunction(progress);

      // Smooth interpolation
      tempPosition.current.lerpVectors(
        animState.startPosition, 
        animState.targetPosition, 
        easedProgress
      );
      
      currentLookAt.current.lerpVectors(
        animState.startLookAt, 
        animState.targetLookAt, 
        easedProgress
      );

      // ✅ FIX: Apply to camera AND OrbitControls
      camera.position.copy(tempPosition.current);
      
      // Update OrbitControls target instead of camera.lookAt
      if (controls && 'target' in controls) {
        (controls as any).target.copy(currentLookAt.current);
        (controls as any).update();
      } else {
        // Fallback when OrbitControls is not available
        camera.lookAt(currentLookAt.current);
      }
      
      camera.updateProjectionMatrix();

      // Check for completion
      if (progress >= 1) {
        // Snap to exact final position
        camera.position.copy(animState.targetPosition);
        
        // ✅ FIX: Set final OrbitControls target for perfect centering
        if (controls && 'target' in controls) {
          (controls as any).target.copy(animState.targetLookAt);
          (controls as any).update();
        } else {
          camera.lookAt(animState.targetLookAt);
        }
        
        camera.updateProjectionMatrix();
        
        // Call completion callback safely
        if (typeof animState.onComplete === 'function') {
          try {
            animState.onComplete();
          } catch (error) {
            console.error('Error in onComplete callback:', error);
          }
        }
        
        // Clean up
        animationStateRef.current = null;
        setIsAnimating(false);
      }
      
    } catch (error) {
      console.error('Error in camera animation frame:', error);
      // Graceful cleanup on error
      animationStateRef.current = null;
      setIsAnimating(false);
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animationStateRef.current = null;
      setIsAnimating(false);
    };
  }, []);

  return null;
}

// Helper functions with better error handling
export const createFlyToTarget = (
  x: number, 
  y: number, 
  z: number, 
  options: Partial<FlyTarget> = {}
): FlyTarget => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new Error(`Invalid coordinates for createFlyToTarget: x=${x}, y=${y}, z=${z}`);
  }
  
  return {
    x,
    y,
    z,
    lookAt: options.lookAt || [x, y, z], // Default to looking at the target position
    duration: 2.0,
    easing: 'easeInOut',
    ...options
  };
};

// Enhanced hook with better state management
export const useCameraFly = () => {
  const [target, setTarget] = useState<FlyTarget | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  
  const flyTo = useCallback((
    x: number, 
    y: number, 
    z: number, 
    options: Partial<FlyTarget> = {}
  ) => {
    try {
      const flyTarget = createFlyToTarget(x, y, z, {
        ...options,
        onStart: () => {
          setIsFlying(true);
          options.onStart?.();
        },
        onComplete: () => {
          setIsFlying(false);
          options.onComplete?.();
        }
      });
      setTarget(flyTarget);
    } catch (error) {
      console.error('Error creating fly target:', error);
      setIsFlying(false);
    }
  }, []);
  
  const flyToStar = useCallback((
    star: { ra: number; dec: number; dist_pc: number | null }, 
    offset = 45,
    options: Partial<FlyTarget> = {}
  ) => {
    if (!star.dist_pc || !Number.isFinite(star.dist_pc)) return;
    
    try {
      // Convert celestial coordinates to 3D position
      const raRad = (star.ra * Math.PI) / 180;
      const decRad = (star.dec * Math.PI) / 180;
      const d = Math.max(0.1, star.dist_pc) * 1.2; // Match STAR_DISTANCE_SCALE
      
      const x = d * Math.cos(decRad) * Math.cos(raRad);
      const y = d * Math.sin(decRad);
      const z = d * Math.cos(decRad) * Math.sin(raRad);
      
      flyTo(x, y, z + offset, {
        lookAt: [x, y, z], // Look directly at the star for perfect centering
        ...options
      });
    } catch (error) {
      console.error('Error flying to star:', error);
    }
  }, [flyTo]);
  
  const cancel = useCallback(() => {
    setTarget(null);
    setIsFlying(false);
  }, []);
  
  return { 
    target, 
    flyTo, 
    flyToStar,
    cancel, 
    isFlying 
  };
};

// Animation presets
export const ANIMATION_PRESETS = {
  instant: { duration: 0.1, easing: 'linear' as const },
  quick: { duration: 0.8, easing: 'easeOut' as const },
  smooth: { duration: 2.0, easing: 'easeInOut' as const },
  slow: { duration: 4.0, easing: 'easeInOut' as const },
  bouncy: { duration: 2.5, easing: 'bounce' as const },
  elastic: { duration: 3.0, easing: 'elastic' as const }
} as const;
