import { useEffect, useState } from "react";
import { loadShareTargets } from "./account";
import { GIFTS, LISTING_CATEGORIES } from "./config";
import { coinLabel, compact, cx, money, moneyExact, plural, timeAgo } from "./format";
import { BoltMark, CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { Avatar, FollowButton, MediaPicker, Thumb } from "./ui";

export function Sheets() {
  const { state, closeSheet } = useStore();
  const sheet = state.sheet;

  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, closeSheet]);

  if (!sheet) return null;
  const tall = ["checkout", "quick", "comments", "creator", "cart", "list", "post"].includes(sheet.type);

  return (
    <>
      <button type="button" className="backdrop" aria-label="Close" onClick={closeSheet} />
      <div className={cx("sheet", tall && "tall")} role="dialog" aria-modal="true">
        <div className="grabber" />
        <button type="button" className="sheet-close" aria-label="Close" onClick={closeSheet}>
          <Icon name="close" size={20} />
        </button>
        {sheet.type === "comments" && <CommentsSheet clipId={sheet.clipId} />}
        {sheet.type === "share" && <ShareSheet clipId={sheet.clipId} />}
        {sheet.type === "clip-menu" && <ClipMenuSheet clipId={sheet.clipId} />}
        {sheet.type === "creator" && <CreatorSheet creatorId={sheet.creatorId} />}
        {sheet.type === "quick" && <QuickSheet productId={sheet.productId} />}
        {sheet.type === "cart" && <CartSheet />}
        {sheet.type === "checkout" && <CheckoutSheet />}
        {sheet.type === "gift" && <GiftSheet creatorId={sheet.creatorId} />}
        {(sheet.type === "create" || sheet.type === "bolt") && <CreateSheet />}
        {sheet.type === "list" && <ListSheet />}
        {sheet.type === "post" && <PostSheet />}
      </div>
    </>
  );
}

