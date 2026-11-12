import { useEffect, useState } from "react";
import { useStore } from "./store";
import { Icon } from "./icons";
import { cx } from "./format";

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
    <button type="button" className="icon-btn" onClick={onClick} aria-label={`Bag, ${count} items`}>
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
