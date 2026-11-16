import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { joinLive, leaveLive, liveEnded, loadMessages, sendMessage, viewerCount } from "./account";
import { compact, cx, money, uid } from "./format";
import { BoltMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, BagButton, Header } from "./ui";

const LiveStream = lazy(() => import("./stream").then((mod) => ({ default: mod.LiveStream })));

export function LiveLobby() {
  const { state, go, person, liveFor, refreshCatalog } = useStore();
  const [featured, ...rest] = state.lives;
  const own = state.profile ? liveFor(state.profile.id) : null;
  const visible = state.view === "live";

  useEffect(() => {
    if (!visible) return undefined;
    refreshCatalog().catch(() => {});
    const timer = setInterval(() => refreshCatalog().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <section className="page">
      <header className="subhead">
        <span className="subhead-spacer" />
        <h1>LIVE</h1>
        <button type="button" className="btn slim live-btn" onClick={() => (own ? go("room", own.id) : go("broadcast"))}>
          {own ? "Your LIVE" : "Go LIVE"}
        </button>
      </header>
      {!featured && (
        <div className="empty">
          <Icon name="live" size={36} />
          <h2>Nobody is live</h2>
          <p>Go live with your camera. People can watch, chat and send gifts.</p>
          <button type="button" className="btn live-btn" onClick={() => go("broadcast")}>
            Go LIVE
          </button>
        </div>
      )}
      {featured && (
        <button type="button" className="hero-live" onClick={() => go("room", featured.id)}>
          {featured.cover ? (
            <img src={featured.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: featured.focus }} />
          ) : (
            <span className="live-fallback" />
          )}
          <span className="shade" />
          <span className="view-chip">
            <i className="dot ping" /> LIVE · {compact(featured.viewers)}
          </span>
          <span className="live-copy">
            <strong>{featured.title}</strong>
            <span>{person(featured.creatorId)?.name}</span>
          </span>
        </button>
      )}
      {rest.length > 0 && (
        <div className="live-grid">
          {rest.map((live) => {
            const host = person(live.creatorId);
            return (
              <button type="button" className="live-card" key={live.id} onClick={() => go("room", live.id)}>
                {live.cover ? (
                  <img src={live.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: live.focus }} />
                ) : (
                  <span className="live-fallback" />
                )}
                <span className="shade" />
                <span className="view-chip">
                  <i className="dot" /> {compact(live.viewers)}
                </span>
                <span className="live-copy">
                  <strong>{host?.name}</strong>
                  <span>{live.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function LiveRoom() {
  const { state, go, back, openSheet, addToCart, earn, toggleFollow, person, product, live, stopLive, dropLive, setViewers, pushToast } =
    useStore();
  const room = live(state.param);
  const host = room ? person(room.creatorId) : null;
  const products = useMemo(() => (room ? (room.productIds || []).map((id) => product(id)).filter(Boolean) : []), [room, product]);
  const [index, setIndex] = useState(0);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const mine = host && state.profile?.id === host.id;

  useEffect(() => {
    if (!room) return undefined;
    let stop = false;
    setIndex(0);
    setThread([]);
    setShopOpen(false);
    joinLive(room.id).catch(() => {});
    const pull = () => {
      viewerCount(room.id)
        .then((count) => {
          if (!stop) setViewers(room.id, count);
        })
        .catch(() => {});
      loadMessages(room.id)
        .then((messages) => {
          if (!stop) setThread(messages.slice(-6));
        })
        .catch(() => {});
      liveEnded(room.id)
        .then((ended) => {
          if (!stop && ended) dropLive(room.id);
        })
        .catch(() => {});
    };
    pull();
    const timer = setInterval(pull, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
      leaveLive(room.id).catch(() => {});
    };
  }, [room?.id]);

  useEffect(() => {
    if (!room || mine || state.earned.watch) return undefined;
    const timer = setTimeout(() => earn("watch", 10, "Watched a live"), 6000);
    return () => clearTimeout(timer);
  }, [room?.id, state.earned.watch, mine]);

  useEffect(() => {
    if (!state.lastGift || state.lastGift.creatorId !== room?.creatorId) return undefined;
    setBanner({ ...state.lastGift, from: state.profile?.name || "You" });
    const timer = setTimeout(() => setBanner(null), 1700);
    return () => clearTimeout(timer);
  }, [state.lastGift, room?.creatorId, state.profile?.name]);

  if (!room || !host) {
    return (
      <section className="page sub">
        <Header title="LIVE" fallback="live" />
        <div className="empty">
          <Icon name="live" size={36} />
          <h2>This LIVE has ended</h2>
          <button type="button" className="btn" onClick={() => go("live", null, { replace: true })}>
            Back to LIVE
          </button>
        </div>
      </section>
    );
  }

  const pinned = products[index] ?? null;
  const left = pinned ? unitsLeft(pinned, state) : 0;
  const bagCount = state.cart.reduce((sum, line) => sum + line.qty, 0);

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const id = uid("m");
    setDraft("");
    setThread((list) => [...list, { id, kind: "chat", user: state.profile?.name || "You", text }].slice(-6));
    try {
      await sendMessage(room.id, text);
    } catch (error) {
      setThread((list) => list.filter((item) => item.id !== id));
      setDraft(text);
      pushToast(error.message);
    }
  };

  const grab = () => {
    if (!pinned || left <= 0) return;
    if (pinned.sizes?.length) {
      openSheet({ type: "quick", productId: pinned.id, liveId: room.id });
      return;
    }
    addToCart(pinned.id, null, 1);
  };

  const end = async () => {
    setEnding(true);
    try {
      await stopLive(room.id);
      pushToast("Your LIVE has ended");
      go("live", null, { replace: true });
    } catch (error) {
      pushToast(error.message);
      setEnding(false);
    }
  };

  return (
    <section className="stack room">
      <Suspense
        fallback={
          <div className="room-stage">
            {room.cover ? (
              <img className="room-photo" src={room.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: room.focus }} />
            ) : (
              <span className="live-fallback" />
            )}
          </div>
        }
      >
        <LiveStream liveId={room.id} isHost={mine} cover={room.cover} focus={room.focus} />
      </Suspense>
      <div className="clip-shade" />

      <header className="room-top">
        <button type="button" className="host-pill" onClick={() => openSheet({ type: "creator", creatorId: host.id })}>
          <Avatar src={host.avatar} name={host.name} size={32} />
          <span>
            <b>{host.name}</b>
            <span className="live-badge">LIVE</span>
          </span>
        </button>
        {!mine && !state.following[host.id] && (
          <button type="button" className="follow tiny" onClick={() => toggleFollow(host.id)}>
            Follow
          </button>
        )}
        <span className="view-chip room-view">
          <Icon name="eye" size={14} /> {compact(room.viewers)}
        </span>
        {mine ? (
          <button type="button" className="btn end" onClick={() => setConfirmEnd(true)}>
            End
          </button>
        ) : (
          <button type="button" className="icon-btn" aria-label="Leave" onClick={() => back("live")}>
            <Icon name="close" size={22} />
          </button>
        )}
      </header>

      <div className={cx("room-comments", products.length > 0 && shopOpen && "raised")} aria-live="polite">
        {thread.length === 0 && (
          <p className="bubble system">
            <span>{mine ? "You're live. Say hi." : `Say hi to ${host.name}`}</span>
          </p>
        )}
        {thread.map((item) => (
          <p key={item.id} className={cx("bubble", item.kind)}>
            <b>{item.user}</b>
            <span>{item.text}</span>
          </p>
        ))}
      </div>

      {banner && (
        <div className="gift-banner" key={banner.nonce}>
          <BoltMark size={44} />
          <div>
            <b>
              {banner.from} sent {banner.name}
            </b>
            <span>{banner.coins} coins</span>
          </div>
        </div>
      )}

      {products.length > 0 && shopOpen && pinned && (
        <div className="pin slim">
          {products.length > 1 && (
            <button type="button" className="pin-step" aria-label="Previous" onClick={() => setIndex((value) => (value - 1 + products.length) % products.length)}>
              <Icon name="back" size={16} />
            </button>
          )}
          <button type="button" className="pin-main" onClick={() => openSheet({ type: "quick", productId: pinned.id, liveId: room.id })}>
            <img src={pinned.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <span className="name">{pinned.name}</span>
              <span className="price-row">
                <b>{money(pinned.price)}</b>
                {left > 0 ? <span className="note">{left} left</span> : <span className="note">Sold out</span>}
              </span>
            </span>
          </button>
          {products.length > 1 && (
            <button type="button" className="pin-step" aria-label="Next" onClick={() => setIndex((value) => (value + 1) % products.length)}>
              <Icon name="chevron" size={16} />
            </button>
          )}
          {!mine && (
            <button type="button" className="btn grab" disabled={left <= 0} onClick={grab}>
              {left > 0 ? "Buy" : "Sold out"}
            </button>
          )}
        </div>
      )}

      <form className="room-bar" onSubmit={send}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Say something…"
          aria-label="Comment"
          maxLength={140}
          enterKeyHint="send"
        />
        {draft.trim() ? (
          <button type="submit" className="round send" aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        ) : null}
        {products.length > 0 && (
          <button type="button" className={cx("round", shopOpen && "on")} aria-label="Shop" onClick={() => setShopOpen((value) => !value)}>
            <Icon name="bag" size={18} />
          </button>
        )}
        {!mine && (
          <button type="button" className="round gift" aria-label="Gift" onClick={() => openSheet({ type: "gift", creatorId: host.id })}>
            <Icon name="gift" size={18} />
          </button>
        )}
        {!mine && bagCount > 0 && <BagButton count={bagCount} onClick={() => openSheet({ type: "cart", liveId: room.id })} />}
      </form>

      {confirmEnd && (
        <div className="confirm-wrap">
          <div className="confirm">
            <h2>End LIVE?</h2>
            <p className="note">Viewers will leave this room.</p>
            <div className="row gap">
              <button type="button" className="btn ghost grow-btn" onClick={() => setConfirmEnd(false)} disabled={ending}>
                Keep going
              </button>
              <button type="button" className="btn danger grow-btn" onClick={end} disabled={ending}>
                {ending ? "Ending…" : "End"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function Broadcast() {
  const { state, go, back, publishLive, pushToast, liveFor } = useStore();
  const mine = state.products.filter((product) => product.creatorId === state.profile?.id && product.stock > 0);
  const own = state.profile ? liveFor(state.profile.id) : null;
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState([]);
  const [showShop, setShowShop] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (id) => {
    setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const first = mine.find((product) => picked.includes(product.id));
      const label = title.trim() || `${state.profile?.name || "My"} LIVE`;
      const id = await publishLive({
        title: label.slice(0, 80),
        coverUrl: first?.image || state.profile?.avatar || "",
        productIds: picked,
      });
      go("room", id, { replace: true });
    } catch (error) {
      pushToast(error.message);
      setBusy(false);
    }
  };

  if (own) {
    return (
      <section className="page sub">
        <Header title="Go LIVE" fallback="live" />
        <div className="empty">
          <h2>You're already live</h2>
          <button type="button" className="btn live-btn" onClick={() => go("room", own.id, { replace: true })}>
            Return to LIVE
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="stack go-live">
      <div className="go-live-stage">
        <span className="go-live-glow" />
        <Icon name="live" size={42} />
        <h1>Go LIVE</h1>
        <p>Tap start and allow camera and mic.</p>
      </div>

      <header className="go-live-top">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => back("live")}>
          <Icon name="close" size={22} />
        </button>
      </header>

      <div className="go-live-panel">
        <input
          className="go-live-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="Add a title (optional)"
          aria-label="LIVE title"
        />

        {mine.length > 0 && (
          <button type="button" className="go-live-shop" onClick={() => setShowShop((value) => !value)}>
            <Icon name="bag" size={16} />
            {picked.length ? `${picked.length} product${picked.length === 1 ? "" : "s"}` : "Add products (optional)"}
            <Icon name="chevron" size={14} />
          </button>
        )}

        {showShop && mine.length > 0 && (
          <div className="go-live-picks">
            {mine.map((product) => {
              const on = picked.includes(product.id);
              return (
                <button type="button" key={product.id} className={cx("go-live-pick", on && "on")} onClick={() => toggle(product.id)} aria-pressed={on}>
                  <img src={product.image} alt="" referrerPolicy="no-referrer" />
                  <span>
                    <b>{product.name}</b>
                    <span>{money(product.price)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" className="btn block live-btn go-live-start" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Start LIVE"}
        </button>
      </div>
    </section>
  );
}

function unitsLeft(product, state) {
  const inCart = state.cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.qty, 0);
  return Math.max(0, product.stock - inCart);
}
