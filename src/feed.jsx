import { useEffect, useMemo, useRef, useState } from "react";
import { coinLabel, compact, cx, money, uid } from "./format";
import { CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, FollowButton } from "./ui";

export function Feed() {
  const { state, go, openSheet, toggleLike, isLive } = useStore();
  const [feedTab, setFeedTab] = useState("foryou");
  const [active, setActive] = useState(null);
  const [paused, setPaused] = useState(false);
  const [pop, setPop] = useState(false);
  const scrollerRef = useRef(null);
  const prevCoins = useRef(state.coins);

  const catalog = useMemo(() => {
    if (feedTab === "following") return state.clips.filter((clip) => state.following[clip.creatorId]);
    return state.clips;
  }, [feedTab, state.clips, state.following]);

  const catalogKey = catalog.map((clip) => clip.id).join("|");
  const items = catalog;

  useEffect(() => {
    setPaused(false);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [feedTab, catalogKey]);

  useEffect(() => {
    if (prevCoins.current !== state.coins) {
      prevCoins.current = state.coins;
      setPop(true);
      const timer = setTimeout(() => setPop(false), 380);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.coins]);

  useEffect(() => {
    setPaused(false);
  }, [active]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !items.length) return undefined;
    const cards = [...root.querySelectorAll("[data-clip]")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.62)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.dataset.clip);
      },
      { root, threshold: [0.62, 0.85] },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items.length, feedTab]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest("input, textarea")) return;
      if (state.view !== "feed" || state.sheet || state.orderFlash) return;
      const root = scrollerRef.current;
      if (!root) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        root.scrollBy({ top: root.clientHeight, behavior: "smooth" });
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        root.scrollBy({ top: -root.clientHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.view, state.sheet, state.orderFlash]);

  const suggestions = state.people.filter((creator) => creator.id !== state.profile?.id && !state.following[creator.id]).slice(0, 6);

  return (
    <section className={state.view === "feed" ? "feed" : "feed is-hidden"} aria-label="Speedy feed">
      <div className="feed-scroller" ref={scrollerRef}>
        {items.length === 0 && (
          <div className="empty">
            <h2>{feedTab === "following" ? "Nothing from people you follow" : "No posts yet"}</h2>
            <p>{feedTab === "following" ? "Follow someone, or post a clip of your own." : "Post a clip when you have something to show."}</p>
            <button type="button" className="btn" onClick={() => openSheet({ type: "post" })}>
              Post a clip
            </button>
            {feedTab === "following" && suggestions.length > 0 && (
              <div className="suggest">
                {suggestions.map((creator) => (
                  <div className="person" key={creator.id}>
                    <button type="button" onClick={() => openSheet({ type: "creator", creatorId: creator.id })} aria-label={creator.name}>
                      <Avatar src={creator.avatar} name={creator.name} size={44} ring={isLive(creator.id)} />
                    </button>
                    <button type="button" className="person-copy" onClick={() => openSheet({ type: "creator", creatorId: creator.id })}>
                      <b>{creator.name}</b>
                      <span className="note">@{creator.handle}</span>
                    </button>
                    <FollowButton id={creator.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {items.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            active={active === clip.id}
            paused={paused && active === clip.id}
            onTogglePause={() => setPaused((value) => !value)}
            onLike={() => {
              if (!state.liked[clip.id]) toggleLike(clip.id);
            }}
          />
        ))}
        {items.length > 0 && (
          <section className="clip endcap">
            <h2>That's everything</h2>
            <p>New posts show up here.</p>
          </section>
        )}
      </div>
      <header className="feed-top">
        <div className="feed-side">
          <button type="button" className="live-pill" onClick={() => go("live")}>
            <i className="dot ping" />
            LIVE
          </button>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" className={feedTab === "following" ? "on" : ""} onClick={() => setFeedTab("following")}>
            Following
          </button>
          <button type="button" className={feedTab === "foryou" ? "on" : ""} onClick={() => setFeedTab("foryou")}>
            For You
          </button>
        </div>
        <div className="feed-side right">
          <button type="button" className={cx("coin-pill", pop && "pop-num")} onClick={() => go("wallet")}>
            <CoinMark size={16} />
            <span className="num">{coinLabel(state.coins)}</span>
          </button>
        </div>
      </header>
    </section>
  );
}

function ClipCard({ clip, active, paused, onTogglePause, onLike }) {
  const { state, openSheet, toggleFollow, toggleLike, toggleSave, person, product, isLive } = useStore();
  const creator = person(clip.creatorId);
  const linked = clip.productId ? product(clip.productId) : null;
  const [hearts, setHearts] = useState([]);
  const [run, setRun] = useState(0);
  const tap = useRef({ time: 0, timer: 0, x: 0, y: 0 });
  const liked = !!state.liked[clip.id];
  const saved = !!state.savedClips[clip.id];

  useEffect(() => {
    if (active) setRun((value) => value + 1);
  }, [active]);

  const burst = (x, y) => {
    const id = uid("h");
    setHearts((list) => [...list, { id, x, y, rot: Math.round(Math.random() * 24 - 12) }].slice(-6));
    setTimeout(() => setHearts((list) => list.filter((heart) => heart.id !== id)), 860);
    onLike();
  };

  const onPointerDown = (event) => {
    if (event.target.closest("button, a, input, textarea")) return;
    tap.current.x = event.clientX;
    tap.current.y = event.clientY;
  };

  const onPointerUp = (event) => {
    if (event.target.closest("button, a, input, textarea")) return;
    const dx = Math.abs(event.clientX - tap.current.x);
    const dy = Math.abs(event.clientY - tap.current.y);
    if (dx > 12 || dy > 12) return;
    const now = Date.now();
    if (now - tap.current.time < 280) {
      window.clearTimeout(tap.current.timer);
      tap.current.time = 0;
      const rect = event.currentTarget.getBoundingClientRect();
      burst(event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
    tap.current.time = now;
    const stamp = now;
    tap.current.timer = window.setTimeout(() => {
      if (tap.current.time === stamp) onTogglePause();
    }, 280);
  };

  if (!creator) return null;

  return (
    <article
      className={cx("clip", paused && "paused")}
      data-clip={clip.id}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="clip-bg" style={{ background: clip.gradient, "--glow": clip.tint }}>
        {clip.word && <div className="clip-word">{clip.word}</div>}
        <img
          src={clip.image}
          alt=""
          style={{ objectPosition: clip.focus }}
          referrerPolicy="no-referrer"
          draggable="false"
          loading="lazy"
          onLoad={(event) => event.currentTarget.classList.add("show")}
          onError={(event) => event.currentTarget.remove()}
        />
        <div className="clip-shade" />
      </div>

      {hearts.map((heart) => (
        <span key={heart.id} className="burst" style={{ left: heart.x, top: heart.y, "--rot": `${heart.rot}deg` }}>
          <Icon name="heart" size={86} filled />
        </span>
      ))}

      {paused && (
        <div className="play">
          <span>
            <Icon name="play" size={34} />
          </span>
        </div>
      )}

      <div className="rail">
        <div className="avatar-wrap">
          <button type="button" aria-label={creator.name} onClick={() => openSheet({ type: "creator", creatorId: creator.id })}>
            <Avatar src={creator.avatar} name={creator.name} size={46} ring={isLive(creator.id)} />
          </button>
          {creator.id !== state.profile?.id && !state.following[creator.id] && (
            <button type="button" className="avatar-plus" aria-label={`Follow ${creator.name}`} onClick={() => toggleFollow(creator.id)}>
              <Icon name="plus" size={12} />
            </button>
          )}
        </div>
        <button type="button" className={liked ? "liked" : ""} aria-label={liked ? "Unlike" : "Like"} onClick={() => toggleLike(clip.id)}>
          <Icon name="heart" size={30} filled={liked} />
          <span className="count num">{compact(clip.likes)}</span>
        </button>
        <button type="button" aria-label="Comments" onClick={() => openSheet({ type: "comments", clipId: clip.id })}>
          <Icon name="comment" size={28} />
          <span className="count num">{compact(clip.comments)}</span>
        </button>
        <button type="button" className={saved ? "saved" : ""} aria-label={saved ? "Unsave" : "Save"} onClick={() => toggleSave(clip.id)}>
          <Icon name="bookmark" size={28} filled={saved} />
          <span className="count num">{compact(clip.saves)}</span>
        </button>
        <button type="button" aria-label="Share" onClick={() => openSheet({ type: "share", clipId: clip.id })}>
          <Icon name="share" size={28} />
        </button>
        {creator.avatar && <img className="disc" src={creator.avatar} alt="" referrerPolicy="no-referrer" />}
      </div>

      <div className="clip-meta">
        {linked && (
          <button type="button" className="pill" onClick={() => openSheet({ type: "quick", productId: linked.id })}>
            <img src={linked.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <span className="name">{linked.name}</span>
              <span className="price-row">
                <b>{money(linked.price)}</b>
                {linked.was ? <s className="was">{money(linked.was)}</s> : null}
                <span className="note"> · {compact(linked.sold)} sold</span>
              </span>
            </span>
            <span className="shop-chip">Shop</span>
          </button>
        )}
        <button type="button" className="handle" onClick={() => openSheet({ type: "creator", creatorId: creator.id })}>
          @{creator.handle}
        </button>
        <p className="caption">{clip.caption}</p>
        {clip.audio && (
          <div className="sound">
            <Icon name="music" size={14} />
            <span>{clip.audio}</span>
          </div>
        )}
      </div>

      <div className="scrub" aria-hidden="true">
        {active && <i key={run} className={paused ? "paused" : ""} />}
      </div>
    </article>
  );
}
