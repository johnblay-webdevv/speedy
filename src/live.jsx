import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUYERS,
  COMMENT_LINES,
  GIFTS,
  LIVES,
  PRODUCTS,
  creatorMap,
  liveMap,
  productMap,
} from "./data";
import { coinLabel, compact, cx, money, uid } from "./format";
import { BoltMark, CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, BagButton, Header, StockBar } from "./ui";

export function LiveLobby() {
  const { go, openSheet } = useStore();
  const [featured, ...rest] = LIVES;
  return (
    <section className="page">
      <header className="subhead">
        <button type="button" className="icon-btn" aria-label="Search" onClick={() => go("search")}>
          <Icon name="search" size={22} />
        </button>
        <h1>Live</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>
      <button type="button" className="hero-live" onClick={() => go("room", featured.id)}>
        <img src={featured.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: featured.focus }} />
        <span className="shade" />
        <span className="view-chip">
          <i className="dot ping" /> LIVE · {compact(featured.viewers)}
        </span>
        <span className="live-copy">
          <strong>{featured.title}</strong>
          <span>
            {creatorMap[featured.creatorId].name} · {compact(featured.sold)} sold
          </span>
        </span>
      </button>
      <div className="section">
        <h2>Happening now</h2>
      </div>
      <div className="live-grid">
        {rest.map((live) => {
          const host = creatorMap[live.creatorId];
          return (
            <button type="button" className="live-card" key={live.id} onClick={() => go("room", live.id)}>
              <img src={live.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: live.focus }} />
              <span className="shade" />
              <span className="view-chip">
                <i className="dot" /> {compact(live.viewers)}
              </span>
              <span className="live-copy">
                <strong>{host.name}</strong>
                <span>{live.title}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="text-link" onClick={() => openSheet({ type: "bolt" })}>
        Start your own live
      </button>
    </section>
  );
}

export function LiveRoom() {
  const { state, go, back, openSheet, addToCart, bumpPressure, earn, toggleFollow } = useStore();
  const live = liveMap[state.param];
  const host = live ? creatorMap[live.creatorId] : null;
  const products = useMemo(
    () => (live ? live.productIds.map((id) => productMap[id]).filter(Boolean) : []),
    [live],
  );
  const [index, setIndex] = useState(0);
  const [viewers, setViewers] = useState(live?.viewers ?? 0);
  const [sold, setSold] = useState(live?.sold ?? 0);
  const [thread, setThread] = useState(() => seedThread(products));
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState(null);
  const [floats, setFloats] = useState([]);
  const earnRef = useRef(earn);
  const bumpRef = useRef(bumpPressure);
  earnRef.current = earn;
  bumpRef.current = bumpPressure;

  useEffect(() => {
    if (state.earned.watch) return undefined;
    const timer = setTimeout(() => earnRef.current("watch", 10, "Watched a live"), 6000);
    return () => clearTimeout(timer);
  }, [state.earned.watch]);

  useEffect(() => {
    const timer = setInterval(() => {
      setViewers((value) => Math.max(80, value + Math.round(Math.random() * 50 - 20)));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setIndex((value) => (value + 1) % Math.max(products.length, 1)), 7000);
    return () => clearInterval(timer);
  }, [products.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      const product = products[Math.floor(Math.random() * products.length)];
      if (!product) return;
      const kindRoll = Math.random();
      if (kindRoll < 0.22) {
        setSold((value) => value + 1);
        bumpRef.current(product.id, 1);
        setThread((list) =>
          [...list, { id: uid("m"), kind: "buy", user: pick(BUYERS), text: `grabbed ${product.name}` }].slice(-7),
        );
      } else if (kindRoll < 0.34) {
        setThread((list) => [...list, { id: uid("m"), kind: "join", user: pick(BUYERS), text: "joined" }].slice(-7));
      } else {
        setThread((list) =>
          [...list, { id: uid("m"), kind: "chat", user: pick(BUYERS), text: pick(COMMENT_LINES) }].slice(-7),
        );
      }
    }, 1700);
    return () => clearInterval(timer);
  }, [products]);

  useEffect(() => {
    if (!state.lastGift || state.lastGift.creatorId !== live?.creatorId) return undefined;
    setBanner({ ...state.lastGift, from: "You" });
    const timer = setTimeout(() => setBanner(null), 1700);
    return () => clearTimeout(timer);
  }, [state.lastGift, live?.creatorId]);

  if (!live || !host) {
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

  const product = products[index] ?? products[0];
  const left = product ? unitsLeft(product, state) : 0;

  const float = (event) => {
    if (event.target.closest("button, input, a, form")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = uid("f");
    setFloats((list) => [...list, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }].slice(-8));
    setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 900);
  };

  const send = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setThread((list) => [...list, { id: uid("m"), kind: "chat", user: "You", text }].slice(-7));
    setDraft("");
  };

  const grab = () => {
    if (!product || left <= 0) return;
    if (product.sizes?.length) {
      openSheet({ type: "quick", productId: product.id });
      return;
    }
    addToCart(product.id, null, 1);
    setSold((value) => value + 1);
  };

  return (
    <section className="stack room" onClick={float}>
      <img className="room-photo" src={live.cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: live.focus }} />
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
        {!state.following[host.id] && (
          <button type="button" className="follow tiny" onClick={() => toggleFollow(host.id)}>
            Follow
          </button>
        )}
        <span className="view-chip room-view">
          <Icon name="eye" size={14} /> {compact(viewers)}
        </span>
        <button type="button" className="coin-pill" onClick={() => go("wallet")}>
          <CoinMark size={14} />
          <span className="num">{coinLabel(state.coins)}</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Close live" onClick={() => back("live")}>
          <Icon name="close" size={22} />
        </button>
      </header>

      <div className="sold-pill">{compact(sold)} sold this live</div>

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
            <b>{banner.from === "You" ? "You" : banner.from} sent {banner.name}</b>
            <span>{banner.coins} coins</span>
          </div>
        </div>
      )}

      {product && (
        <div className="pin">
          <button type="button" className="pin-main" onClick={() => openSheet({ type: "quick", productId: product.id })}>
            <img src={product.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <span className="name">{product.name}</span>
              <span className="price-row">
                <b>{money(product.price)}</b>
                {product.was && <s className="was">{money(product.was)}</s>}
              </span>
              <StockBar left={left} stock={product.stock} />
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
        <button type="button" className="round gift" aria-label="Send a gift" onClick={() => openSheet({ type: "gift", creatorId: host.id })}>
          <Icon name="gift" size={20} />
        </button>
        <BagButton
          count={state.cart.reduce((sum, line) => sum + line.qty, 0)}
          onClick={() => openSheet({ type: "cart" })}
        />
      </form>
    </section>
  );
}

export function Broadcast() {
  const { back, credit } = useStore();
  const [count, setCount] = useState(3);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(1);
  const [feature, setFeature] = useState(0);
  const [note, setNote] = useState(null);
  const creditRef = useRef(credit);
  creditRef.current = credit;
  const product = PRODUCTS[feature % PRODUCTS.length];

  useEffect(() => {
    if (live) return undefined;
    if (count <= 0) {
      setLive(true);
      return undefined;
    }
    const timer = setTimeout(() => setCount((value) => value - 1), 700);
    return () => clearTimeout(timer);
  }, [count, live]);

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => {
      setViewers((value) => value + Math.ceil(Math.random() * 3));
      if (Math.random() > 0.45) {
        const gift = GIFTS[Math.floor(Math.random() * 3)];
        const buyer = pick(BUYERS);
        creditRef.current(gift.coins, `${buyer} sent ${gift.name}`);
        setNote({ id: uid("n"), buyer, gift: gift.name, coins: gift.coins });
      }
    }, 3200);
    return () => clearInterval(timer);
  }, [live]);

  return (
    <section className="stack room broadcast">
      <div className="broadcast-stage">
        <BoltMark size={88} />
        {!live ? <strong className="count-num">{count}</strong> : <p>You're live</p>}
      </div>
      <header className="room-top">
        <span className="live-badge">{live ? "LIVE" : "PREVIEW"}</span>
        <span className="view-chip">
          <Icon name="eye" size={14} /> {viewers}
        </span>
        <button type="button" className="btn end" onClick={() => back("feed")}>
          End
        </button>
      </header>
      <div className="pin broadcast-pin">
        <img src={product.image} alt="" referrerPolicy="no-referrer" />
        <span className="grow">
          <span className="note">Featuring</span>
          <span className="name">{product.name}</span>
          <b>{money(product.price)}</b>
        </span>
        <button type="button" className="btn ghost slim" onClick={() => setFeature((value) => value + 1)}>
          Next
        </button>
      </div>
      {note && (
        <div className="gift-banner" key={note.id}>
          <BoltMark size={42} />
          <div>
            <b>{note.buyer} sent {note.gift}</b>
            <span>+{note.coins} coins</span>
          </div>
        </div>
      )}
      <p className="broadcast-note">Local preview. Nothing is streaming off this device.</p>
    </section>
  );
}

function unitsLeft(product, state) {
  const inCart = state.cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.qty, 0);
  return Math.max(0, product.stock - (state.pressure[product.id] ?? 0) - inCart);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function seedThread(products) {
  const product = products[0];
  return [
    { id: "a", kind: "join", user: "Ava", text: "joined" },
    { id: "b", kind: "chat", user: "mina", text: "been waiting on this" },
    product ? { id: "c", kind: "buy", user: "Leo", text: `grabbed ${product.name}` } : { id: "c", kind: "chat", user: "Leo", text: "this is moving" },
  ];
}
