import React, { useEffect, useRef } from 'react';

export const InteractiveBackground = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let particles = [];
    const particleCount = 60; // 60 bubbles globally
    const trackingSpeed = 0.08; // smooth follow / return speed
    const repelRadius = 150; // disturbance radius

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    class Particle {
      constructor(w, h) {
        // Distribute bubbles randomly across the canvas
        this.baseX = Math.random() * w;
        this.baseY = Math.random() * h;
        this.x = this.baseX;
        this.y = this.baseY;

        // Visual properties
        this.radius = Math.random() * 2.5 + 2.5; // sharp, clear size (2.5px to 5px)
        this.alpha = Math.random() * 0.18 + 0.12; // base opacity (visible)
        this.currentAlpha = this.alpha;

        // Slow random float/drift velocity
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.25 + 0.1;
        this.driftX = Math.sin(this.angle) * this.speed;
        this.driftY = Math.cos(this.angle) * this.speed;
      }

      update(mouseX, mouseY, isMouseActive, w, h) {
        // Update natural drifting coordinates
        this.baseX += this.driftX;
        this.baseY += this.driftY;

        // Wrap around boundaries
        if (this.baseX < -50) this.baseX = w + 50;
        if (this.baseX > w + 50) this.baseX = -50;
        if (this.baseY < -50) this.baseY = h + 50;
        if (this.baseY > h + 50) this.baseY = -50;

        let targetX = this.baseX;
        let targetY = this.baseY;

        if (isMouseActive) {
          const dx = this.x - mouseX;
          const dy = this.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < repelRadius) {
            const force = (repelRadius - dist) / repelRadius;
            const angle = Math.atan2(dy, dx);
            
            // Push away from cursor (disturbance in water)
            targetX += Math.cos(angle) * force * 90;
            targetY += Math.sin(angle) * force * 90;
            
            // Fade out as it gets closer to cursor (reversed logic)
            this.currentAlpha = this.alpha * (dist / repelRadius);
          } else {
            this.currentAlpha = this.alpha;
          }
        } else {
          this.currentAlpha = this.alpha;
        }

        // Smooth transition to target coordinate
        this.x += (targetX - this.x) * trackingSpeed;
        this.y += (targetY - this.y) * trackingSpeed;
      }

      draw(context) {
        if (this.currentAlpha <= 0.01) return;

        context.beginPath();
        // Sharp, dark solid circles
        context.fillStyle = `rgba(15, 23, 42, ${this.currentAlpha})`;
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();
      }
    }

    const initParticles = () => {
      particles = [];
      const w = canvas.width;
      const h = canvas.height;
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(w, h));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const mouse = mouseRef.current;
      const w = canvas.width;
      const h = canvas.height;

      particles.forEach((p) => {
        p.update(mouse.x, mouse.y, mouse.active, w, h);
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    // Listeners
    window.addEventListener('resize', resizeCanvas);
    
    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    resizeCanvas();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0" 
      style={{ mixBlendMode: 'multiply' }} 
    />
  );
};
