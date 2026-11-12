import { useEffect, useState } from "react";
import { GIFTS, LISTING_CATEGORIES } from "./config";
import { coinLabel, compact, cx, money, moneyExact } from "./format";
import { BoltMark, CoinMark, Icon } from "./icons";
import { PhotoField } from "./live";
import { useStore } from "./store";
import { Avatar, FollowButton } from "./ui";

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
        <div className="handle" />
        {sheet.type === "comments" && <CommentsSheet clipId={sheet.clipId} />}
        {sheet.type === "share" && <ShareSheet clipId={sheet.clipId} />}
        {sheet.type === "creator" && <CreatorSheet creatorId={sheet.creatorId} />}
        {sheet.type === "quick" && <QuickSheet productId={sheet.productId} />}
        {sheet.type === "cart" && <CartSheet />}
        {sheet.type === "checkout" && <CheckoutSheet />}
        {sheet.type === "gift" && <GiftSheet creatorId={sheet.creatorId} />}
        {sheet.type === "bolt" && <BoltSheet />}
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
  const comments = state.comments[clipId] ?? [];
  if (!clip) return null;

  return (
    <>
      <div className="sheet-head">
        <h2>{compact(comments.length)} comments</h2>
      </div>
      <div className="sheet-body">
        {comments.length === 0 && <p className="note">No comments yet.</p>}
        {comments.map((comment) => (
          <div className="comment" key={comment.id || `${comment.user}-${comment.text}`}>
            <span className="avatar-fallback sm">{comment.user.slice(0, 1).toUpperCase()}</span>
            <span className="grow">
              <b>{comment.user}</b>
              <p>{comment.text}</p>
            </span>
          </div>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          addComment(clipId, text);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a comment"
          aria-label="Add a comment"
          maxLength={180}
          enterKeyHint="send"
        />
        <button type="submit" className="btn slim" disabled={!text.trim()}>
          Post
        </button>
      </form>
    </>
  );
}

function ShareSheet({ clipId }) {
  const { share } = useStore();
  return (
    <>
      <div className="sheet-head">
        <h2>Share</h2>
      </div>
      <div className="sheet-body">
        <button type="button" className="list-row" onClick={() => share(clipId)}>
          <Icon name="share" size={20} />
          <span className="grow">
            <b>Copy link</b>
            <span className="note">Copy a link to Speedy</span>
          </span>
        </button>
      </div>
    </>
  );
}

function CreatorSheet({ creatorId }) {
  const { state, go, closeSheet, person, isLive, liveFor } = useStore();
  const creator = person(creatorId);
  if (!creator) return null;
  const clips = state.clips.filter((clip) => clip.creatorId === creatorId);
  const products = state.products.filter((product) => product.creatorId === creatorId);
  const live = liveFor(creatorId);
  const mine = state.profile?.id === creator.id;

  return (
    <>
      <div className="sheet-head">
        <h2>{creator.name}</h2>
        {!mine && <FollowButton id={creator.id} />}
      </div>
      <div className="sheet-body">
        <div className="creator-top">
          <Avatar src={creator.avatar} name={creator.name} size={64} ring={isLive(creator.id)} />
          <div>
            <b>@{creator.handle}</b>
            <p className="note">{creator.bio}</p>
            <p className="note">{compact(creator.followers)} followers</p>
          </div>
        </div>
        {live && (
          <button
            type="button"
            className="btn block"
            onClick={() => {
              closeSheet();
              go("room", live.id);
            }}
          >
            Watch live · {compact(live.viewers)}
          </button>
        )}
        {clips.length > 0 && (
          <>
            <h3>Clips</h3>
            <div className="hscroll">
              {clips.map((clip) => (
                <button type="button" key={clip.id} onClick={() => clip.productId && go("product", clip.productId)}>
                  <img src={clip.image} alt="" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          </>
        )}
        {products.length > 0 && <h3>Shop</h3>}
        {products.map((product) => (
          <button
            type="button"
            key={product.id}
            className="list-row"
            onClick={() => {
              closeSheet();
              go("product", product.id);
            }}
          >
            <img src={product.image} alt="" referrerPolicy="no-referrer" />
            <span className="grow">
              <b>{product.name}</b>
              <span className="note">{compact(product.sold)} sold</span>
            </span>
            <b>{money(product.price)}</b>
          </button>
        ))}
      </div>
    </>
  );
}

function QuickSheet({ productId }) {
  const { state, addToCart, openSheet, pushToast, product: findProduct } = useStore();
  const product = findProduct(productId);
  const [size, setSize] = useState(null);
  const [shake, setShake] = useState(false);
  if (!product) return null;

  const commit = (buyNow) => {
    if (product.sizes?.length && !size) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      pushToast("Pick a size");
      return;
    }
    addToCart(product.id, size, 1, { quiet: buyNow });
    if (buyNow) openSheet({ type: "checkout", liveId: state.sheet?.liveId || null });
  };

  return (
    <>
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
            <p className="note">{product.description}</p>
          </div>
        </div>
        {product.sizes?.length > 0 && (
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
        <div className="row gap">
          <button type="button" className="btn ghost grow-btn" onClick={() => commit(false)}>
            Add to bag
          </button>
          <button type="button" className="btn grow-btn" onClick={() => commit(true)}>
            Buy now
          </button>
        </div>
      </div>
    </>
  );
}

function CartSheet() {
  const { state, changeQty, openSheet, closeSheet, go, product: findProduct } = useStore();
  const lines = state.cart.filter((line) => findProduct(line.productId));
  const subtotal = lines.reduce((sum, line) => sum + findProduct(line.productId).price * line.qty, 0);

  if (!lines.length) {
    return (
      <div className="sheet-body empty">
        <Icon name="bag" size={32} />
        <p>Your bag is empty.</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            closeSheet();
            go("shop");
          }}
        >
          Browse shop
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="sheet-head">
        <h2>Bag</h2>
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
                  <button type="button" aria-label="Decrease" onClick={() => changeQty(line.id, -1)}>
                    −
                  </button>
                  <span className="num">{line.qty}</span>
                  <button type="button" aria-label="Increase" onClick={() => changeQty(line.id, 1)}>
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
  const { state, setAddress, addAddress, checkout, product: findProduct } = useStore();
  const [useCoins, setUseCoins] = useState(true);
  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");
  const lines = state.cart.filter((item) => findProduct(item.productId));
  const address = state.addresses.find((item) => item.id === state.addressId) ?? state.addresses[0] ?? null;
  const subtotal = lines.reduce((sum, item) => sum + findProduct(item.productId).price * item.qty, 0);
  const maxCoins = Math.min(state.coins, Math.floor(subtotal * 30));
  const applied = useCoins ? maxCoins : 0;
  const total = Math.max(0, Math.round((subtotal - applied / 100) * 100) / 100);
  const bonus = subtotal >= 20 ? 15 : 5;

  if (!lines.length) {
    return (
      <div className="sheet-body">
        <p>Your bag is empty.</p>
      </div>
    );
  }

  return (
    <>
      <div className="sheet-head">
        <h2>Checkout</h2>
      </div>
      <div className="sheet-body">
        {lines.map((line) => {
          const product = findProduct(line.productId);
          return (
            <div className="list-row static" key={line.id}>
              <img src={product.image} alt="" referrerPolicy="no-referrer" />
              <span className="grow">
                <b>{product.name}</b>
                <span className="note">
                  {line.size ? `Size ${line.size} · ` : ""}Qty {line.qty}
                </span>
              </span>
              <b>{money(product.price * line.qty)}</b>
            </div>
          );
        })}
        <div className="chips">
          {state.addresses.map((item) => (
            <button type="button" key={item.id} className={cx("chip", address?.id === item.id && "on")} onClick={() => setAddress(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {address ? (
          <p className="note">
            {address.label} · {address.line}
          </p>
        ) : (
          <p className="note">Add a delivery address before you place the order.</p>
        )}
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await addAddress(label, line);
            if (saved) {
              setLabel("Home");
              setLine("");
            }
          }}
        >
          <label>
            Address label
            <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} required />
          </label>
          <label>
            Street
            <input value={line} onChange={(event) => setLine(event.target.value)} maxLength={160} required />
          </label>
          <button type="submit" className="btn ghost block">
            Save address
          </button>
        </form>
        {maxCoins > 0 ? (
          <button type="button" className="coin-toggle" onClick={() => setUseCoins((value) => !value)} aria-pressed={useCoins}>
            <span>
              Use {coinLabel(maxCoins)} coins
              <span className="note">Save {moneyExact(maxCoins / 100)}</span>
            </span>
            <span className={cx("switch", useCoins && "on")}>
              <i />
            </span>
          </button>
        ) : (
          <p className="note">No coins to apply.</p>
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
        <p className="note">You'll earn {bonus} coins. Card payments aren't connected, so this saves the order without billing a card.</p>
        <button
          type="button"
          className="btn block"
          disabled={!address}
          onClick={() =>
            checkout({
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
            })
          }
        >
          Place order · {moneyExact(total)}
        </button>
      </div>
    </>
  );
}

function GiftSheet({ creatorId }) {
  const { state, sendGift, person } = useStore();
  const creator = person(creatorId);
  return (
    <>
      <div className="sheet-head">
        <h2>Gift {creator?.name}</h2>
        <span className="coin-pill static">
          <CoinMark size={14} /> {coinLabel(state.coins)}
        </span>
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
    </>
  );
}

function BoltSheet() {
  const { state, go, closeSheet, openSheet } = useStore();
  const bag = state.cart.reduce((sum, line) => sum + line.qty, 0);
  const jump = (view) => {
    closeSheet();
    go(view);
  };
  return (
    <>
      <div className="sheet-body bolt-sheet">
        <BoltMark size={42} />
        <h2 className="wordmark">Speedy</h2>
        <button type="button" className="coin-pill static" onClick={() => jump("wallet")}>
          <CoinMark size={16} />
          <b className="num">{coinLabel(state.coins)}</b>
        </button>
        <button type="button" className="list-row" onClick={() => openSheet({ type: "list" })}>
          <Icon name="plus" size={20} />
          <span className="grow">
            <b>List a product</b>
            <span className="note">It shows up in the shop</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => openSheet({ type: "post" })}>
          <Icon name="play" size={20} />
          <span className="grow">
            <b>Post a clip</b>
            <span className="note">It shows up on the feed</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => jump("broadcast")}>
          <Icon name="live" size={20} />
          <span className="grow">
            <b>Go live</b>
            <span className="note">Sell from your own products</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => jump("studio")}>
          <Icon name="flash" size={20} filled />
          <span className="grow">
            <b>Sales</b>
            <span className="note">{moneyExact(state.studio.today)} today</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => jump("wallet")}>
          <CoinMark size={20} />
          <span className="grow">
            <b>Wallet</b>
            <span className="note">Coins you earn</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => jump("shop")}>
          <Icon name="bag" size={20} />
          <span className="grow">
            <b>Shop</b>
            <span className="note">Products people have listed</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        {bag > 0 && (
          <button type="button" className="list-row" onClick={() => openSheet({ type: "cart" })}>
            <Icon name="bag" size={20} />
            <span className="grow">
              <b>Your bag</b>
              <span className="note">{bag} ready to check out</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        )}
      </div>
    </>
  );
}

function ListSheet() {
  const { closeSheet, publishProduct, pushToast } = useStore();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState(LISTING_CATEGORIES[0]);
  const [sizes, setSizes] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(price);
    const was = compareAt.trim() ? Number(compareAt) : null;
    const qty = Number(stock);
    const parsedSizes = sizes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!image) {
      pushToast("Add a photo");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      pushToast("Enter a price");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      pushToast("Enter stock of at least 1");
      return;
    }
    if (was != null && (!(was > amount))) {
      pushToast("Compare-at price has to be higher than the price");
      return;
    }
    setBusy(true);
    try {
      await publishProduct({
        name: name.trim(),
        description: description.trim(),
        price: amount,
        compareAt: was,
        stock: qty,
        category,
        flash,
        sizes: parsedSizes.length ? parsedSizes : null,
        imageUrl: image,
      });
      closeSheet();
    } catch (error) {
      pushToast(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-head">
        <h2>List a product</h2>
      </div>
      <form className="sheet-body auth-form" onSubmit={submit}>
        <PhotoField label="Photo" value={image} onChange={setImage} />
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </label>
        <label>
          Price
          <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" required />
        </label>
        <label>
          Compare-at price
          <input value={compareAt} onChange={(event) => setCompareAt(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Stock
          <input value={stock} onChange={(event) => setStock(event.target.value)} inputMode="numeric" required />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {LISTING_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sizes
          <input value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="S, M, L" />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
        </label>
        <button type="button" className={cx("chip", flash && "on")} onClick={() => setFlash((value) => !value)}>
          {flash ? "Flash listing" : "Mark as flash"}
        </button>
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Listing" : "List product"}
        </button>
      </form>
    </>
  );
}

function PostSheet() {
  const { state, closeSheet, publishClip, pushToast } = useStore();
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = state.products.filter((product) => product.creatorId === state.profile?.id);

  const submit = async (event) => {
    event.preventDefault();
    if (!image) {
      pushToast("Add a photo");
      return;
    }
    setBusy(true);
    try {
      await publishClip({ caption: caption.trim(), imageUrl: image, productId: productId || null });
      closeSheet();
    } catch (error) {
      pushToast(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-head">
        <h2>Post a clip</h2>
      </div>
      <form className="sheet-body auth-form" onSubmit={submit}>
        <PhotoField label="Photo" value={image} onChange={setImage} />
        <label>
          Caption
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} required />
        </label>
        <label>
          Product
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">None</option>
            {mine.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Posting" : "Post"}
        </button>
      </form>
    </>
  );
}