function CommentsSheet({ clipId }) {
  const { state, addComment } = useStore();
  const clip = state.clips.find((item) => item.id === clipId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const comments = state.comments[clipId];
  if (!clip) return null;

  return (
    <>
      <div className="sheet-head center">
        <h2>{plural(clip.comments, "comment")}</h2>
      </div>
      <div className="sheet-body">
        {!comments && <p className="note center-text">Loading…</p>}
        {comments?.length === 0 && (
          <div className="empty small">
            <Icon name="comment" size={30} />
            <p>No comments yet. Start the conversation.</p>
          </div>
        )}
        {comments?.map((comment) => (
          <div className="comment" key={comment.id}>
            <Avatar src={comment.avatar} name={comment.user} size={34} />
            <span className="grow">
              <b>{comment.user}</b>
              <p>{comment.text}</p>
              {comment.at ? <span className="note">{timeAgo(comment.at)} ago</span> : null}
            </span>
          </div>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !text.trim()) return;
          setBusy(true);
          const ok = await addComment(clipId, text);
          setBusy(false);
          if (ok) setText("");
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          maxLength={180}
          enterKeyHint="send"
        />
        <button type="submit" className={cx("btn slim", !text.trim() && "dim")} disabled={busy}>
          {busy ? "…" : "Post"}
        </button>
      </form>
    </>
  );
}

function ShareSheet({ clipId }) {
  const { state, share, shareTo, person } = useStore();
  const [manual, setManual] = useState("");
  const [targets, setTargets] = useState(null);
  const [sent, setSent] = useState({});
  const [busyId, setBusyId] = useState("");
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    let stop = false;
    loadShareTargets()
      .then((list) => {
        if (!stop) setTargets(list);
      })
      .catch(() => {
        if (!stop) setTargets([]);
      });
    return () => {
      stop = true;
    };
  }, [clipId]);

  const run = async (method) => {
    const result = await share(clipId, method);
    if (result?.manual) setManual(result.manual);
  };

  const sendTo = async (id) => {
    if (sent[id] || busyId) return;
    setBusyId(id);
    try {
      await shareTo(clipId, id);
      setSent((current) => ({ ...current, [id]: true }));
    } catch {
      // shareTo already shows the error toast.
    }
    setBusyId("");
  };

  if (manual) {
    return (
      <>
        <div className="sheet-head center">
          <h2>Copy this link</h2>
        </div>
        <div className="sheet-body auth-form">
          <input value={manual} readOnly aria-label="Post link" onFocus={(event) => event.target.select()} autoFocus />
          <p className="note center-text">Your browser blocked copying. Select the link and copy it.</p>
        </div>
      </>
    );
  }

  const people = (targets || [])
    .map((item) => {
      const profile = person(item.id);
      return profile ? { ...item, profile } : null;
    })
    .filter(Boolean);

  return (
    <>
      <div className="sheet-head center">
        <h2>Share to</h2>
      </div>
      <div className="sheet-body">
        {targets === null && <p className="note center-text">Loading people…</p>}
        {targets && people.length === 0 && (
          <p className="note center-text">People you follow, and accounts you've liked or commented with, show up here.</p>
        )}
        {people.length > 0 && (
          <div className="share-people">
            {people.map((item) => (
              <button type="button" key={item.id} className="share-person" disabled={busyId === item.id} onClick={() => sendTo(item.id)}>
                <span className={cx("share-avatar", sent[item.id] && "sent")}>
                  <Avatar src={item.profile.avatar} name={item.profile.name} size={56} />
                  {sent[item.id] && (
                    <i>
                      <Icon name="check" size={14} />
                    </i>
                  )}
                </span>
                <b>{item.profile.name.split(" ")[0]}</b>
                <span>{sent[item.id] ? "Sent" : item.kind === "follow" ? "Following" : "Recent"}</span>
              </button>
            ))}
          </div>
        )}
        <div className="share-grid">
          {canShare && (
            <button type="button" className="share-tile" onClick={() => run("native")}>
              <span className="share-icon">
                <Icon name="share" size={24} />
              </span>
              Share to…
            </button>
          )}
          <button type="button" className="share-tile" onClick={() => run("copy")}>
            <span className="share-icon alt">
              <Icon name="check" size={24} />
            </span>
            Copy link
          </button>
        </div>
        {!state.earned.share && <p className="note center-text sheet-foot">Share a post to earn 5 coins.</p>}
      </div>
    </>
  );
}

function ClipMenuSheet({ clipId }) {
  const { openSheet, removeClip } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="sheet-head center">
        <h2>{confirm ? "Delete this post?" : "Your post"}</h2>
      </div>
      <div className="sheet-body">
        {confirm ? (
          <>
            <p className="note center-text">This can't be undone.</p>
            <div className="row gap">
              <button type="button" className="btn ghost grow-btn" onClick={() => setConfirm(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn danger grow-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await removeClip(clipId);
                  if (!ok) setBusy(false);
                }}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="list-row" onClick={() => openSheet({ type: "share", clipId })}>
              <Icon name="share" size={20} />
              <span className="grow">
                <b>Share</b>
              </span>
            </button>
            <button type="button" className="list-row danger-text" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={20} />
              <span className="grow">
                <b>Delete post</b>
              </span>
            </button>
          </>
        )}
      </div>
    </>
  );
}

