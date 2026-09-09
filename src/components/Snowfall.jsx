import { useMemo } from 'react';

export default function Snowfall() {
  // Pre-generate 45 snowflakes with randomized positions, durations, and delays
  const flakes = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      left: `${(i * 2.2 + Math.random() * 2) % 100}%`,
      size: `${Math.random() * 3 + 2}px`,
      fallDuration: `${Math.random() * 8 + 8}s`, // Slow, gentle drift: 8s - 16s
      fallDelay: `${Math.random() * 10}s`,
      swayDuration: `${Math.random() * 3 + 3}s`,
      opacity: Math.random() * 0.45 + 0.25, // Light, subtle opacity: 0.25 - 0.7
      blur: Math.random() > 0.6 ? '1px' : '0px'
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1
      }}
    >
      <style>{`
        @keyframes snowfallDrift {
          0% {
            transform: translateY(-20px) translateX(0);
          }
          50% {
            transform: translateY(50vh) translateX(15px);
          }
          100% {
            transform: translateY(105vh) translateX(-15px);
          }
        }
        .snow-flake {
          position: absolute;
          top: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 70%, transparent 100%);
          will-change: transform;
          animation: snowfallDrift linear infinite;
        }
      `}</style>
      {flakes.map((f) => (
        <span
          key={f.id}
          className="snow-flake"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            filter: f.blur !== '0px' ? `blur(${f.blur})` : 'none',
            animationDuration: f.fallDuration,
            animationDelay: `-${f.fallDelay}`
          }}
        />
      ))}
    </div>
  );
}
