import React, { useEffect, useRef, useCallback } from 'react';

// --- Fast Noise Implementation (Simplex-like) ---
class FastNoise {
  perm: number[] = [];
  
  constructor() {
    this.seed(Math.random());
  }

  seed(val: number) {
    this.perm = new Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const r = Math.floor((val * (i + 1) + i) % 256); 
      val = Math.sin(val) * 10000; 
      [p[i], p[r]] = [p[r], p[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.perm[AA], x, y, z),
      this.grad(this.perm[BA], x - 1, y, z)),
      this.lerp(u, this.grad(this.perm[AB], x, y - 1, z),
        this.grad(this.perm[BB], x - 1, y - 1, z))),
      this.lerp(v, this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1),
        this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1),
          this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))));
  }

  fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
}

// Layered Green Palette (Dark to Neon)
const COLORS = [
  '#051a05', // Deep Shadow
  '#0f3d0f', // Dark Forest
  '#14532d', // Emerald
  '#166534', // Green
  '#22c55e', // Bright Green
  '#4ade80', // Light Green
  '#84cc16', // Lime
  '#bef264', // Pale Lime
  '#d9f99d', // Mist
  '#ecfccb'  // Highlight
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  speedMod: number;
}

interface LinearEyesCanvasProps {
  windSpeed: number;
  turbulence: number;
  eyeSize: number;
}

