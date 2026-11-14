import { useEffect, useRef } from "react";

/**
 * The cover's globe: a dotted Earth turning gently over Arabia, with routes
 * flying in from pilgrims' home cities to Jeddah and Madinah, drawn on a
 * canvas. Routes draw themselves one after another, then small planes fly
 * them. With reduced motion on, one still frame with the routes drawn.
 */

type City = [code: string, lat: number, lon: number];

const JED: City = ["JED", 21.68, 39.16];
const MED: City = ["MED", 24.55, 39.7];
const FROM: [City, City][] = [
  [["CGK", -6.13, 106.66], MED],
  [["KUL", 2.74, 101.7], JED],
  [["KHI", 24.9, 67.17], JED],
  [["DAC", 23.84, 90.4], JED],
  [["HYD", 17.24, 78.43], MED],
  [["CAI", 30.12, 31.41], MED],
  [["IST", 41.28, 28.75], MED],
  [["KAN", 12.05, 8.52], JED],
  [["LHR", 51.47, -0.45], MED],
];

const RAD = Math.PI / 180;
type V3 = [number, number, number];

const toVec = (lat: number, lon: number): V3 => [
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
];

/* a point on the great circle between a and b, f from 0 to 1 */
function slerp(a: V3, b: V3, f: number): V3 {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const w = Math.acos(dot);
  if (w < 1e-6) return a;
  const s = Math.sin(w);
  const k1 = Math.sin((1 - f) * w) / s;
  const k2 = Math.sin(f * w) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

export function Globe({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let w = 0;
    let h = 0;
    const size = () => {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const watch = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null;
    watch?.observe(canvas);

    /* the dots of the sphere, spaced evenly */
    const dots: V3[] = [];
    for (let lat = -84; lat <= 84; lat += 4) {
      const step = 4 / Math.max(0.2, Math.cos(lat * RAD));
      for (let lon = -180; lon < 180; lon += step) dots.push(toVec(lat, lon));
    }
    const routes = FROM.map(([a, b]) => ({ a, b, va: toVec(a[1], a[2]), vb: toVec(b[1], b[2]) }));
    const t0 = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const t = still ? 6000 : now - t0;
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w * 0.47, h * 0.47);
      const cx = w / 2;
      const cy = h * 0.52;
      const lon0 = (52 + (still ? 0 : 12 * Math.sin(t * 0.00009))) * RAD;
      const lat0 = 16 * RAD;
      const [cl, sl] = [Math.cos(lat0), Math.sin(lat0)];
      const [co, so] = [Math.cos(lon0), Math.sin(lon0)];
      /* world vector to the screen: x right, y up, z toward the viewer */
      const view = (v: V3, lift = 0) => {
        const x1 = -v[0] * so + v[1] * co;
        const y0 = v[0] * co + v[1] * so;
        const y1 = -y0 * sl + v[2] * cl;
        const z1 = y0 * cl + v[2] * sl;
        const k = 1 + lift;
        return { x: cx + R * x1 * k, y: cy - R * y1 * k, z: z1 };
      };

      /* the glow and the rim */
      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
      glow.addColorStop(0, "rgba(46,196,198,0.10)");
      glow.addColorStop(0.75, "rgba(46,196,198,0.06)");
      glow.addColorStop(1, "rgba(46,196,198,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(6,28,32,0.65)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(78,220,214,0.45)";
      ctx.shadowColor = "rgba(46,196,198,0.9)";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (const d of dots) {
        const p = view(d);
        if (p.z <= 0) continue;
        ctx.fillStyle = `rgba(110,226,220,${0.12 + 0.6 * p.z})`;
        ctx.fillRect(p.x - 0.9, p.y - 0.9, 1.8, 1.8);
      }

      /* the routes draw themselves one after another; then planes fly them */
      ctx.lineCap = "round";
      routes.forEach((rt, i) => {
        const grown = Math.min(1, Math.max(0, (t - 500 - i * 140) / 900));
        if (grown <= 0) return;
        const n = 48;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j <= n * grown; j++) {
          const f = j / n;
          const p = view(slerp(rt.va, rt.vb, f), Math.sin(Math.PI * f) * 0.16);
          if (p.z < -0.2) {
            started = false;
            continue;
          }
          if (!started) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
          started = true;
        }
        ctx.strokeStyle = "rgba(94,228,222,0.75)";
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "rgba(46,196,198,1)";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (grown === 1 && !still) {
          const f = ((t / 7000 + i * 0.137) % 1 + 1) % 1;
          const p = view(slerp(rt.va, rt.vb, f), Math.sin(Math.PI * f) * 0.16);
          const q = view(slerp(rt.va, rt.vb, Math.min(1, f + 0.01)), Math.sin(Math.PI * Math.min(1, f + 0.01)) * 0.16);
          if (p.z > -0.2) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
            ctx.fillStyle = "#eafffd";
            ctx.shadowColor = "rgba(46,196,198,1)";
            ctx.shadowBlur = 10;
            /* a small plane: fuselage, wings, tail */
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-5, -1.2);
            ctx.lineTo(-5, 1.2);
            ctx.closePath();
            ctx.moveTo(1, 0);
            ctx.lineTo(-2, -5);
            ctx.lineTo(-3, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-3, 5);
            ctx.lineTo(-2, 5);
            ctx.closePath();
            ctx.moveTo(-4, 0);
            ctx.lineTo(-6, -2.4);
            ctx.lineTo(-6.6, -2.4);
            ctx.lineTo(-5.6, 0);
            ctx.lineTo(-6.6, 2.4);
            ctx.lineTo(-6, 2.4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
      });

      /* the cities, with their codes; Jeddah and Madinah ringed */
      ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
      const seen = new Set<string>();
      for (const [code, lat, lon] of [...FROM.map(([a]) => a), JED, MED]) {
        if (seen.has(code)) continue;
        seen.add(code);
        const p = view(toVec(lat, lon));
        if (p.z <= 0.05) continue;
        const holy = code === "JED" || code === "MED";
        ctx.fillStyle = holy ? "#ffd98a" : "rgba(126,236,229,0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, holy ? 3.4 : 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (holy) {
          const pulse = still ? 0.5 : (t / 1600) % 1;
          ctx.strokeStyle = `rgba(255,217,138,${0.8 * (1 - pulse)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 + pulse * 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = holy ? "#ffe6b0" : "rgba(126,236,229,0.85)";
        /* Jeddah's label below, Madinah's to the right, Cairo's to the left: they sit close */
        const dx = code === "CAI" ? -26 : code === "JED" ? -4 : 7;
        const dy = code === "JED" ? 15 : code === "MED" ? -4 : -5;
        ctx.fillText(code, p.x + dx, p.y + dy);
      }

      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      watch?.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
