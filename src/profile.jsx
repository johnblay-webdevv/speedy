import { useState } from "react";
import { CLIPS, INBOX, ME, PRODUCTS, productMap } from "./data";
import { coinLabel, compact, cx, moneyExact, shortDate, timeAgo, weekLabels } from "./format";
import { CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, Header } from "./ui";

export function Profile() {
  const { state, go, openSheet, markRead } = useStore();
  const [tab, setTab] = useState("likes");
  const [armed, setArmed] = useState(false);
  const { resetDemo } = useStore();
  const following = Object.values(state.following).filter(Boolean).length;
  const unread = INBOX.filter((note) => !state.readNotes[note.id]).length;
  const liked = CLIPS.filter((clip) => state.liked[clip.id]);
  const saved = CLIPS.filter((clip) => state.savedClips[clip.id]);
  const shelf = PRODUCTS.filter((product) => state.following[product.creatorId]);
  const latest = state.studio.recent[0];

  return (
    <section className="page">
      <header className="subhead">
        <span className="icon-btn" aria-hidden="true" />
        <h1>@{ME.handle}</h1>
        <button type="button" className="icon-btn" aria-label="Activity" onClick={() => go("inbox")}>
          <Icon name="comment" size={22} />
          {unread > 0 && <em>{unread}</em>}
        </button>
      </header>

      <div className="profile-head">
        <Avatar src={ME.avatar} name={ME.name} size={84} />
        <div>
          <h2>{ME.name}</h2>
          <p className="note">{ME.bio}</p>
        </div>
      </div>

      <div className="stats">
        <div>
          <b className="num">{compact(following)}</b>
          <span>Following</span>
        </div>
        <div>
          <b className="num">{compact(ME.followers)}</b>
          <span>Followers</span>
        </div>
        <div>
          <b className="num">{compact(ME.likes)}</b>
          <span>Likes</span>
        </div>
      </div>

      <button type="button" className="coin-banner" onClick={() => go("wallet")}>
        <CoinMark />
        <span className="grow">
          <b>{coinLabel(state.coins)} coins</b>
          <span className="note">Wallet, gifts, and checkout</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <div className="order-row">
        <OrderStat icon="card" label="Placed" count={state.orders.filter((order) => order.status === "Placed").length} />
        <OrderStat icon="truck" label="Shipped" count={state.orders.filter((order) => order.status === "Shipped").length} />
        <OrderStat icon="box" label="Arrived" count={state.orders.filter((order) => order.status === "Delivered").length} />
        <button type="button" onClick={() => go("orders")}>
          <Icon name="bag" size={20} />
          <span>All</span>
        </button>
      </div>

      <button type="button" className="studio-card" onClick={() => go("studio")}>
        <span className="note">Sales today</span>
        <strong className="num">{moneyExact(state.studio.today)}</strong>
        <span>
          {state.studio.orders} orders
          {latest ? ` · ${latest.buyer} bought ${latest.item}` : ""}
        </span>
      </button>

      <div className="tabs profile-tabs">
        {["likes", "saved", "shelf"].map((item) => (
          <button type="button" key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>
            {item === "likes" ? "Likes" : item === "saved" ? "Saved" : "Shelf"}
          </button>
        ))}
      </div>

      {tab === "shelf" ? (
        <div className="grid-2 mosaic-pad">
          {shelf.map((product) => (
            <button type="button" key={product.id} className="pcard" onClick={() => go("product", product.id)}>
              <span className="pcard-media">
                <img src={product.image} alt="" referrerPolicy="no-referrer" />
              </span>
              <span className="clamp name">{product.name}</span>
              <b>{moneyExact(product.price)}</b>
            </button>
          ))}
          {shelf.length === 0 && <p className="note pad">Follow a host and their shelf shows up here.</p>}
        </div>
      ) : (
        <div className="mosaic">
          {(tab === "likes" ? liked : saved).map((clip) => (
            <button type="button" key={clip.id} onClick={() => openSheet({ type: "quick", productId: clip.productId })}>
              <img src={clip.image} alt="" referrerPolicy="no-referrer" style={{ objectPosition: clip.focus }} />
              <span>
                <Icon name="play" size={12} /> {compact(clip.likes)}
              </span>
            </button>
          ))}
        </div>
      )}
      {tab !== "shelf" && (tab === "likes" ? liked : saved).length === 0 && (
        <p className="note pad">{tab === "likes" ? "Double-tap a clip and it lands here." : "Save a clip from the rail and it lands here."}</p>
      )}

      <button
        type="button"
        className="text-link"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          resetDemo();
        }}
      >
        {armed ? "Tap again to reset demo data" : "Reset demo data"}
      </button>
    </section>
  );
}