export const LinearEyesCanvas: React.FC<LinearEyesCanvasProps> = ({ 
  windSpeed, 
  turbulence, 
  eyeSize 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const noiseRef = useRef(new FastNoise());
  const animationRef = useRef<number>(0);

  // Configuration ref to access latest props in animation loop without re-triggering effect
  const configRef = useRef({
    windSpeed,
    turbulence,
    eyeSize,
    particleCount: 12000,
    timeSpeed: 0.0008,
    pupilInfluence: 45,
    dogRepulsionRadius: 50 // Reduced from 120 to 50 for a smaller interaction area
  });

  // Update config ref when props change
  useEffect(() => {
    configRef.current.windSpeed = windSpeed;
    configRef.current.turbulence = turbulence;
    configRef.current.eyeSize = eyeSize;
  }, [windSpeed, turbulence, eyeSize]);

  const targetLookRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    
    mouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    targetLookRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleMouseMove, handleTouchMove]);

  const initParticles = (width: number, height: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < configRef.current.particleCount; i++) {
      particles.push(createParticle(width, height));
    }
    particlesRef.current = particles;
  };

  const createParticle = (w: number, h: number): Particle => {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      life: Math.random() * 80,
      maxLife: 40 + Math.random() * 80,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speedMod: 0.8 + Math.random() * 0.4
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const noise = noiseRef.current;

    const render = (time: number) => {
      const config = configRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const t = time * config.timeSpeed;

      // Dark forest green fade for trails
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(1, 12, 4, 0.25)'; // Slightly higher opacity for cleaner redraws
      ctx.fillRect(0, 0, w, h);

      // Eye Positions
      const eyeY = h * 0.45;
      const leftEyeX = w * 0.35;
      const rightEyeX = w * 0.65;

      // Smooth look interpolation
      targetLookRef.current.x += (mouseRef.current.x - targetLookRef.current.x) * 0.05;
      targetLookRef.current.y += (mouseRef.current.y - targetLookRef.current.y) * 0.05;

      const lookDX = (targetLookRef.current.x - w/2) * 0.25; 
      const lookDY = (targetLookRef.current.y - h/2) * 0.25;

      const leftPupilX = leftEyeX + Math.max(-45, Math.min(45, lookDX));
      const leftPupilY = eyeY + Math.max(-25, Math.min(25, lookDY));
      
      const rightPupilX = rightEyeX + Math.max(-45, Math.min(45, lookDX));
      const rightPupilY = eyeY + Math.max(-25, Math.min(25, lookDY));

      ctx.lineWidth = 1;

      particlesRef.current.forEach(p => {
        // 1. Wind Flow + Noise
        // Basic wind blows Right (Angle 0).
        const n = noise.noise3D(p.x * config.turbulence, p.y * config.turbulence, t);
        
        // Add a "Gust" wave using sine of time
        const gust = Math.sin(t * 2 + p.y * 0.01) * 0.3;
        let angle = (n * 0.6) + gust; 

        // 2. Eye Influence (Magnetic Vortex)
        const checkEye = (ex: number, ey: number, px: number, py: number) => {
            const dx = p.x - ex;
            const dy = p.y - ey;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < config.eyeSize) {
                // Swirl around eye
                const swirlAngle = Math.atan2(dy, dx) + Math.PI / 2 + 0.2; 
                const factor = Math.pow(1 - (dist / config.eyeSize), 2); // Ease in
                
                // Blend wind (angle) with swirl
                angle = angle * (1 - factor) + swirlAngle * factor;

                // Pupil Black Hole
                const pdx = p.x - px;
                const pdy = p.y - py;
                const pDist = Math.sqrt(pdx*pdx + pdy*pdy);
                
                if (pDist < config.pupilInfluence) {
                    const pupilAngle = Math.atan2(pdy, pdx);
                    angle = pupilAngle + Math.PI; // Suck in
                    p.life -= 4; // Die quickly in pupil
                }
                return true;
            }
            return false;
        };

        checkEye(leftEyeX, eyeY, leftPupilX, leftPupilY);
        checkEye(rightEyeX, eyeY, rightPupilX, rightPupilY);

        // 3. Move Particle
        p.vx += Math.cos(angle) * 0.15;
        p.vy += Math.sin(angle) * 0.15;
        
        // 4. Mouse Avoidance
        const dogDx = p.x - mouseRef.current.x;
        const dogDy = p.y - mouseRef.current.y;
        const dogDist = Math.sqrt(dogDx*dogDx + dogDy*dogDy);
        
        if (dogDist < config.dogRepulsionRadius) {
            const repulsionForce = (1 - dogDist / config.dogRepulsionRadius); // 0 to 1
            // Push away from mouse
            p.vx += (dogDx / dogDist) * repulsionForce * 2.0;
            p.vy += (dogDy / dogDist) * repulsionForce * 2.0;
        }

        p.vx *= 0.9; // Friction
        p.vy *= 0.9;

        p.x += p.vx * config.windSpeed * p.speedMod;
        p.y += p.vy * config.windSpeed * p.speedMod;

        // 5. Life & Respawn
        p.life--;
        // Respawn if dead OR off screen (but allow flow off right side to wrap left)
        if (p.life <= 0 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
             // Reset
             p.x = -10; // Start slightly off left for smooth entry
             p.y = Math.random() * h;
             p.life = p.maxLife;
             p.vx = 2; // Initial push right
             p.vy = 0;
             p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
             
             // Occasional random spawn for density fill
             if (Math.random() < 0.2) {
                 p.x = Math.random() * w;
             }

             // Respawn near eyes to keep definition
             if (Math.random() < 0.05) {
                 const isLeft = Math.random() > 0.5;
                 p.x = (isLeft ? leftEyeX : rightEyeX) + (Math.random() - 0.5) * config.eyeSize * 2;
                 p.y = eyeY + (Math.random() - 0.5) * config.eyeSize * 2;
                 p.life = 20;
             }
        }

        // 6. Draw
        const alpha = Math.min(1, p.life / 30);
        ctx.globalAlpha = alpha * 0.6; 
        ctx.strokeStyle = p.color;
        
        ctx.beginPath();
        // Longer trails for "grassy" look
        ctx.moveTo(p.x - p.vx * 6, p.y - p.vy * 6);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });
      
      ctx.globalAlpha = 1.0;

      animationRef.current = requestAnimationFrame(render);
    };

    render(0);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []); // Empty dependency array as we use ref for config

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};