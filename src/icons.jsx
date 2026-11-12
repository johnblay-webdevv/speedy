export function Icon({ name, size = 24, filled = false }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "live":
      return (
        <svg {...props}>
          <circle cx="7" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <path d="M11 8.2a5.2 5.2 0 0 1 0 7.6" />
          <path d="M14.3 5.5a9 9 0 0 1 0 13" />
        </svg>
      );
    case "bag":
      return (
        <svg {...props}>
          <path d="M6.5 8h11l-.8 11.2a1 1 0 0 1-1 .8H8.3a1 1 0 0 1-1-.8L6.5 8z" />
          <path d="M9 8V6.8A3 3 0 0 1 12 4a3 3 0 0 1 3 2.8V8" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.1" />
          <path d="M5.2 19.2c1.3-2.8 3.6-4.2 6.8-4.2s5.5 1.4 6.8 4.2" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props} fill={filled ? "currentColor" : "none"}>
          <path d="M12 19.4s-6.6-4.1-8.6-7.7C2 9.2 3.1 6.2 6 5.5c1.7-.4 3.3.2 4.2 1.6.9-1.4 2.5-2 4.2-1.6 2.9.7 4 3.7 2.6 6.2-2 3.6-8.6 7.7-8.6 7.7z" />
        </svg>
      );
    case "comment":
      return (
        <svg {...props}>
          <path d="M6 17.2 4.2 20V6.6A1.6 1.6 0 0 1 5.8 5h12.4A1.6 1.6 0 0 1 19.8 6.6v8.2a1.6 1.6 0 0 1-1.6 1.6H8z" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...props} fill={filled ? "currentColor" : "none"}>
          <path d="M7 4.6h10A1.4 1.4 0 0 1 18.4 6v13.6L12 16.2 5.6 19.6V6A1.4 1.4 0 0 1 7 4.6z" />
        </svg>
      );
    case "share":
      return (
        <svg {...props}>
          <path d="M12 15.5V4.5" />
          <path d="m7.6 8.2 4.4-4.2 4.4 4.2" />
          <path d="M6 12.2V19h12v-6.8" />
        </svg>
      );
    case "music":
      return (
        <svg {...props}>
          <path d="M9 18V6.2L19 4.2V16" />
          <circle cx="7.2" cy="18" r="2" />
          <circle cx="17" cy="16" r="2" />
        </svg>
      );
    case "back":
      return (
        <svg {...props}>
          <path d="M15 5 8 12l7 7" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="m9 5 7 7-7 7" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props}>
          <rect x="4" y="10" width="16" height="9" rx="1.4" />
          <path d="M12 10v9M4 14h16" />
          <path d="M12 10c0-2.6-1.8-4.2-3.4-3.2C7.2 7.6 8.4 10 12 10c3.6 0 4.8-2.4 3.4-3.2C13.8 5.8 12 7.4 12 10z" />
        </svg>
      );
    case "eye":
      return (
        <svg {...props}>
          <path d="M2.8 12S6.4 6.6 12 6.6 21.2 12 21.2 12 17.6 17.4 12 17.4 2.8 12 2.8 12z" />
          <circle cx="12" cy="12" r="2.1" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="m5 12.4 4.2 4.2L19 7.2" />
        </svg>
      );
    case "star":
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="m12 3.4 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.7l5-.7L12 3.4z" />
        </svg>
      );
    case "truck":
      return (
        <svg {...props}>
          <path d="M3 7.5h11v8H3z" />
          <path d="M14 10.5h4.1L21 13.4V15.5h-7" />
          <circle cx="7" cy="17.6" r="1.3" />
          <circle cx="17" cy="17.6" r="1.3" />
        </svg>
      );
    case "box":
      return (
        <svg {...props}>
          <path d="M3.5 8 12 4.2 20.5 8 12 11.8 3.5 8z" />
          <path d="M3.5 8v8L12 19.8 20.5 16V8" />
          <path d="M12 11.8V19.8" />
        </svg>
      );
    case "card":
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="m4.5 12 15-7.2-5.6 15.2-2.2-6.2L4.5 12z" />
        </svg>
      );
    case "flash":
      return (
        <svg {...props} fill={filled ? "currentColor" : "none"}>
          <path d="M13 2.6 6.4 13H11l-.8 8.4L18 10.2h-4.5L13 2.6z" />
        </svg>
      );
    case "play":
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="M8 5.2v13.6L19.2 12 8 5.2z" />
        </svg>
      );
    case "verified":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.4 12.2 2.4 2.4 4.8-5.2" />
        </svg>
      );
    case "more":
      return (
        <svg {...props}>
          <circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

const BOLT = "M30 2.2 13.2 23.2h10.2L18 46.2 40.2 19.6H28.2L34.2 2.2z";

export function BoltMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d={BOLT} fill="#3df0ff" transform="translate(-1.5 0.2)" />
      <path d={BOLT} fill="#ff335c" transform="translate(1.7 -0.2)" />
      <path d={BOLT} fill="#fff" />
    </svg>
  );
}

export function CoinMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#17140c" stroke="#ffd36a" strokeWidth="1.4" />
      <path d="M13.1 5.2 8 12.2h3.3l-1 6.6 6.2-8.2h-3.2l1.8-5.4z" fill="#ffd36a" />
    </svg>
  );
}
