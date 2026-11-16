import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "./config";
import { coinLabel, compact, cx, money } from "./format";
import { CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { BagButton, Header, Photo, Avatar, Thumb } from "./ui";

export function Shop() {
  const { state, go, openSheet } = useStore();
  const [category, setCategory] = useState("All");
  const bag = state.cart.reduce((sum, line) => sum + line.qty, 0);
  const flash = state.products.filter((product) => product.flash && product.stock > 0);
  const items = state.products.filter((product) => category === "All" || product.category === category);

  return (
    <section className={cx("page", bag > 0 && "has-cart")}>
      <header className="subhead">
        <button type="button" className="icon-btn" aria-label="Search" onClick={() => go("search")}>
          <Icon name="search" size={22} />
        </button>
        <h1>Shop</h1>
        <BagButton count={bag} onClick={() => openSheet({ type: "cart" })} />
      </header>

      {flash.length > 0 && (
        <section className="flash-hero">
          <div className="row spread">
            <b>Flash deals</b>
          </div>
          <div className="flash-row">
            {flash.map((product) => (
              <button type="button" key={product.id} onClick={() => go("product", product.id)}>
                <img src={product.image} alt="" referrerPolicy="no-referrer" />
                <b>{money(product.price)}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      <button type="button" className="coin-banner" onClick={() => go("wallet")}>
        <CoinMark />
        <span className="grow">
          <b>{coinLabel(state.coins)} coins</b>
          <span className="note">100 coins = $1 off, up to 30% of your bag</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <div className="chips" role="tablist">
        {CATEGORIES.map((item) => (
          <button type="button" key={item} className={cx("chip", category === item && "on")} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="grid-2">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {items.length === 0 && (
        <div className="empty">
          <p>{category === "All" ? "No products listed yet." : `Nothing in ${category} yet.`}</p>
          <button type="button" className="btn" onClick={() => openSheet({ type: "list" })}>
            Sell something
          </button>
        </div>
      )}

      {bag > 0 && (
        <button type="button" className="cart-bar" onClick={() => openSheet({ type: "cart" })}>
          <span>
            {bag} {bag === 1 ? "item" : "items"}
          </span>
          <span>View bag</span>
        </button>
      )}
    </section>
  );
}

export function ProductCard({ product }) {
  const { go } = useStore();
  const soldOut = product.stock <= 0;
  return (
    <button type="button" className={cx("pcard", soldOut && "sold-out")} onClick={() => go("product", product.id)}>
      <span className="pcard-media">
        <Photo src={product.image} alt={product.name} />
        {soldOut ? <em className="out">Sold out</em> : product.flash && <em>Flash</em>}
      </span>
      <span className="brand">{product.brand}</span>
      <span className="clamp name">{product.name}</span>
      <span className="price-row">
        <b>{money(product.price)}</b>
        {product.was && <s className="was">{money(product.was)}</s>}
      </span>
      <span className="note star-line">
        {product.reviews > 0 ? (
          <>
            <Icon name="star" size={12} /> {product.rating} · {compact(product.sold)} sold
          </>
        ) : (
          <>{compact(product.sold)} sold</>
        )}
      </span>
    </button>
  );
}

export function ProductPage() {
  const { state, go, back, openSheet, addToCart, removeProduct, pushToast, product: findProduct, person } = useStore();
  const product = findProduct(state.param);
  const creator = product ? person(product.creatorId) : null;
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const bag = state.cart.reduce((sum, line) => sum + line.qty, 0);

  useEffect(() => {
    setSize(null);
    setQty(1);
    setConfirm(false);
    setBusy(false);
  }, [state.param]);

  if (!product) {
    return (
      <section className="page sub">
        <Header title="Shop" fallback="shop" />
        <div className="empty">
          <p>This product isn't available anymore.</p>
          <button type="button" className="btn" onClick={() => go("shop", null, { replace: true })}>
            Back to shop
          </button>
        </div>
      </section>
    );
  }

  const needsSize = !!product.sizes?.length;
  const soldOut = product.stock <= 0;
  const mine = product.creatorId === state.profile?.id;
  const maxQty = Math.max(1, Math.min(10, product.stock));

  const requireSize = () => {
    if (needsSize && !size) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      pushToast("Pick a size");
      return false;
    }
    return true;
  };

  const buy = async (now) => {
    if (!requireSize()) return;
    setBusy(true);
    const ok = await addToCart(product.id, size, qty, { quiet: now });
    setBusy(false);
    if (ok && now) openSheet({ type: "checkout" });
  };

  return (
    <div className="stack">
      <section className="page sub product-page">
        <Header
          title={product.brand}
          fallback="shop"
          right={<BagButton count={bag} onClick={() => openSheet({ type: "cart" })} />}
        />
        <Photo src={product.image} alt={product.name} className="hero-photo" />
        <div className="product-copy">
          <div className="row spread">
            <span className="brand">{product.category}</span>
            <span className="note star-line">
              {compact(product.sold)} sold · {soldOut ? "Sold out" : `${product.stock} left`}
            </span>
          </div>
          <h2>{product.name}</h2>
          <p className="price-row big">
            <b>{money(product.price)}</b>
            {product.was && <s className="was">{money(product.was)}</s>}
            {product.was && <span className="sale">{Math.round((1 - product.price / product.was) * 100)}% off</span>}
          </p>
          {product.description && <p className="lede">{product.description}</p>}
          {creator && (
            <button type="button" className="person slim" onClick={() => openSheet({ type: "creator", creatorId: creator.id })}>
              <Avatar src={creator.avatar} name={creator.name} size={40} />
              <span className="person-copy">
                <b>{creator.name}</b>
                <span className="note">@{creator.handle}</span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          )}
          {!mine && !soldOut && needsSize && (
            <div className={cx("size-block", shake && "shake")}>
              <span className="note">Size {size ? `· ${size}` : ""}</span>
              <div className="chips">
                {product.sizes.map((item) => (
                  <button type="button" key={item} className={cx("chip", size === item && "on")} onClick={() => setSize(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!mine && !soldOut && (
            <div className="row spread qty-row">
              <span>Quantity</span>
              <span className="stepper">
                <button type="button" aria-label="Decrease" onClick={() => setQty((value) => Math.max(1, value - 1))} disabled={qty <= 1}>
                  −
                </button>
                <span className="num">{qty}</span>
                <button type="button" aria-label="Increase" onClick={() => setQty((value) => Math.min(maxQty, value + 1))} disabled={qty >= maxQty}>
                  +
                </button>
              </span>
            </div>
          )}
          {mine && (
            <div className="owner-box">
              <b>This is your listing</b>
              <span className="note">
                {product.stock} in stock · {compact(product.sold)} sold
              </span>
              {confirm ? (
                <div className="row gap">
                  <button type="button" className="btn ghost grow-btn" onClick={() => setConfirm(false)} disabled={busy}>
                    Keep it
                  </button>
                  <button
                    type="button"
                    className="btn danger grow-btn"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const ok = await removeProduct(product.id);
                      if (ok) back("shop");
                      else setBusy(false);
                    }}
                  >
                    {busy ? "Removing…" : "Remove listing"}
                  </button>
                </div>
              ) : (
                <button type="button" className="btn ghost block" onClick={() => setConfirm(true)}>
                  <Icon name="trash" size={16} /> Remove listing
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      {!mine && (
        <div className="buybar">
          {soldOut ? (
            <button type="button" className="btn block" disabled>
              Sold out
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={() => buy(false)} disabled={busy}>
                Add to bag
              </button>
              <button type="button" className="btn" onClick={() => buy(true)} disabled={busy}>
                Buy now · {money(product.price * qty)}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchPage() {
  const { state, go, back, openSheet, person } = useStore();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase().replace(/^[@#]/, "");

  const results = useMemo(() => {
    if (!q) return { products: [], creators: [], lives: [], clips: [] };
    return {
      products: state.products.filter((product) => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(q)),
      creators: state.people.filter((creator) => `${creator.name} ${creator.handle} ${creator.bio}`.toLowerCase().includes(q)),
      lives: state.lives.filter((live) => {
        const host = person(live.creatorId);
        return `${live.title} ${host?.name || ""} ${host?.handle || ""}`.toLowerCase().includes(q);
      }),
      clips: state.clips.filter((clip) => clip.caption.toLowerCase().includes(q)),
    };
  }, [q, state.products, state.people, state.lives, state.clips, person]);

  const empty = q && !results.products.length && !results.creators.length && !results.lives.length && !results.clips.length;

  return (
    <section className="page sub">
      <header className="subhead search-head">
        <button type="button" className="icon-btn" onClick={() => back("feed")} aria-label="Back">
          <Icon name="back" size={26} />
        </button>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people, posts, products"
          aria-label="Search Speedy"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
            <Icon name="close" size={20} />
          </button>
        )}
      </header>
      {!q && (
        <div className="search-body">
          <h2>Live now</h2>
          {state.lives.length === 0 && <p className="note">Nobody is live right now.</p>}
          {state.lives.slice(0, 6).map((live) => (
            <button type="button" className="list-row" key={live.id} onClick={() => go("room", live.id)}>
              <img src={live.cover} alt="" referrerPolicy="no-referrer" />
              <span className="grow">
                <b>{live.title}</b>
                <span className="note">{person(live.creatorId)?.name}</span>
              </span>
              <span className="live-badge">LIVE</span>
            </button>
          ))}
          {state.people.length > 0 && <h2>People on Speedy</h2>}
          {state.people
            .filter((creator) => creator.id !== state.profile?.id)
            .slice(0, 8)
            .map((creator) => (
              <button type="button" key={creator.id} className="list-row" onClick={() => openSheet({ type: "creator", creatorId: creator.id })}>
                <Avatar src={creator.avatar} name={creator.name} size={44} />
                <span className="grow">
                  <b>{creator.name}</b>
                  <span className="note">
                    @{creator.handle} · {compact(creator.followers)} {creator.followers === 1 ? "follower" : "followers"}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
      {q && (
        <div className="search-body">
          {empty && <p className="note pad">Nothing matches “{query.trim()}”.</p>}
          {results.creators.length > 0 && <h2>People</h2>}
          {results.creators.map((creator) => (
            <button type="button" key={creator.id} className="list-row" onClick={() => openSheet({ type: "creator", creatorId: creator.id })}>
              <Avatar src={creator.avatar} name={creator.name} size={44} />
              <span className="grow">
                <b>{creator.name}</b>
                <span className="note">@{creator.handle}</span>
              </span>
            </button>
          ))}
          {results.clips.length > 0 && <h2>Posts</h2>}
          {results.clips.length > 0 && (
            <div className="grid3">
              {results.clips.map((clip) => (
                <button type="button" key={clip.id} className="tile" onClick={() => go("feed", clip.id)} aria-label={clip.caption}>
                  <Thumb src={clip.image} />
                  <span className="tile-count">
                    <Icon name="heart" size={12} filled /> {compact(clip.likes)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.lives.length > 0 && <h2>Live</h2>}
          {results.lives.map((live) => (
            <button type="button" key={live.id} className="list-row" onClick={() => go("room", live.id)}>
              <img src={live.cover} alt="" referrerPolicy="no-referrer" />
              <span className="grow">
                <b>{live.title}</b>
                <span className="note">{compact(live.viewers)} watching</span>
              </span>
            </button>
          ))}
          {results.products.length > 0 && <h2>Shop</h2>}
          <div className="grid-2 tight">
            {results.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
