import { useEffect, useMemo, useState } from "react";
import { joinLive, leaveLive, loadMessages, sendMessage, uploadMedia, viewerCount } from "./account";
import { coinLabel, compact, cx, money, uid } from "./format";
import { BoltMark, CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, BagButton, Header, StockBar } from "./ui";

export function LiveLobby() {
  const { state, go, person } = useStore();
  const [featured, ...rest] = state.lives;
  return (
    <section className="page">
      <header className="subhead">
        <button type="button" className="icon-btn" aria-label="Search" onClick={() => go("search")}>
          <Icon name="search" size={22} />
        </button>
        <h1>Live</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>
      {!featured && (
        <div className="empty">
          <h2>Nobody is live</h2>
          <p>Start one when you have a product to sell.</p>
          <button type="button" className="btn" onClick={() => go("broadcast")}>
            Go live
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
      {featured && (
        <button type="button" className="text-link" onClick={() => go("broadcast")}>
          Start your own live
        </button>
      )}
    </section>
  );
}

export function LiveRoom() {
  const { state, go, back, openSheet, addToCart, earn, toggleFollow, person, product, live, stopLive, setViewers } = useStore();
  const room = live(state.param);
  const host = room ? person(room.creatorId) : null;
  const products = useMemo(() => (room ? room.productIds.map((id) => product(id)).filter(Boolean) : []), [room, product]);
  const [index, setIndex] = useState(0);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState(null);
  const [floats, setFloats] = useState([]);
  const mine = host && state.profile?.id === host.id;

  useEffect(() => {
    if (!room) return undefined;
    let stop = false;
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
    if (!room || state.earned.watch) return undefined;
    const timer = setTimeout(() => earn("watch", 10, "Watched a live"), 6000);
    return () => clearTimeout(timer);
  }, [room?.id, state.earned.watch]);

  useEffect(() => {
    if (!state.lastGift || state.lastGift.creatorId !== room?.creatorId) return undefined;
    setBanner({ ...state.lastGift, from: state.profile?.name || "You" });
    const timer = setTimeout(() => setBanner(null), 1700);
    return () => clearTimeout(timer);
  }, [state.lastGift, room?.creatorId, state.profile?.name]);

  if (!room || !host) {
    return (
      <section className="page sub">
        <Header title="Live" fallback="live" />
        <div className="empty">
          <p>That room has ended.</p>
          <button type="button" className="btn" onClick={() => go("live")}>
            See who's live
          </button>
        </div>
      </section>
    );
  }

  const pinned = products[index] ?? products[0];
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
    setDraft("");
    setThread((list) => [...list, { id: uid("m"), kind: "chat", user: state.profile?.name || "You", text }].slice(-7));
    try {
      await sendMessage(room.id, text);
    } catch (error) {
      setThread((list) => list.slice(0, -1));
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
    await stopLive(room.id);
    go("live");
  };

  return (
    <section className="stack room" onClick={float}>
      <img className="room-photo" src={room.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: room.focus }} />
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
          <button type="button" className="btn end" onClick={end}>
            End
          </button>
        ) : (
          <button type="button" className="icon-btn" aria-label="Close live" onClick={() => back("live")}>
            <Icon name="close" size={22} />
          </button>
        )}
      </header>

      <div className="sold-pill">{compact(room.sold)} sold this live</div>

      <div className="room-comments" aria-live="polite">
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
            <b>{banner.from} sent {banner.name}</b>
            <span>{banner.coins} coins</span>
          </div>
        </div>
      )}

      {pinned && (
        <div className="pin">
          <button type="button" className="pin-main" onClick={() => openSheet({ type: "quick", productId: pinned.id, liveId: room.id })}>
            <img src={pinned.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <span className="name">{pinned.name}</span>
              <span className="price-row">
                <b>{money(pinned.price)}</b>
                {pinned.was ? <s className="was">{money(pinned.was)}</s> : null}
              </span>
              <StockBar left={left} stock={pinned.stock} />
              <span className="note">{left > 0 ? `${left} left` : "Sold out"}</span>
            </span>
          </button>
          <button type="button" className="btn grab" disabled={left <= 0} onClick={grab}>
            {left > 0 ? "Grab" : "Wait"}
          </button>
        </div>
      )}

      <form className="room-bar" onSubmit={send}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Say something"
          aria-label="Comment"
          maxLength={140}
          enterKeyHint="send"
        />
        {!mine && (
          <button type="button" className="round gift" aria-label="Send a gift" onClick={() => openSheet({ type: "gift", creatorId: host.id })}>
            <Icon name="gift" size={20} />
          </button>
        )}
        <BagButton
          count={state.cart.reduce((sum, line) => sum + line.qty, 0)}
          onClick={() => openSheet({ type: "cart", liveId: room.id })}
        />
      </form>
    </section>
  );
}

export function Broadcast() {
  const { state, go, publishLive, pushToast } = useStore();
  const mine = state.products.filter((product) => product.creatorId === state.profile?.id && product.stock > 0);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState([]);
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id) => {
    setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  };

  const start = async (event) => {
    event.preventDefault();
    if (!title.trim() || picked.length === 0) return;
    setBusy(true);
    try {
      const first = mine.find((product) => product.id === picked[0]);
      const id = await publishLive({
        title: title.trim(),
        coverUrl: cover || first.image,
        productIds: picked,
      });
      go("room", id);
    } catch (error) {
      pushToast(error.message);
      setBusy(false);
    }
  };

  if (mine.length === 0) {
    return (
      <section className="page sub">
        <Header title="Go live" fallback="live" />
        <div className="empty">
          <h2>List a product first</h2>
          <p>A live needs something you actually have in stock.</p>
          <button type="button" className="btn" onClick={() => go("shop")}>
            Open the shop
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page sub">
      <Header title="Go live" fallback="live" />
      <form className="auth-form pad" onSubmit={start}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
        </label>
        <PhotoField label="Cover photo" value={cover} onChange={setCover} />
        <p className="note">Leave the cover empty to use the first product photo.</p>
        <p className="note">Products</p>
        {mine.map((product) => (
          <button type="button" key={product.id} className={cx("list-row", picked.includes(product.id) && "unread")} onClick={() => toggle(product.id)}>
            <img src={product.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <b>{product.name}</b>
              <span className="note">{money(product.price)} · {product.stock} left</span>
            </span>
          </button>
        ))}
        <button type="submit" className="btn block" disabled={busy || !title.trim() || picked.length === 0}>
          {busy ? "Starting" : "Start live"}
        </button>
      </form>
    </section>
  );
}

export function PhotoField({ label, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadMedia(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <label>
      {label}
      <input type="file" accept="image/*" onChange={onFile} />
      {busy && <span className="note">Uploading…</span>}
      {value && <img className="upload-preview" src={value} alt="" />}
      {error && <span className="auth-error">{error}</span>}
    </label>
  );
}

function unitsLeft(product, state) {
  const inCart = state.cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.qty, 0);
  return Math.max(0, product.stock - inCart);
}
