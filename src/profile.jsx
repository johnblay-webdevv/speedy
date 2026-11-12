import { useState } from "react";
import { cleanHandle, uploadMedia } from "./account";
import { compact, cx, moneyExact, shortDate, timeAgo, weekLabels } from "./format";
import { CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, Header } from "./ui";

export function Profile() {
  const { state, go, openSheet, signOut, saveProfile } = useStore();
  const [tab, setTab] = useState("likes");
  const [editing, setEditing] = useState(false);
  const profile = state.profile;
  const unread = state.notes.filter((note) => !note.read).length;
  const liked = state.clips.filter((clip) => state.liked[clip.id]);
  const saved = state.clips.filter((clip) => state.savedClips[clip.id]);
  const shelf = state.products.filter((product) => state.following[product.creatorId] || product.creatorId === profile?.id);
  const latest = state.studio.recent[0];
  const followers = state.people.find((person) => person.id === profile?.id)?.followers || profile?.followers || 0;
  const following = Object.values(state.following).filter(Boolean).length;

  if (!profile) return null;

  return (
    <section className="page">
      <header className="subhead">
        <button type="button" className="icon-btn" aria-label="Edit profile" onClick={() => setEditing((value) => !value)}>
          <Icon name="plus" size={20} />
        </button>
        <h1>@{profile.handle}</h1>
        <button type="button" className="icon-btn" aria-label="Activity" onClick={() => go("inbox")}>
          <Icon name="comment" size={22} />
          {unread > 0 && <em>{unread}</em>}
        </button>
      </header>

      <div className="profile-head">
        <Avatar src={profile.avatar} name={profile.name} size={84} />
        <div>
          <h2>{profile.name}</h2>
          <p className="note">{profile.bio || "Add a short bio."}</p>
        </div>
      </div>

      {editing && <ProfileForm profile={profile} onSave={saveProfile} onDone={() => setEditing(false)} />}

      <div className="stats">
        <div>
          <b className="num">{compact(following)}</b>
          <span>Following</span>
        </div>
        <div>
          <b className="num">{compact(followers)}</b>
          <span>Followers</span>
        </div>
        <div>
          <b className="num">{compact(state.orders.length)}</b>
          <span>Orders</span>
        </div>
      </div>

      <button type="button" className="coin-banner" onClick={() => go("wallet")}>
        <CoinMark />
        <span className="grow">
          <b>{compact(state.coins)} coins</b>
          <span className="note">Wallet, gifts, and checkout</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <div className="order-row">
        <button type="button" onClick={() => go("orders")}>
          <Icon name="bag" size={20} />
          <span>{state.orders.length} orders</span>
        </button>
        <button type="button" onClick={() => openSheet({ type: "list" })}>
          <Icon name="plus" size={20} />
          <span>List</span>
        </button>
        <button type="button" onClick={() => openSheet({ type: "post" })}>
          <Icon name="play" size={20} />
          <span>Post</span>
        </button>
        <button type="button" onClick={() => go("studio")}>
          <Icon name="flash" size={20} />
          <span>Sales</span>
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
          {shelf.length === 0 && <p className="note pad">Products you list, and products from people you follow, show up here.</p>}
        </div>
      ) : (
        <div className="mosaic">
          {(tab === "likes" ? liked : saved).map((clip) => (
            <button type="button" key={clip.id} onClick={() => openSheet({ type: "comments", clipId: clip.id })}>
              <img src={clip.image} alt="" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
      {tab !== "shelf" && (tab === "likes" ? liked : saved).length === 0 && (
        <p className="note pad">{tab === "likes" ? "Likes land here." : "Saved clips land here."}</p>
      )}

      <button type="button" className="text-link" onClick={signOut}>
        Log out
      </button>
    </section>
  );
}

function ProfileForm({ profile, onSave, onDone }) {
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [busy, setBusy] = useState(false);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      setAvatar(await uploadMedia(file));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="auth-form pad"
      onSubmit={async (event) => {
        event.preventDefault();
        const nextHandle = cleanHandle(handle);
        setBusy(true);
        const ok = await onSave({
          display_name: name.trim(),
          handle: nextHandle,
          bio: bio.trim(),
          avatar_url: avatar,
        });
        setBusy(false);
        if (ok) onDone();
      }}
    >
      <label>
        Photo
        <input type="file" accept="image/*" onChange={onFile} />
      </label>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
      </label>
      <label>
        Handle
        <input value={handle} onChange={(event) => setHandle(event.target.value)} maxLength={20} required />
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} />
      </label>
      <button type="submit" className="btn block" disabled={busy}>
        {busy ? "Saving" : "Save profile"}
      </button>
    </form>
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
          {state.studio.orders} {state.studio.orders === 1 ? "order" : "orders"} today
          {avg ? ` · ${moneyExact(avg)} average` : ""}
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
        {state.studio.recent.length === 0 && <p className="note pad">No sales yet.</p>}
    </section>
  );
}

export function Orders() {
  const { state, go, product } = useStore();
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
              const listed = product(item.productId);
              return (
                <button
                  type="button"
                  className="list-row"
                  key={`${order.id}-${index}`}
                  onClick={() => listed && go("product", listed.id)}
                >
                  {listed && <img src={listed.image} alt="" referrerPolicy="no-referrer" />}
                  <span className="grow">
                    <b>{listed?.name || item.name}</b>
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
      {state.notes.length === 0 && (
        <div className="empty">
          <p>No activity yet.</p>
        </div>
      )}
      <div className="pad-x">
        {state.notes.map((note) => (
          <button
            type="button"
            key={note.id}
            className={cx("list-row note-row", !note.read && "unread")}
            onClick={() => {
              markRead(note.id);
              if (note.view) go(note.view, note.param);
            }}
          >
            <span className={cx("dot", note.read && "quiet")} />
            <span className="grow">
              <b>{note.title}</b>
              <span className="note">{note.body}</span>
            </span>
            <span className="note">{timeAgo(note.at)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function OrderFlash() {
  const { state, dismissFlash, product } = useStore();
  const order = state.orderFlash;
  if (!order) return null;
  const names = order.items
    .map((item) => product(item.productId)?.name || item.name)
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
      <p className="note">Saved to your account. You earned {order.bonus ?? 0} coins. Card payments aren't connected, so nothing was billed.</p>
      <button type="button" className="btn block" onClick={() => dismissFlash("orders")}>
        View orders
      </button>
      <button type="button" className="btn ghost block" onClick={() => dismissFlash("feed")}>
        Keep scrolling
      </button>
    </section>
  );
}
