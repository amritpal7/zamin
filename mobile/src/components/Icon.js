// Hairline-stroke SVG icons — matches the reference RN app exactly.

import React from "react";
import Svg, { Path, Circle, G, Rect } from "react-native-svg";

export function Icon({ name, size = 20, color = "#F5EFE6", strokeWidth = 1.6, fill = "none" }) {
  const p = {
    fill,
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPath(name, p, color)}
    </Svg>
  );
}

function renderPath(name, p, color) {
  switch (name) {
    case "arrow":    return <Path d="M7 17L17 7M9 7h8v8" {...p} />;
    case "back":     return <Path d="M15 18l-6-6 6-6" {...p} />;
    case "forward":  return <Path d="M9 6l6 6-6 6" {...p} />;
    case "bell":     return <Path d="M6 16h12l-1.5-2V10a4.5 4.5 0 10-9 0v4L6 16zM10 19a2 2 0 004 0" {...p} />;
    case "menu":     return <Path d="M4 7h16M4 12h16M4 17h10" {...p} />;
    case "search":   return <G {...p}><Circle cx="11" cy="11" r="6.5" /><Path d="M16 16l4 4" /></G>;
    case "mic":      return <G {...p}><Rect x="9" y="3" width="6" height="11" rx="3" /><Path d="M6 12a6 6 0 0012 0M12 18v3" /></G>;
    case "send":     return <Path d="M5 12L20 5l-3 15-5-7-7-1z" {...p} />;
    case "home":     return <Path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" {...p} />;
    case "compass":  return <G {...p}><Circle cx="12" cy="12" r="9" /><Path d="M16 8l-2 6-6 2 2-6 6-2z" /></G>;
    case "heart":    return <Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" {...p} />;
    case "user":     return <G {...p}><Circle cx="12" cy="9" r="3.5" /><Path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></G>;
    case "pin":      return <G {...p}><Path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z" /><Circle cx="12" cy="10" r="2.5" /></G>;
    case "star":     return <Path d="M12 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8L12 4z" {...p} fill={color} />;
    case "clock":    return <G {...p}><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></G>;
    case "close":    return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
    case "chevR":    return <Path d="M9 6l6 6-6 6" {...p} />;
    case "chevD":    return <Path d="M6 9l6 6 6-6" {...p} />;
    case "plus":     return <Path d="M12 5v14M5 12h14" {...p} />;
    case "filter":   return <Path d="M4 6h16M7 12h10M10 18h4" {...p} />;
    case "bookmark": return <Path d="M7 4h10v17l-5-3-5 3V4z" {...p} />;
    case "map":      return <G {...p}><Path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" /><Path d="M9 4v14M15 6v14" /></G>;
    case "moon":     return <Path d="M20 14a8 8 0 11-10-10 6.5 6.5 0 0010 10z" {...p} />;
    case "leaf":     return <Path d="M4 20c0-9 8-15 16-15-1 9-7 15-16 15z M4 20l7-7" {...p} />;
    case "globe":    return <G {...p}><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></G>;
    case "sparkle":  return <Path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" {...p} />;
    case "settings": return <G {...p}><Circle cx="12" cy="12" r="3" /><Path d="M19.4 13.5l1.6 1-2 3.5-2-.4-1.5 1-.4 2h-4l-.4-2-1.5-1-2 .4-2-3.5 1.6-1V11l-1.6-1 2-3.5 2 .4 1.5-1 .4-2h4l.4 2 1.5 1 2-.4 2 3.5-1.6 1v2.5z" /></G>;
    case "check":    return <Path d="M5 13l4 4L19 7" {...p} />;
    case "phone":    return <Path d="M6 3h3l2 5-2.4 1.5a11 11 0 005 5L16 12l5 2v3a2 2 0 01-2.2 2A15.5 15.5 0 014 5.2 2 2 0 016 3z" {...p} />;
    case "tag":      return <G {...p}><Path d="M4 4h7l9 9-7 7-9-9V4z" /><Circle cx="8" cy="8" r="1.4" fill={color} /></G>;
    case "ruler":    return <G {...p}><Path d="M3 8l5-5 13 13-5 5L3 8z" /><Path d="M8 8l2 2M11 5l2 2M14 8l2 2" /></G>;
    case "text":     return <Path d="M5 6h14M5 12h14M5 18h9" {...p} />;
    case "image":    return <G {...p}><Rect x="3" y="5" width="18" height="14" rx="2.5" /><Circle cx="8.5" cy="10" r="1.6" /><Path d="M21 15l-5-4-8 7" /></G>;
    case "chat":     return <Path d="M20 4H4a1 1 0 00-1 1v11a1 1 0 001 1h3v3.5L11.5 17H20a1 1 0 001-1V5a1 1 0 00-1-1z" {...p} />;
    case "edit":     return <Path d="M4 20h4L18.5 9.5l-4-4L4 16v4zM13 7l4 4" {...p} />;
    case "whatsapp": return <Path d="M12.04 2.5c-5.25 0-9.5 4.25-9.5 9.5 0 1.67.44 3.3 1.27 4.74L2.5 21.5l4.9-1.28a9.46 9.46 0 004.64 1.2c5.24 0 9.5-4.24 9.5-9.49 0-2.54-.99-4.92-2.78-6.72A9.43 9.43 0 0012.04 2.5zm5.5 13.4c-.23.65-1.36 1.24-1.86 1.29-.5.05-.97.23-3.28-.69-2.77-1.1-4.5-3.93-4.64-4.11-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.98.95-2.26.25-.27.54-.34.72-.34h.52c.17 0 .4-.06.62.48l.76 1.85c.06.13.1.28.02.45l-.31.5c-.12.16-.25.3-.11.55.14.25.62.97 1.32 1.57.9.78 1.66 1.02 1.9 1.14.23.12.37.1.5-.06l.72-.83c.16-.2.34-.16.55-.08l1.7.83c.22.1.36.16.42.24.05.09.05.5-.18 1.05z" fill={color} stroke="none" />;
    default:         return null;
  }
}
