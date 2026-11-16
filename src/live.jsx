import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { joinLive, leaveLive, liveEnded, loadMessages, sendMessage, viewerCount } from "./account";
import { coinLabel, compact, cx, money, uid } from "./format";
import { BoltMark, CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, BagButton, Header, MediaPicker, StockBar } from "./ui";

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
        <button type="button" className="icon-btn" aria-label="Search" onClick={() => go("search")}>
          <Icon name="search" size={22} />
        </button>
        <h1>LIVE</h1>
        <button type="button" className="btn slim live-btn" onClick={() => (own ? go("room", own.id) : go("broadcast"))}>
          {own ? "Your LIVE" : "Go LIVE"}
        </button>
      </header>
      {!featured && (
        <div className="empty">
          <Icon name="live" size={36} />
          <h2>Nobody is live right now</h2>
          <p>Go live to show off your products. Viewers can chat, send gifts and buy while you're on.</p>
          <button type="button" className="btn" onClick={() => go("broadcast")}>
            Go LIVE
          </button>
        </div>
      )}
      {featured && (
        <button type="button" className="hero-live" onClick={() => go("room", featured.id)}>
          <img src={featured.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: featured.focus }} />
          <span className="shade" />
          <span className="view-chip">
            <i className="dot ping" /> LIVE · {compact(featured.viewers)}
          </span>
          <span className="live-copy">
            <strong>{featured.title}</strong>
            <span>
              {person(featured.creatorId)?.name} · {compact(featured.sold)} sold
            </span>
          </span>
        </button>
      )}
      {rest.length > 0 && (
        <>
          <div className="section">
            <h2>Happening now</h2>
          </div>
          <div className="live-grid">
            {rest.map((live) => {
              const host = person(live.creatorId);
              return (
                <button type="button" className="live-card" key={live.id} onClick={() => go("room", live.id)}>
                  <img src={live.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: live.focus }} />
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
        </>
      )}
    </section>
  );
}

export function LiveRoom() {
  const { state, go, back, openSheet, addToCart, earn, toggleFollow, person, product, live, stopLive, dropLive, setViewers, pushToast } =
    useStore();
  const room = live(state.param);
  const host = room ? person(room.creatorId) : null;
  const products = useMemo(() => (room ? room.productIds.map((id) => product(id)).filter(Boolean) : []), [room, product]);
  const [index, setIndex] = useState(0);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState(null);
  const [floats, setFloats] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const mine = host && state.profile?.id === host.id;

  useEffect(() => {
    if (!room) return undefined;
    let stop = false;
    setIndex(0);
    setThread([]);
    joinLive(room.id).catch(() => {});
    const pull = () => {
      viewerCount(room.id)
        .then((count) => {
          if (!stop) setViewers(room.id, count);
        })
        .catch(() => {});
      loadMessages(room.id)
        .then((messages) => {
          if (!stop) setThread(messages.slice(-7));
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
            See who's live
          </button>
        </div>
      </section>
    );
  }

  const pinned = products[index % Math.max(1, products.length)] ?? null;
  const left = pinned ? unitsLeft(pinned, state) : 0;

  const float = (event) => {
    if (event.target.closest("button, input, a, form")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = uid("f");
    setFloats((list) => [...list, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }].slice(-8));
    setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 900);
  };

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const id = uid("m");
    setDraft("");
    setThread((list) => [...list, { id, kind: "chat", user: state.profile?.name || "You", text }].slice(-7));
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
    <section className="stack room" onClick={float}>
      <Suspense
        fallback={
          <div className="room-stage">
            <img className="room-photo" src={room.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: room.focus }} />
          </div>
        }
      >
        <LiveStream liveId={room.id} isHost={mine} cover={room.cover} focus={room.focus} />
      </Suspense>
      <div className="clip-shade" />
      {floats.map((item) => (
        <span key={item.id} className="float-heart" style={{ left: item.x, top: item.y }}>
          <Icon name="heart" size={28} filled />
        </span>
      ))}
      <header className="room-top">
        <button type="button" className="host-pill" onClick={() => openSheet({ type: "creator", creatorId: host.id })}>
          <Avatar src={host.avatar} name={host.name} size={34} />
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
        <button type="button" className="coin-pill" onClick={() => go("wallet")}>
          <CoinMark size={14} />
          <span className="num">{coinLabel(state.coins)}</span>
        </button>
        {mine ? (
          <button type="button" className="btn end" onClick={() => setConfirmEnd(true)}>
            End
          </button>
        ) : (
          <button type="button" className="icon-btn" aria-label="Leave live" onClick={() => back("live")}>
            <Icon name="close" size={22} />
          </button>
        )}
      </header>

      <div className="sold-pill">{compact(room.sold)} sold this LIVE</div>

      <div className="room-comments" aria-live="polite">
        {thread.length === 0 && (
          <p className="bubble system">
            <span>{mine ? "You're live. Say hi to your viewers." : `Welcome! Say hi to ${host.name}.`}</span>
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
          <BoltMark size={54} />
          <div>
            <b>
              {banner.from} sent {banner.name}
            </b>
            <span>{banner.coins} coins</span>
          </div>
        </div>
      )}

      {pinned && (
        <div className="pin">
          {products.length > 1 && (
            <button type="button" className="pin-step" aria-label="Previous product" onClick={() => setIndex((value) => (value - 1 + products.length) % products.length)}>
              <Icon name="back" size={16} />
            </button>
          )}
          <button type="button" className="pin-main" onClick={() => openSheet({ type: "quick", productId: pinned.id, liveId: room.id })}>
            <img src={pinned.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <span className="name">{pinned.name}</span>
              <span className="price-row">
                <b>{money(pinned.price)}</b>
                {pinned.was ? <s className="was">{money(pinned.was)}</s> : null}
              </span>
              <StockBar left={left} stock={pinned.stock} />
              <span className="note">
                {left > 0 ? `${left} left` : "Sold out"}
                {products.length > 1 ? ` · ${(index % products.length) + 1}/${products.length}` : ""}
              </span>
            </span>
          </button>
          {products.length > 1 && (
            <button type="button" className="pin-step" aria-label="Next product" onClick={() => setIndex((value) => (value + 1) % products.length)}>
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
          placeholder="Add comment…"
          aria-label="Comment"
          maxLength={140}
          enterKeyHint="send"
        />
        {draft.trim() && (
          <button type="submit" className="round send" aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        )}
        {!mine && (
          <button type="button" className="round gift" aria-label="Send a gift" onClick={() => openSheet({ type: "gift", creatorId: host.id })}>
            <Icon name="gift" size={20} />
          </button>
        )}
        {!mine && (
          <BagButton count={state.cart.reduce((sum, line) => sum + line.qty, 0)} onClick={() => openSheet({ type: "cart", liveId: room.id })} />
        )}
      </form>

      {confirmEnd && (
        <div className="confirm-wrap" onClick={(event) => event.stopPropagation()}>
          <div className="confirm">
            <h2>End your LIVE?</h2>
            <p className="note">Viewers will be told the LIVE has ended.</p>
            <div className="row gap">
              <button type="button" className="btn ghost grow-btn" onClick={() => setConfirmEnd(false)} disabled={ending}>
                Keep going
              </button>
              <button type="button" className="btn danger grow-btn" onClick={end} disabled={ending}>
                {ending ? "Ending…" : "End LIVE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function Broadcast() {
  const { state, go, openSheet, publishLive, pushToast, liveFor } = useStore();
  const mine = state.products.filter((product) => product.creatorId === state.profile?.id && product.stock > 0);
  const own = state.profile ? liveFor(state.profile.id) : null;
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState([]);
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mine.length === 1 && picked.length === 0) setPicked([mine[0].id]);
  }, [mine.length]);

  const toggle = (id) => {
    setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  };

  const start = async (event) => {
    event.preventDefault();
    if (!title.trim()) return pushToast("Give your LIVE a title");
    if (picked.length === 0) return pushToast("Pick at least one product");
    setBusy(true);
    try {
      const first = mine.find((product) => product.id === picked[0]);
      const id = await publishLive({
        title: title.trim(),
        coverUrl: cover || first.image,
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
          <button type="button" className="btn" onClick={() => go("room", own.id, { replace: true })}>
            Return to your LIVE
          </button>
        </div>
      </section>
    );
  }

  if (mine.length === 0) {
    return (
      <section className="page sub">
        <Header title="Go LIVE" fallback="live" />
        <div className="empty">
          <Icon name="bag" size={36} />
          <h2>List a product first</h2>
          <p>A LIVE sells products you have in stock. Add one and come back.</p>
          <button type="button" className="btn" onClick={() => openSheet({ type: "list" })}>
            Sell a product
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page sub">
      <Header title="Go LIVE" fallback="live" />
      <form className="auth-form pad" onSubmit={start}>
        <MediaPicker label="Add cover photo" hint="Optional. We'll use your first product photo." value={cover} onChange={setCover} />
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="e.g. Sneaker drop, 20% off" required />
        </label>
        <div className="field">
          <span className="field-label">Products to sell · {picked.length} picked</span>
          {mine.map((product) => {
            const on = picked.includes(product.id);
            return (
              <button type="button" key={product.id} className={cx("list-row pick", on && "on")} onClick={() => toggle(product.id)} aria-pressed={on}>
                <img src={product.image} alt="" referrerPolicy="no-referrer" />
                <span className="grow">
                  <b>{product.name}</b>
                  <span className="note">
                    {money(product.price)} · {product.stock} left
                  </span>
                </span>
                <span className={cx("check", on && "on")}>{on && <Icon name="check" size={14} />}</span>
              </button>
            );
          })}
        </div>
        <p className="note">Your phone will ask for camera and mic. Viewers see your stream, chat, gifts and products.</p>
        <button type="submit" className="btn block live-btn" disabled={busy}>
          {busy ? "Starting…" : "Start LIVE"}
        </button>
      </form>
    </section>
  );
}

function unitsLeft(product, state) {
  const inCart = state.cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.qty, 0);
  return Math.max(0, product.stock - inCart);
}
