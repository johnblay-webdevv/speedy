import { useEffect, useRef, useState } from "react";
import { uploadMedia } from "./account";
import { useStore } from "./store";
import { Icon } from "./icons";
import { cx, isVideo } from "./format";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export function Avatar({ src, name = "", size = 44, ring = false }) {
  const [bad, setBad] = useState(false);
  const style = { width: size, height: size };
  const inner =
    !src || bad ? (
      <span className="avatar avatar-fallback" style={style}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    ) : (
      <img
        className="avatar"
        src={src}
        alt=""
        style={style}
        referrerPolicy="no-referrer"
        draggable="false"
        onError={() => setBad(true)}
      />
    );
  if (!ring) return inner;
  return (
    <span className="ring" style={{ width: size + 4, height: size + 4 }}>
      {inner}
    </span>
  );
}

export function FollowButton({ id }) {
  const { state, toggleFollow } = useStore();
  const on = !!state.following[id];
  return (
    <button type="button" className={cx("follow", on && "on")} onClick={() => toggleFollow(id)} aria-pressed={on}>
      {on ? "Following" : "Follow"}
    </button>
  );
}

export function Header({ title, fallback = "feed", right }) {
  const { back } = useStore();
  return (
    <header className="subhead">
      <button type="button" className="icon-btn" onClick={() => back(fallback)} aria-label="Back">
        <Icon name="back" size={26} />
      </button>
      <h1>{title}</h1>
      <div className="subhead-right">{right || <span className="icon-btn" aria-hidden="true" />}</div>
    </header>
  );
}

export function BagButton({ onClick, count }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`}>
      <Icon name="bag" size={24} />
      {count > 0 && <em>{count > 9 ? "9+" : count}</em>}
    </button>
  );
}

export function StockBar({ left, stock }) {
  const pct = stock > 0 ? Math.max(4, Math.min(100, (left / stock) * 100)) : 0;
  return (
    <span className="stock" aria-hidden="true">
      <i style={{ width: `${left <= 0 ? 0 : pct}%` }} />
    </span>
  );
}

export function Thumb({ src, alt = "" }) {
  if (isVideo(src)) return <video src={`${src}#t=0.1`} muted playsInline preload="metadata" aria-label={alt} />;
  return <img src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy" />;
}

export function MediaPicker({ label, value, onChange, video = false, hint }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadMedia(file, { allowVideo: video }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="picker-wrap">
      <button type="button" className={cx("picker", value && "has")} onClick={() => inputRef.current?.click()} disabled={busy}>
        {value ? (
          <Thumb src={value} alt={label} />
        ) : (
          <span className="picker-empty">
            <Icon name="plus" size={26} />
            <b>{busy ? "Uploading…" : label}</b>
            {hint && <span className="note">{hint}</span>}
          </span>
        )}
        {value && <span className="picker-change">{busy ? "Uploading…" : "Change"}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={video ? "image/*,video/*" : "image/*"}
        onChange={onFile}
        hidden
        aria-label={label}
      />
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}

export function Photo({ src, alt = "", focus = "center", className }) {
  const [on, setOn] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      className={cx(className, on && "show")}
      style={{ objectPosition: focus }}
      referrerPolicy="no-referrer"
      draggable="false"
      onLoad={(event) => {
        event.currentTarget.classList.add("show");
        setOn(true);
      }}
      onError={(event) => event.currentTarget.remove()}
    />
  );
}