function OrderStat({ icon, label, count }) {
  const { go } = useStore();
  return (
    <button type="button" onClick={() => go("orders")}>
      <Icon name={icon} size={20} />
      <span>
        {label}
        {count > 0 ? ` ${count}` : ""}
      </span>
    </button>
  );
}

export function Studio() {
  const { state } = useStore();
  const labels = weekLabels();
  const max = Math.max(...state.studio.week, 1);
  const avg = state.studio.orders ? state.studio.today / state.studio.orders : 0;
  const counts = {};
  state.studio.recent.forEach((sale) => {
    counts[sale.item] = (counts[sale.item] ?? 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <section className="page sub">
      <Header title="Sales" fallback="profile" />
      <section className="balance-card">
        <span className="note">Today</span>
        <strong className="num">{moneyExact(state.studio.today)}</strong>
        <p>
          {state.studio.orders} orders · {state.studio.conversion}% of live viewers checked out · {moneyExact(avg)} average
        </p>
      </section>
      <div className="section">
        <h2>This week</h2>
      </div>
      <div className="chart" aria-hidden="true">
        {state.studio.week.map((value, index) => (
          <span key={labels[index]}>
            <i style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
            <em>{labels[index]}</em>
          </span>
        ))}
      </div>
      {top && (
        <p className="note pad">
          Moving fastest: {top[0]} · {top[1]} in the latest sales
        </p>
      )}
      <div className="section">
        <h2>Recent</h2>
      </div>
      <div className="pad-x">
        {state.studio.recent.map((sale) => (
          <div className="list-row static" key={sale.id}>
            <span className="grow">
              <b>
                {sale.buyer} bought {sale.item}
              </b>
              <span className="note">{timeAgo(sale.at)}</span>
            </span>
            <b>{moneyExact(sale.amount)}</b>
          </div>
        ))}
      </div>
      <p className="note pad">Payouts in this demo settle every Friday. Nothing is transferred.</p>
    </section>
  );
}

export function Orders() {
  const { state, go } = useStore();
  return (
    <section className="page sub">
      <Header title="Orders" fallback="profile" />
      {state.orders.length === 0 && (
        <div className="empty">
          <p>No orders yet.</p>
          <button type="button" className="btn" onClick={() => go("shop")}>
            Browse the shop
          </button>
        </div>
      )}
      <div className="pad-x">
        {state.orders.map((order) => (
          <article className="order-card" key={order.id}>
            <header>
              <span className={cx("status", order.status)}>{order.status}</span>
              <span className="note">{shortDate(order.at)}</span>
            </header>
            {order.items.map((item, index) => {
              const product = productMap[item.productId];
              if (!product) return null;
              return (
                <button type="button" className="list-row" key={`${order.id}-${index}`} onClick={() => go("product", product.id)}>
                  <img src={product.image} alt="" referrerPolicy="no-referrer" />
                  <span className="grow">
                    <b>{product.name}</b>
                    <span className="note">
                      {item.size ? `Size ${item.size} · ` : ""}Qty {item.qty}
                    </span>
                  </span>
                  <b>{moneyExact(item.price * item.qty)}</b>
                </button>
              );
            })}
            <footer>
              <span>Total</span>
              <b>{moneyExact(order.total)}</b>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Inbox() {
  const { state, go, markRead } = useStore();
  return (
    <section className="page sub">
      <Header title="Activity" fallback="profile" />
      <div className="pad-x">
        {INBOX.map((note) => {
          const unread = !state.readNotes[note.id];
          return (
            <button
              type="button"
              key={note.id}
              className={cx("list-row note-row", unread && "unread")}
              onClick={() => {
                markRead(note.id);
                if (note.view) go(note.view, note.param);
              }}
            >
              <span className={cx("dot", !unread && "quiet")} />
              <span className="grow">
                <b>{note.title}</b>
                <span className="note">{note.body}</span>
              </span>
              <span className="note">{timeAgo(note.at)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function OrderFlash() {
  const { state, dismissFlash } = useStore();
  const order = state.orderFlash;
  if (!order) return null;
  const names = order.items
    .map((item) => productMap[item.productId]?.name)
    .filter(Boolean)
    .join(", ");
  return (
    <section className="flash">
      <span className="check-orb">
        <Icon name="check" size={36} />
      </span>
      <h2>Order placed</h2>
      <p>{names}</p>
      <p className="price-row big">
        <b>{moneyExact(order.total)}</b>
      </p>
      <p className="note">You earned {order.bonus ?? 15} coins. This checkout is a demo, so nothing was charged.</p>
      <button type="button" className="btn block" onClick={() => dismissFlash("orders")}>
        View orders
      </button>
      <button type="button" className="btn ghost block" onClick={() => dismissFlash("feed")}>
        Keep scrolling
      </button>
    </section>
  );
}
