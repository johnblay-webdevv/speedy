import { useMemo, useState } from "react";
import { CATEGORIES } from "./config";
import { coinLabel, compact, cx, money, moneyExact } from "./format";
import { CoinMark, Icon } from "./icons";
import { useStore } from "./store";
import { BagButton, Header, Photo, Avatar } from "./ui";

export function Shop() {
  const { state, go, openSheet } = useStore();
  const [category, setCategory] = useState("All");
  const bag = state.cart.reduce((sum, line) => sum + line.qty, 0);
  const flash = state.products.filter((product) => product.flash);
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
            <b>Flash</b>
          </div>
          <p>Sellers marked these down.</p>
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
          <span className="note">100 coins = $1, up to 30% of a bag</span>
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
          <p>No products listed yet.</p>
          <button type="button" className="btn" onClick={() => openSheet({ type: "list" })}>
            List a product
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
  return (
    <button type="button" className="pcard" onClick={() => go("product", product.id)}>
      <span className="pcard-media">
        <Photo src={product.image} alt={product.name} />
        {product.flash && <em>Flash</em>}
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
  const { state, go, openSheet, addToCart, product: findProduct, person } = useStore();
  const product = findProduct(state.param);
  const creator = product ? person(product.creatorId) : null;
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [shake, setShake] = useState(false);
  const bag = state.cart.reduce((sum, line) => sum + line.qty, 0);

  if (!product) {
    return (
      <section className="page sub">
        <Header title="Shop" fallback="shop" />
        <div className="empty">
          <p>That product has left the shelf.</p>
        </div>
      </section>
    );
  }

  const needsSize = !!product.sizes?.length;

  const requireSize = () => {
    if (needsSize && !size) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      return false;
    }
    return true;
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
            <span className="brand">{product.brand}</span>
            <span className="note star-line">{compact(product.sold)} sold · {product.stock} left</span>
          </div>
          <h2>{product.name}</h2>
          <p className="price-row big">
            <b>{money(product.price)}</b>
            {product.was && <s className="was">{money(product.was)}</s>}
            {product.was && <span className="sale">{Math.round((1 - product.price / product.was) * 100)}% off</span>}
          </p>
          <p className="lede">{product.description}</p>
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
          {needsSize && (
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
          <div className="row spread qty-row">
            <span>Quantity</span>
            <span className="stepper">
              <button type="button" aria-label="Decrease" onClick={() => setQty((value) => Math.max(1, value - 1))}>
                −
              </button>
              <span className="num">{qty}</span>
              <button type="button" aria-label="Increase" onClick={() => setQty((value) => Math.min(5, value + 1))}>
                +
              </button>
            </span>
          </div>
          <p className="note">{product.stock} in stock</p>
        </div>
      </section>
      <div className="buybar">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (!requireSize()) return;
            addToCart(product.id, size, qty);
          }}
        >
          Add to bag
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!requireSize()) return;
            addToCart(product.id, size, qty, { quiet: true });
            openSheet({ type: "checkout" });
          }}
        >
          Buy · {money(product.price * qty)}
        </button>
      </div>
    </div>
  );
}

export function SearchPage() {
  const { state, go, back, openSheet, person } = useStore();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return { products: [], creators: [], lives: [] };
    return {
      products: state.products.filter((product) => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(q)),
      creators: state.people.filter((creator) => `${creator.name} ${creator.handle} ${creator.bio}`.toLowerCase().includes(q)),
      lives: state.lives.filter((live) => {
        const host = person(live.creatorId);
        return `${live.title} ${host?.name || ""} ${host?.handle || ""}`.toLowerCase().includes(q);
      }),
    };
  }, [q, state.products, state.people, state.lives, person]);

  const empty = q && !results.products.length && !results.creators.length && !results.lives.length;

  return (
    <section className="page sub">
      <header className="subhead search-head">
        <button type="button" className="icon-btn" onClick={() => back("shop")} aria-label="Back">
          <Icon name="back" size={26} />
        </button>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Products, people, lives"
          aria-label="Search Speedy"
          enterKeyHint="search"
        />
      </header>
      {!q && (
        <div className="search-body">
          <h2>Live now</h2>
          {state.lives.length === 0 && <p className="note">Nobody is live.</p>}
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
        </div>
      )}
      {q && (
        <div className="search-body">
          {empty && <p className="note pad">Nothing matches “{query.trim()}”.</p>}
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
