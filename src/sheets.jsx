import { useEffect, useState } from "react";
import {
  ADDRESSES,
  CLIPS,
  CREATORS,
  GIFTS,
  PACKS,
  PRODUCTS,
  creatorMap,
  isLive,
  liveFor,
  productMap,
} from "./data";
import { coinLabel, compact, cx, money, moneyExact } from "./format";
import { BoltMark, CoinMark, Icon } from "./icons";
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
  const tall = ["checkout", "quick", "comments", "creator", "cart"].includes(sheet.type);

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
        {sheet.type === "pack" && <PackSheet packId={sheet.packId} />}
      </div>
    </>
  );
}

function CommentsSheet({ clipId }) {
  const { state, addComment } = useStore();
  const clip = CLIPS.find((item) => item.id === clipId);
  const [text, setText] = useState("");
  const [liked, setLiked] = useState({});
  if (!clip) return null;
  const extras = state.comments[clipId] ?? [];
  const all = [...extras, ...clip.thread];

  return (
    <>
      <div className="sheet-head">
        <h2>{compact(clip.comments + extras.length)} comments</h2>
      </div>
      <div className="sheet-body">
        {all.map((comment, index) => {
          const key = `${comment.user}-${index}`;
          const on = !!liked[key];
          return (
            <div className="comment" key={key}>
              <span className="avatar-fallback sm">{comment.user.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <b>{comment.user}</b>
                <p>{comment.text}</p>
              </span>
              <button
                type="button"
                className={cx("comment-like", on && "on")}
                aria-label="Like comment"
                onClick={() => setLiked((map) => ({ ...map, [key]: !map[key] }))}
              >
                <Icon name="heart" size={14} filled={on} />
                <span>{(comment.likes || 0) + (on ? 1 : 0)}</span>
              </button>
            </div>
          );
        })}
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
  const { share, closeSheet } = useStore();
  return (
    <>
      <div className="sheet-head">
        <h2>Share</h2>
      </div>
      <div className="sheet-body">
        <button type="button" className="list-row" onClick={() => share(clipId, "Link copied")}>
          <Icon name="share" size={20} />
          <span className="grow">
            <b>Copy link</b>
            <span className="note">speedy.app/v/{clipId}</span>
          </span>
        </button>
        {CREATORS.slice(0, 5).map((creator) => (
          <button
            type="button"
            key={creator.id}
            className="list-row"
            onClick={() => {
              share(clipId, `Sent to ${creator.name}`);
              closeSheet();
            }}
          >
            <Avatar src={creator.avatar} name={creator.name} size={40} />
            <span className="grow">
              <b>{creator.name}</b>
              <span className="note">@{creator.handle}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function CreatorSheet({ creatorId }) {
  const { go, openSheet, closeSheet } = useStore();
  const creator = creatorMap[creatorId];
  if (!creator) return null;
  const clips = CLIPS.filter((clip) => clip.creatorId === creatorId);
  const products = PRODUCTS.filter((product) => product.creatorId === creatorId);
  const live = liveFor(creatorId);

  return (
    <>
      <div className="sheet-head">
        <h2>{creator.name}</h2>
        <FollowButton id={creator.id} />
      </div>
      <div className="sheet-body">
        <div className="creator-top">
          <Avatar src={creator.avatar} name={creator.name} size={64} ring={isLive(creator.id)} />
          <div>
            <b>
              @{creator.handle}
              {creator.verified && (
                <span className="verified">
                  <Icon name="verified" size={14} />
                </span>
              )}
            </b>
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
                <button type="button" key={clip.id} onClick={() => openSheet({ type: "quick", productId: clip.productId })}>
                  <img src={clip.image} alt="" referrerPolicy="no-referrer" style={{ objectPosition: clip.focus }} />
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
  const { addToCart, openSheet, pushToast } = useStore();
  const product = productMap[productId];
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
    if (buyNow) openSheet({ type: "checkout" });
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
  const { state, changeQty, openSheet, closeSheet, go } = useStore();
  const lines = state.cart.filter((line) => productMap[line.productId]);
  const subtotal = lines.reduce((sum, line) => sum + productMap[line.productId].price * line.qty, 0);

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
          const product = productMap[line.productId];
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
        <button type="button" className="btn block" onClick={() => openSheet({ type: "checkout" })}>
          Checkout
        </button>
      </div>
    </>
  );
}

function CheckoutSheet() {
  const { state, setAddress, checkout } = useStore();
  const [useCoins, setUseCoins] = useState(true);
  const lines = state.cart.filter((line) => productMap[line.productId]);
  const address = ADDRESSES.find((item) => item.id === state.addressId) ?? ADDRESSES[0];
  const subtotal = lines.reduce((sum, line) => sum + productMap[line.productId].price * line.qty, 0);
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
          const product = productMap[line.productId];
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
          {ADDRESSES.map((item) => (
            <button type="button" key={item.id} className={cx("chip", address.id === item.id && "on")} onClick={() => setAddress(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="note">
          {address.label} · {address.line}
        </p>
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
        <p className="note">You'll earn {bonus} coins. Demo checkout — nothing is charged and nothing ships.</p>
        <button
          type="button"
          className="btn block"
          onClick={() =>
            checkout({
              total,
              spentCoins: applied,
              bonus,
              lines: lines.map((line) => ({
                productId: line.productId,
                size: line.size,
                qty: line.qty,
                price: productMap[line.productId].price,
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
  const { state, sendGift } = useStore();
  const creator = creatorMap[creatorId];
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
        <button type="button" className="list-row" onClick={() => jump("broadcast")}>
          <Icon name="live" size={20} />
          <span className="grow">
            <b>Go live</b>
            <span className="note">Preview a room on this device</span>
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
            <span className="note">Earn, packs, activity</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="list-row" onClick={() => jump("shop")}>
          <Icon name="bag" size={20} />
          <span className="grow">
            <b>Flash deals</b>
            <span className="note">The clock is already running</span>
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

function PackSheet({ packId }) {
  const { buyPack, closeSheet } = useStore();
  const pack = PACKS.find((item) => item.id === packId);
  if (!pack) return null;
  return (
    <div className="sheet-body pack-confirm">
      <CoinMark size={36} />
      <h2>Add {coinLabel(pack.coins)} coins</h2>
      <p className="price-row big">
        <b>{moneyExact(pack.price)}</b>
      </p>
      <p className="note">Demo wallet. Your card is not charged.</p>
      <button type="button" className="btn block" onClick={() => buyPack(pack)}>
        Add coins
      </button>
      <button type="button" className="btn ghost block" onClick={closeSheet}>
        Cancel
      </button>
    </div>
  );
}
