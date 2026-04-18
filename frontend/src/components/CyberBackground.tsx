import { useEffect, useRef } from "react";

/**
 * Fullscreen matrix-rain canvas rendered behind the dashboard.
 * Uses requestAnimationFrame for smooth 60fps rendering.
 */
export default function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "01アウエカキクケサシスセソタチツテナニヌネハヒフヘマミムメヤユヨラルレロワン";
    const fontSize = 14;
    let columns = Math.floor(canvas.width / fontSize);
    let drops: number[] = Array.from({ length: columns }, () =>
      Math.random() * -100
    );

    const draw = () => {
      ctx.fillStyle = "rgba(3, 7, 18, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Vary brightness for depth effect
        const brightness = Math.random() > 0.96 ? 0.6 : 0.12;
        ctx.fillStyle = `rgba(52, 211, 153, ${brightness})`;

        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animId = requestAnimationFrame(draw);
    };

    // Slower frame rate to reduce CPU — draw every 3rd frame
    let frame = 0;
    const throttledDraw = () => {
      frame++;
      if (frame % 3 === 0) {
        ctx.fillStyle = "rgba(3, 7, 18, 0.06)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${fontSize}px monospace`;
        for (let i = 0; i < drops.length; i++) {
          const brightness = Math.random() > 0.96 ? 0.5 : 0.1;
          ctx.fillStyle = `rgba(52, 211, 153, ${brightness})`;
          const text = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
      }
      animId = requestAnimationFrame(throttledDraw);
    };

    // Recalculate columns on resize
    const handleResize = () => {
      resize();
      columns = Math.floor(canvas.width / fontSize);
      const newDrops = Array.from({ length: columns }, () =>
        Math.random() * -100
      );
      drops = newDrops;
    };
    window.addEventListener("resize", handleResize);

    animId = requestAnimationFrame(throttledDraw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.7 }}
    />
  );
}