function CreatorSheet({ creatorId }) {
  const { state, go, person, isLive, liveFor } = useStore();
  const creator = person(creatorId);
  if (!creator) return null;
  const clips = state.clips.filter((clip) => clip.creatorId === creatorId);
  const products = state.products.filter((product) => product.creatorId === creatorId);
  const live = liveFor(creatorId);
  const mine = state.profile?.id === creator.id;
  const likes = clips.reduce((sum, clip) => sum + clip.likes, 0);

  return (
    <>
      <div className="sheet-body creator-sheet">
        <div className="creator-top">
          <Avatar src={creator.avatar} name={creator.name} size={76} ring={isLive(creator.id)} />
          <h2>{creator.name}</h2>
          <span className="note">@{creator.handle}</span>
          <div className="stats">
            <span>
              <b className="num">{compact(clips.length)}</b>
              <span className="note">Posts</span>
            </span>
            <span>
              <b className="num">{compact(creator.followers)}</b>
              <span className="note">Followers</span>
            </span>
            <span>
              <b className="num">{compact(likes)}</b>
              <span className="note">Likes</span>
            </span>
          </div>
          {creator.bio && <p className="bio">{creator.bio}</p>}
          <div className="row gap">
            {mine ? (
              <button type="button" className="btn ghost" onClick={() => go("profile")}>
                View your profile
              </button>
            ) : (
              <FollowButton id={creator.id} />
            )}
            {live && (
              <button type="button" className="btn live-btn" onClick={() => go("room", live.id)}>
                Watch LIVE · {compact(live.viewers)}
              </button>
            )}
          </div>
        </div>
        {clips.length > 0 && (
          <>
            <h3>Posts</h3>
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
          </>
        )}
        {products.length > 0 && <h3>Shop</h3>}
        {products.map((product) => (
          <button type="button" key={product.id} className="list-row" onClick={() => go("product", product.id)}>
            <img src={product.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <b>{product.name}</b>
              <span className="note">{product.stock > 0 ? `${compact(product.sold)} sold` : "Sold out"}</span>
            </span>
            <b>{money(product.price)}</b>
          </button>
        ))}
        {clips.length === 0 && products.length === 0 && <p className="note center-text">No posts yet.</p>}
      </div>
    </>
  );
}

function QuickSheet({ productId }) {
  const { state, go, addToCart, openSheet, pushToast, product: findProduct } = useStore();
  const product = findProduct(productId);
  const [size, setSize] = useState(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!product) {
    return (
      <div className="sheet-body empty small">
        <p>This product isn't available anymore.</p>
      </div>
    );
  }
  const soldOut = product.stock <= 0;
  const mine = product.creatorId === state.profile?.id;

  const commit = async (buyNow) => {
    if (product.sizes?.length && !size) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      pushToast("Pick a size");
      return;
    }
    setBusy(true);
    const ok = await addToCart(product.id, size, 1, { quiet: buyNow });
    setBusy(false);
    if (ok && buyNow) openSheet({ type: "checkout", liveId: state.sheet?.liveId || null });
  };

  return (
    <div className="sheet-body">
      <div className="quick">
        <img src={product.image} alt="" referrerPolicy="no-referrer" />
        <div>
          <span className="brand">{product.brand}</span>
          <h2>{product.name}</h2>
          <p className="price-row">
            <b>{money(product.price)}</b>
            {product.was && <s className="was">{money(product.was)}</s>}
          </p>
          <p className="note">{soldOut ? "Sold out" : product.stock <= 5 ? `Only ${product.stock} left` : `${product.stock} in stock`}</p>
        </div>
      </div>
      {product.description && <p className="note">{product.description}</p>}
      {product.sizes?.length > 0 && !soldOut && (
        <div className={cx("size-block", shake && "shake")}>
          <span className="note">Size</span>
          <div className="chips">
            {product.sizes.map((item) => (
              <button type="button" key={item} className={cx("chip", size === item && "on")} onClick={() => setSize(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      {mine ? (
        <button type="button" className="btn ghost block" onClick={() => go("product", product.id)}>
          This is your listing · View
        </button>
      ) : soldOut ? (
        <button type="button" className="btn block" disabled>
          Sold out
        </button>
      ) : (
        <div className="row gap">
          <button type="button" className="btn ghost grow-btn" onClick={() => commit(false)} disabled={busy}>
            Add to bag
          </button>
          <button type="button" className="btn grow-btn" onClick={() => commit(true)} disabled={busy}>
            Buy now
          </button>
        </div>
      )}
      <button type="button" className="text-link" onClick={() => go("product", product.id)}>
        See full details
      </button>
    </div>
  );
}

function CartSheet() {
  const { state, changeQty, openSheet, go, product: findProduct } = useStore();
  const lines = state.cart.filter((line) => findProduct(line.productId));
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = lines.reduce((sum, line) => sum + findProduct(line.productId).price * line.qty, 0);

  if (!lines.length) {
    return (
      <div className="sheet-body empty">
        <Icon name="bag" size={32} />
        <p>Your bag is empty.</p>
        <button type="button" className="btn" onClick={() => go("shop")}>
          Browse shop
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="sheet-head">
        <h2>Bag · {plural(count, "item")}</h2>
      </div>
      <div className="sheet-body">
        {lines.map((line) => {
          const product = findProduct(line.productId);
          return (
            <div className="list-row static" key={line.id}>
              <img src={product.image} alt="" referrerPolicy="no-referrer" />
              <span className="grow">
                <b>{product.name}</b>
                <span className="note">{line.size ? `Size ${line.size}` : product.brand}</span>
                <span className="stepper">
                  <button type="button" aria-label={line.qty === 1 ? "Remove" : "Decrease"} onClick={() => changeQty(line.id, -1)}>
                    {line.qty === 1 ? <Icon name="trash" size={14} /> : "−"}
                  </button>
                  <span className="num">{line.qty}</span>
                  <button type="button" aria-label="Increase" onClick={() => changeQty(line.id, 1)} disabled={line.qty >= product.stock}>
                    +
                  </button>
                </span>
              </span>
              <b>{money(product.price * line.qty)}</b>
            </div>
          );
        })}
        <div className="total-row">
          <span>Subtotal</span>
          <b>{moneyExact(subtotal)}</b>
        </div>
        <button type="button" className="btn block" onClick={() => openSheet({ type: "checkout", liveId: state.sheet?.liveId || null })}>
          Checkout
        </button>
      </div>
    </>
  );
}

function CheckoutSheet() {
  const { state, setAddress, addAddress, checkout, openSheet, product: findProduct } = useStore();
  const [useCoins, setUseCoins] = useState(true);
  const [adding, setAdding] = useState(state.addresses.length === 0);
  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const lines = state.cart.filter((item) => findProduct(item.productId));
  const address = state.addresses.find((item) => item.id === state.addressId) ?? null;
  const subtotal = lines.reduce((sum, item) => sum + findProduct(item.productId).price * item.qty, 0);
  const maxCoins = Math.min(state.coins, Math.floor(subtotal * 30));
  const applied = useCoins ? maxCoins : 0;
  const total = Math.max(0, Math.round((subtotal - applied / 100) * 100) / 100);
  const bonus = subtotal >= 20 ? 15 : 5;

  if (!lines.length) {
    return (
      <div className="sheet-body empty small">
        <p>Your bag is empty.</p>
      </div>
    );
  }

  const saveAddress = async (event) => {
    event.preventDefault();
    setSaving(true);
    const saved = await addAddress(label, line);
    setSaving(false);
    if (saved) {
      setLabel("Home");
      setLine("");
      setAdding(false);
    }
  };

  const place = async () => {
    setBusy(true);
    const ok = await checkout({
      total,
      spentCoins: applied,
      bonus,
      liveId: state.sheet?.liveId || null,
      lines: lines.map((item) => ({
        productId: item.productId,
        size: item.size,
        qty: item.qty,
        price: findProduct(item.productId).price,
      })),
    });
    if (!ok) setBusy(false);
  };

  return (
    <>
      <div className="sheet-head">
        <button type="button" className="icon-btn" aria-label="Back to bag" onClick={() => openSheet({ type: "cart", liveId: state.sheet?.liveId || null })}>
          <Icon name="back" size={22} />
        </button>
        <h2>Checkout</h2>
      </div>
      <div className="sheet-body">
        {lines.map((item) => {
          const product = findProduct(item.productId);
          return (
            <div className="list-row static" key={item.id}>
              <img src={product.image} alt="" referrerPolicy="no-referrer" />
              <span className="grow">
                <b>{product.name}</b>
                <span className="note">
                  {item.size ? `Size ${item.size} · ` : ""}Qty {item.qty}
                </span>
              </span>
              <b>{money(product.price * item.qty)}</b>
            </div>
          );
        })}

        <h3>Deliver to</h3>
        {state.addresses.length > 0 && (
          <div className="address-list">
            {state.addresses.map((item) => (
              <button
                type="button"
                key={item.id}
                className={cx("address", address?.id === item.id && "on")}
                onClick={() => setAddress(item.id)}
                aria-pressed={address?.id === item.id}
              >
                <span className="radio" />
                <span className="grow">
                  <b>{item.label}</b>
                  <span className="note">{item.line}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {adding ? (
          <form className="auth-form address-form" onSubmit={saveAddress}>
            <input value={line} onChange={(event) => setLine(event.target.value)} maxLength={160} placeholder="Street, city, postcode" aria-label="Street address" required autoFocus />
            <div className="chips">
              {["Home", "Work", "Other"].map((item) => (
                <button type="button" key={item} className={cx("chip", label === item && "on")} onClick={() => setLabel(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="row gap">
              {state.addresses.length > 0 && (
                <button type="button" className="btn ghost grow-btn" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn grow-btn" disabled={saving || !line.trim()}>
                {saving ? "Saving…" : "Save address"}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="text-link" onClick={() => setAdding(true)}>
            + Add a new address
          </button>
        )}

        {maxCoins > 0 && (
          <button type="button" className="coin-toggle" onClick={() => setUseCoins((value) => !value)} aria-pressed={useCoins}>
            <span>
              Use {coinLabel(maxCoins)} coins
              <span className="note">Save {moneyExact(maxCoins / 100)}</span>
            </span>
            <span className={cx("switch", useCoins && "on")}>
              <i />
            </span>
          </button>
        )}
        <div className="total-row">
          <span>Subtotal</span>
          <b>{moneyExact(subtotal)}</b>
        </div>
        {applied > 0 && (
          <div className="total-row">
            <span>Coins</span>
            <b className="up">−{moneyExact(applied / 100)}</b>
          </div>
        )}
        <div className="total-row strong">
          <span>Total</span>
          <b>{moneyExact(total)}</b>
        </div>
        <p className="note">You'll earn {bonus} coins. Card payments aren't connected yet, so no card is charged.</p>
        <button type="button" className="btn block" disabled={!address || busy} onClick={place}>
          {busy ? "Placing order…" : address ? `Place order · ${moneyExact(total)}` : "Add an address to continue"}
        </button>
      </div>
    </>
  );
}

function GiftSheet({ creatorId }) {
  const { state, sendGift, person, go } = useStore();
  const creator = person(creatorId);
  return (
    <>
      <div className="sheet-head">
        <h2>Gift {creator?.name}</h2>
        <button type="button" className="coin-pill static" onClick={() => go("wallet")}>
          <CoinMark size={14} /> {coinLabel(state.coins)}
        </button>
      </div>
      <div className="sheet-body gift-grid">
        {GIFTS.map((gift) => (
          <button type="button" key={gift.id} className="gift-card" onClick={() => sendGift(gift.id, creatorId)} disabled={state.coins < gift.coins}>
            <BoltMark size={gift.coins >= 500 ? 46 : 32} />
            <b>{gift.name}</b>
            <span>{coinLabel(gift.coins)}</span>
          </button>
        ))}
      </div>
      {GIFTS.some((gift) => state.coins < gift.coins) && (
        <button type="button" className="text-link sheet-foot" onClick={() => go("wallet")}>
          Get more coins
        </button>
      )}
    </>
  );
}

function CreateSheet() {
  const { state, go, openSheet } = useStore();
  return (
    <>
      <div className="sheet-head center">
        <h2>Create</h2>
      </div>
      <div className="sheet-body">
        <div className="create-grid">
          <button type="button" className="create-tile" onClick={() => openSheet({ type: "post" })}>
            <span className="create-icon">
              <Icon name="play" size={24} />
            </span>
            <b>Post</b>
            <span className="note">Photo or video</span>
          </button>
          <button type="button" className="create-tile" onClick={() => openSheet({ type: "list" })}>
            <span className="create-icon alt">
              <Icon name="bag" size={24} />
            </span>
            <b>Sell</b>
            <span className="note">List a product</span>
          </button>
          <button type="button" className="create-tile" onClick={() => go("broadcast")}>
            <span className="create-icon live">
              <Icon name="live" size={24} />
            </span>
            <b>Go LIVE</b>
            <span className="note">Open your camera</span>
          </button>
        </div>
        <button type="button" className="list-row" onClick={() => go("studio")}>
          <Icon name="flash" size={20} filled />
          <span className="grow">
            <b>Sales</b>
            <span className="note">{moneyExact(state.studio.today)} today</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => go("wallet")}>
          <CoinMark size={20} />
          <span className="grow">
            <b>Wallet</b>
            <span className="note">{coinLabel(state.coins)} coins</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      </div>
    </>
  );
}

function ListSheet() {
  const { go, publishProduct, pushToast } = useStore();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState(LISTING_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [more, setMore] = useState(false);
  const [compareAt, setCompareAt] = useState("");
  const [sizes, setSizes] = useState("");
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(price.replace(/[$,\s]/g, ""));
    const was = compareAt.trim() ? Number(compareAt.replace(/[$,\s]/g, "")) : null;
    const qty = Number(stock);
    const parsedSizes = sizes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!image) return pushToast("Add a photo first");
    if (!name.trim()) return pushToast("Give your product a name");
    if (!Number.isFinite(amount) || amount <= 0) return pushToast("Enter a price, like 25");
    if (!Number.isInteger(qty) || qty < 1) return pushToast("Stock has to be at least 1");
    if (was != null && !(was > amount)) return pushToast("Original price has to be higher than the price");
    setBusy(true);
    try {
      const id = await publishProduct({
        name: name.trim(),
        description: description.trim(),
        price: Math.round(amount * 100) / 100,
        compareAt: was,
        stock: qty,
        category,
        flash,
        sizes: parsedSizes.length ? parsedSizes : null,
        imageUrl: image,
      });
      go("product", id);
    } catch (error) {
      pushToast(error.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-head">
        <h2>Sell a product</h2>
      </div>
      <form className="sheet-body auth-form" onSubmit={submit}>
        <MediaPicker label="Add photo" hint="Clear, bright photos sell faster" value={image} onChange={setImage} />
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="What are you selling?" required />
        </label>
        <div className="row gap">
          <label className="grow">
            Price ($)
            <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="25" required />
          </label>
          <label className="grow">
            Stock
            <input value={stock} onChange={(event) => setStock(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Category</span>
          <div className="chips">
            {LISTING_CATEGORIES.map((item) => (
              <button type="button" key={item} className={cx("chip", category === item && "on")} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <label>
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Condition, material, fit…" />
        </label>
        <button type="button" className="text-link" onClick={() => setMore((value) => !value)} aria-expanded={more}>
          {more ? "Hide extra options" : "More options (sale price, sizes)"}
        </button>
        {more && (
          <>
            <label>
              Original price ($) — shows as a discount
              <input value={compareAt} onChange={(event) => setCompareAt(event.target.value)} inputMode="decimal" placeholder="Optional" />
            </label>
            <label>
              Sizes — separate with commas
              <input value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="S, M, L" />
            </label>
            <button type="button" className="coin-toggle" onClick={() => setFlash((value) => !value)} aria-pressed={flash}>
              <span>
                Flash deal
                <span className="note">Shows in the Flash section of the shop</span>
              </span>
              <span className={cx("switch", flash && "on")}>
                <i />
              </span>
            </button>
          </>
        )}
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Listing…" : "List product"}
        </button>
      </form>
    </>
  );
}

function PostSheet() {
  const { state, go, publishClip, pushToast, openSheet } = useStore();
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = state.products.filter((product) => product.creatorId === state.profile?.id);

  const submit = async (event) => {
    event.preventDefault();
    if (!image) return pushToast("Add a photo or video first");
    if (!caption.trim()) return pushToast("Write a caption");
    setBusy(true);
    try {
      const id = await publishClip({ caption: caption.trim(), imageUrl: image, productId: productId || null });
      go("feed", id);
    } catch (error) {
      pushToast(error.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-head">
        <h2>New post</h2>
      </div>
      <form className="sheet-body auth-form" onSubmit={submit}>
        <MediaPicker label="Add photo or video" hint="Videos up to 50 MB" value={image} onChange={setImage} video />
        <label>
          Caption
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} placeholder="Describe your post… #hashtags" />
        </label>
        <div className="field">
          <span className="field-label">Tag a product</span>
          {mine.length > 0 ? (
            <div className="chips">
              <button type="button" className={cx("chip", !productId && "on")} onClick={() => setProductId("")}>
                None
              </button>
              {mine.map((product) => (
                <button type="button" key={product.id} className={cx("chip", productId === product.id && "on")} onClick={() => setProductId(product.id)}>
                  {product.name}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="text-link" onClick={() => openSheet({ type: "list" })}>
              List a product to tag it in posts
            </button>
          )}
        </div>
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Posting…" : "Post"}
        </button>
      </form>
    </>
  );
}
