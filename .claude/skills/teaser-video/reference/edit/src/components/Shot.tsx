import type { CSSProperties, ReactElement, ReactNode } from "react";
import { interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { alpha, c, clamp, ease, FPS, fonts } from "../theme";

/** Camera keyframe: look at (x, y) in source pixels with zoom z (1 = fit width). */
export interface Cam {
  f: number;
  x: number;
  y: number;
  z: number;
}

function camAt(cams: Cam[], f: number): Omit<Cam, "f"> {
  if (f <= cams[0].f) {
    return cams[0];
  }
  const last = cams[cams.length - 1];
  if (f >= last.f) {
    return last;
  }
  let i = 0;
  while (cams[i + 1].f < f) {
    i++;
  }
  const a = cams[i];
  const b = cams[i + 1];
  const t = ease((f - a.f) / (b.f - a.f));
  // Interpolate zoom in log space so push-ins feel linear to the eye.
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z };
}

interface FootageProps {
  src: string;
  /** Source frame size in px. */
  sw: number;
  sh: number;
  /** Viewport (window content) size in output px. */
  w: number;
  h: number;
  cams: Cam[];
  startFrom?: number;
  rate?: number;
  /** Overlays positioned in source pixel space, so they track the camera. */
  children?: ReactNode;
}

/**
 * Real footage seen through a virtual camera. The transform is computed per
 * frame in floating point and rendered by Chrome, so push-ins are smooth (the
 * ffmpeg zoompan jitter cannot happen here).
 */
export function Footage(props: FootageProps): ReactElement {
  const { src, sw, sh, w, h, cams, startFrom = 0, rate = 1, children } = props;
  const f = useCurrentFrame();
  const cam = camAt(cams, f);
  const fit = w / sw;
  const s = fit * cam.z;
  // Clamp so the camera never shows past the footage edge.
  const halfW = w / 2 / s;
  const halfH = h / 2 / s;
  const x = Math.min(Math.max(cam.x, halfW), sw - halfW);
  const y = Math.min(Math.max(cam.y, halfH), sh - halfH);
  return (
    <div
      style={{ position: "relative", width: w, height: h, overflow: "hidden", background: c.base }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: sw,
          height: sh,
          transformOrigin: "0 0",
          transform: `translate(${w / 2}px, ${h / 2}px) scale(${s}) translate(${-x}px, ${-y}px)`,
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          startFrom={Math.round(startFrom * FPS)}
          playbackRate={rate}
          muted
          style={{ width: sw, height: sh, display: "block" }}
        />
        {children}
      </div>
    </div>
  );
}

interface WindowProps {
  w: number;
  h: number;
  url?: string;
  children: ReactNode;
  style?: CSSProperties;
  bar?: boolean;
}

/** Minimal browser frame so the footage reads as "a real app in a browser". */
export function AppWindow(props: WindowProps): ReactElement {
  const { w, h, url, children, style, bar = true } = props;
  const barH = bar ? 44 : 0;
  return (
    <div
      style={{
        width: w,
        height: h + barH,
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${c.borderHi}`,
        background: c.card,
        boxShadow: `0 50px 140px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 120px ${alpha(c.flame, 0.08)}`,
        ...style,
      }}
    >
      {bar && (
        <div
          style={{
            height: barH,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 18px",
            borderBottom: `1px solid ${c.divider}`,
            background: c.card,
          }}
        >
          {["close", "minimize", "maximize"].map((dot) => (
            <div
              key={dot}
              style={{ width: 12, height: 12, borderRadius: 6, background: c.borderHi }}
            />
          ))}
          {url && (
            <div
              style={{
                marginLeft: 18,
                flex: 1,
                maxWidth: 520,
                height: 28,
                borderRadius: 8,
                background: c.base,
                border: `1px solid ${c.divider}`,
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                fontFamily: fonts.mono,
                fontSize: 15,
                color: c.text2,
              }}
            >
              <span style={{ color: c.success, marginRight: 8 }}>●</span>
              {url}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** Enter/exit motion for a window: rise + settle, optional slight 3D tilt. */
interface Enter {
  p: number;
  style: CSSProperties;
}

export function useEnter(at: number, dur = 30): Enter {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: ease });
  return {
    p,
    style: {
      opacity: Math.min(1, p * 1.6),
      transform: `translateY(${(1 - p) * 80}px) scale(${0.94 + p * 0.06})`,
    },
  };
}
