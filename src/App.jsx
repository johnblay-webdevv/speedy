import { useState } from "react";
import { INBOX, logoUrl } from "./data";
import { Feed } from "./feed";
import { Broadcast, LiveLobby, LiveRoom } from "./live";
import { BoltMark } from "./icons";
import { Icon } from "./icons";
import { Inbox, OrderFlash, Orders, Profile, Studio } from "./profile";
import { ProductPage, SearchPage, Shop } from "./shop";
import { Sheets } from "./sheets";
import { useStore, StoreProvider } from "./store";
import { cx } from "./format";
import { Wallet } from "./wallet";

const SUB = new Set(["room", "broadcast", "product", "wallet", "studio", "orders", "inbox", "search"]);

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { state, go, openSheet, skipBoot } = useStore();
  const sub = SUB.has(state.view);
  const bag = state.cart.reduce((sum, line) => sum + line.qty, 0);
  const unread = INBOX.filter((note) => !state.readNotes[note.id]).length;
  const current =
    state.view === "live" ? "live" : state.view === "shop" ? "shop" : state.view === "profile" ? "profile" : "feed";

  return (
    <div className="stage">
      <div className={cx("device", (state.sheet || state.orderFlash) && "locked")}>
        <div className="app">
          <Feed />
          {state.view === "live" && <LiveLobby />}
          {state.view === "room" && <LiveRoom />}
          {state.view === "broadcast" && <Broadcast />}
          {state.view === "shop" && <Shop />}
          {state.view === "product" && <ProductPage />}
          {state.view === "wallet" && <Wallet />}
          {state.view === "profile" && <Profile />}
          {state.view === "studio" && <Studio />}
          {state.view === "orders" && <Orders />}
          {state.view === "inbox" && <Inbox />}
          {state.view === "search" && <SearchPage />}
          {!sub && state.view !== "feed" && <Nav current={current} bag={bag} unread={unread} solid onGo={go} onBolt={() => openSheet({ type: "bolt" })} />}
          {!sub && state.view === "feed" && <Nav current="feed" bag={bag} unread={unread} onGo={go} onBolt={() => openSheet({ type: "bolt" })} />}
          <Sheets />
          <Toasts />
          <OrderFlash />
          {state.booting && <Splash onSkip={skipBoot} />}
        </div>
      </div>
      <p className="stage-hint">Scroll the feed · double-tap to like · open a live to shop</p>
    </div>
  );
}

function Nav({ current, bag, unread, solid, onGo, onBolt }) {
  return (
    <nav className={solid ? "nav solid" : "nav"}>
      <button type="button" className={current === "feed" ? "on" : ""} onClick={() => onGo("feed")}>
        <Icon name="home" size={24} />
        Home
      </button>
      <button type="button" className={current === "live" ? "on" : ""} onClick={() => onGo("live")}>
        <span className="nav-ico">
          <Icon name="live" size={24} />
          <i className="dot" />
        </span>
        Live
      </button>
      <button type="button" className="nav-bolt" aria-label="Speedy menu" onClick={onBolt}>
        <img src={logoUrl} alt="" />
      </button>
      <button type="button" className={current === "shop" ? "on" : ""} onClick={() => onGo("shop")}>
        <span className="nav-ico">
          <Icon name="bag" size={24} />
          {bag > 0 && <em>{bag > 9 ? "9+" : bag}</em>}
        </span>
        Shop
      </button>
      <button type="button" className={current === "profile" ? "on" : ""} onClick={() => onGo("profile")}>
        <span className="nav-ico">
          <Icon name="user" size={24} />
          {unread > 0 && <i className="dot" />}
        </span>
        Me
      </button>
    </nav>
  );
}

function Toasts() {
  const { state } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {state.toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function Splash({ onSkip }) {
  const [ok, setOk] = useState(true);
  return (
    <button type="button" className="splash" onClick={onSkip}>
      {ok ? <img src={logoUrl} alt="" onError={() => setOk(false)} /> : <BoltMark size={88} />}
      <span className="wordmark">Speedy</span>
      <span className="note">Live shop. Endless scroll.</span>
    </button>
  );
}
