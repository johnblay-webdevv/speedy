import { useState } from "react";
import { cleanHandle } from "./account";
import { coinLabel, compact, cx, money, moneyExact, shortDate, timeAgo, weekLabels } from "./format";
import { CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, Header, MediaPicker, Thumb } from "./ui";

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "shop", label: "Shop" },
  { id: "liked", label: "Liked" },
  { id: "saved", label: "Saved" },
];

export function Profile() {
  const { state, go, openSheet, signOut, saveProfile } = useStore();
  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const profile = state.profile;
  if (!profile) return null;

  const unread = state.notes.filter((note) => !note.read).length;
  const posts = state.clips.filter((clip) => clip.creatorId === profile.id);
  const listings = state.products.filter((product) => product.creatorId === profile.id);
  const liked = state.clips.filter((clip) => state.liked[clip.id]);
  const saved = state.clips.filter((clip) => state.savedClips[clip.id]);
  const followers = state.people.find((person) => person.id === profile.id)?.followers || profile.followers || 0;
  const following = Object.values(state.following).filter(Boolean).length;
  const likes = posts.reduce((sum, clip) => sum + clip.likes, 0);
  const clips = tab === "posts" ? posts : tab === "liked" ? liked : saved;

  if (editing) {
    return (
      <section className="page">
        <header className="subhead">
          <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => setEditing(false)}>
            <Icon name="close" size={24} />
          </button>
          <h1>Edit profile</h1>
          <span className="icon-btn" aria-hidden="true" />
        </header>
        <ProfileForm profile={profile} onSave={saveProfile} onDone={() => setEditing(false)} />
      </section>
    );
  }

  return (
    <section className="page">
      <header className="subhead">
        <button type="button" className="icon-btn" aria-label="Wallet" onClick={() => go("wallet")}>
          <CoinMark size={22} />
        </button>
        <h1>{profile.name}</h1>
        <button type="button" className="icon-btn" aria-label={`Activity${unread ? `, ${unread} new` : ""}`} onClick={() => go("inbox")}>
          <Icon name="comment" size={22} />
          {unread > 0 && <em>{unread > 9 ? "9+" : unread}</em>}
        </button>
      </header>

      <div className="me-head">
        <Avatar src={profile.avatar} name={profile.name} size={92} />
        <span className="me-handle">@{profile.handle}</span>
        <div className="stats">
          <span>
            <b className="num">{compact(following)}</b>
            <span className="note">Following</span>
          </span>
          <span>
            <b className="num">{compact(followers)}</b>
            <span className="note">Followers</span>
          </span>
          <span>
            <b className="num">{compact(likes)}</b>
            <span className="note">Likes</span>
          </span>
        </div>
        <div className="row gap">
          <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
            Edit profile
          </button>
          <button type="button" className="btn ghost" onClick={() => go("wallet")}>
            <CoinMark size={16} /> {coinLabel(state.coins)}
          </button>
        </div>
        {profile.bio ? (
          <p className="bio">{profile.bio}</p>
        ) : (
          <button type="button" className="text-link" onClick={() => setEditing(true)}>
            + Add a bio
          </button>
        )}
      </div>

      <div className="me-shortcuts">
        <button type="button" onClick={() => go("orders")}>
          <Icon name="box" size={20} />
          <span>Orders</span>
        </button>
        <button type="button" onClick={() => go("studio")}>
          <Icon name="flash" size={20} />
          <span>Sales</span>
        </button>
        <button type="button" onClick={() => go("inbox")}>
          <Icon name="comment" size={20} />
          <span>Activity</span>
        </button>
        <button type="button" onClick={() => openSheet({ type: "create" })}>
          <Icon name="plus" size={20} />
          <span>Create</span>
        </button>
      </div>

      <div className="me-tabs" role="tablist">
        {TABS.map((item) => (
          <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "shop" ? (
        <>
          <div className="grid-2 mosaic-pad">
            {listings.map((product) => (
              <button type="button" key={product.id} className={cx("pcard", product.stock <= 0 && "sold-out")} onClick={() => go("product", product.id)}>
                <span className="pcard-media">
                  <img src={product.image} alt="" referrerPolicy="no-referrer" />
                  {product.stock <= 0 && <em className="out">Sold out</em>}
                </span>
                <span className="clamp name">{product.name}</span>
                <span className="price-row">
                  <b>{money(product.price)}</b>
                  <span className="note"> · {product.stock} left</span>
                </span>
              </button>
            ))}
          </div>
          {listings.length === 0 && (
            <div className="empty small">
              <p>Sell something and it shows up here.</p>
              <button type="button" className="btn" onClick={() => openSheet({ type: "list" })}>
                Sell a product
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid3">
            {clips.map((clip) => (
              <button type="button" key={clip.id} className="tile" onClick={() => go("feed", clip.id)} aria-label="Open post">
                <Thumb src={clip.image} />
                <span className="tile-count">
                  <Icon name="heart" size={12} filled /> {compact(clip.likes)}
                </span>
              </button>
            ))}
          </div>
          {clips.length === 0 && (
            <div className="empty small">
              <p>{tab === "posts" ? "Share your first post." : tab === "liked" ? "Posts you like show up here." : "Posts you save show up here."}</p>
              {tab === "posts" && (
                <button type="button" className="btn" onClick={() => openSheet({ type: "post" })}>
                  Post
                </button>
              )}
            </div>
          )}
        </>
      )}

      <button type="button" className="text-link danger-text" onClick={signOut}>
        Log out
      </button>
    </section>
  );
}

function ProfileForm({ profile, onSave, onDone }) {
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio || "");
  const [avatar, setAvatar] = useState(profile.avatar || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nextHandle = cleanHandle(handle);

  return (
    <form
      className="auth-form pad"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return setError("Enter your name");
        if (!/^[a-z0-9_]{3,20}$/.test(nextHandle)) return setError("Username needs 3–20 letters, numbers or underscores");
        setError("");
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
      <div className="avatar-pick">
        <MediaPicker label="Add photo" value={avatar} onChange={setAvatar} />
      </div>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
      </label>
      <label>
        Username
        <input
          value={handle}
          onChange={(event) => setHandle(event.target.value.toLowerCase())}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
        />
        {handle && nextHandle !== handle.trim().toLowerCase() && <span className="note">Will be saved as @{nextHandle}</span>}
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} placeholder="Tell people what you sell or post" />
      </label>
      {error && <span className="auth-error">{error}</span>}
      <div className="row gap">
        <button type="button" className="btn ghost grow-btn" onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn grow-btn" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function Studio() {
  const { state, openSheet } = useStore();
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
              <span className="note">{timeAgo(sale.at)} ago</span>
            </span>
            <b>{moneyExact(sale.amount)}</b>
          </div>
        ))}
      </div>
      {state.studio.recent.length === 0 && (
        <div className="empty small">
          <p>No sales yet. List a product or go LIVE to start selling.</p>
          <button type="button" className="btn" onClick={() => openSheet({ type: "list" })}>
            Sell a product
          </button>
        </div>
      )}
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
          <Icon name="box" size={36} />
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
                  disabled={!listed}
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
          <Icon name="comment" size={36} />
          <p>No activity yet. New followers, comments, gifts and sales show up here.</p>
        </div>
      )}
      <div className="pad-x">
        {state.notes.map((note) => (
          <button
            type="button"
            key={note.id}
            className={cx("list-row note-row", !note.read && "unread")}
            onClick={() => {
              if (!note.read) markRead(note.id);
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
      <p className="note">You earned {order.bonus ?? 0} coins. No card was charged.</p>
      <button type="button" className="btn block" onClick={() => dismissFlash("orders")}>
        View orders
      </button>
      <button type="button" className="btn ghost block" onClick={() => dismissFlash("feed")}>
        Keep scrolling
      </button>
    </section>
  );
}
