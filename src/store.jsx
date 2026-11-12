import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import {
  BUYERS,
  GIFTS,
  PRODUCTS,
  SEED_LEDGER,
  SEED_ORDERS,
  SEED_SALES,
  creatorMap,
  productMap,
} from "./data";
import { uid } from "./format";

const SAVE_KEY = "speedy-v1";
const VIEWS = new Set([
  "feed",
  "live",
  "room",
  "broadcast",
  "shop",
  "product",
  "wallet",
  "profile",
  "studio",
  "orders",
  "inbox",
  "search",
]);

const StoreContext = createContext(null);

function readRoute() {
  const match = window.location.hash.match(/^#\/([a-z]+)(?:\/([^/?#]+))?/);
  const view = match && VIEWS.has(match[1]) ? match[1] : "feed";
  const param = match?.[2] ? decodeURIComponent(match[2]) : null;
  return { view, param };
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function asObject(value, fallback) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function asNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildInitial() {
  const saved = loadSaved();
  const route = readRoute();
  const cart = Array.isArray(saved?.cart)
    ? saved.cart.filter((line) => line && productMap[line.productId] && line.qty > 0)
    : [];
  return {
    booting: true,
    view: route.view,
    param: route.param,
    sheet: null,
    toasts: [],
    orderFlash: null,
    lastGift: null,
    pressure: {},
    coins: asNumber(saved?.coins, 860),
    liked: asObject(saved?.liked, {}),
    savedClips: asObject(saved?.savedClips, {}),
    following: asObject(saved?.following, { nova: true, mira: true }),
    cart,
    orders: Array.isArray(saved?.orders) ? saved.orders : SEED_ORDERS,
    ledger: Array.isArray(saved?.ledger) ? saved.ledger : SEED_LEDGER,
    earned: {
      checkin: false,
      watch: false,
      share: false,
      order: false,
      ...asObject(saved?.earned, {}),
    },
    readNotes: asObject(saved?.readNotes, {}),
    addressId: typeof saved?.addressId === "string" ? saved.addressId : "home",
    comments: asObject(saved?.comments, {}),
    studio: {
      today: 1284,
      orders: 36,
      conversion: 4.8,
      week: [420, 510, 380, 640, 710, 880, 1284],
      recent: SEED_SALES,
    },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "boot":
      return { ...state, booting: false };
    case "route":
      return { ...state, view: action.view, param: action.param ?? null, sheet: null };
    case "sheet":
      return { ...state, sheet: action.sheet };
    case "toast":
      return { ...state, toasts: [...state.toasts.slice(-2), action.toast] };
    case "dismiss-toast":
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
    case "like": {
      const on = !state.liked[action.id];
      return { ...state, liked: { ...state.liked, [action.id]: on } };
    }
    case "save": {
      const on = !state.savedClips[action.id];
      return { ...state, savedClips: { ...state.savedClips, [action.id]: on } };
    }
    case "follow": {
      const on = !state.following[action.id];
      return { ...state, following: { ...state.following, [action.id]: on } };
    }
    case "comment": {
      const list = state.comments[action.clipId] ?? [];
      const next = [{ user: "You", text: action.text, likes: 0, mine: true }, ...list].slice(0, 40);
      return { ...state, comments: { ...state.comments, [action.clipId]: next } };
    }
    case "add-cart": {
      const size = action.size || null;
      const qty = Math.max(1, action.qty || 1);
      const index = state.cart.findIndex((line) => line.productId === action.productId && line.size === size);
      const cart = state.cart.slice();
      if (index >= 0) cart[index] = { ...cart[index], qty: cart[index].qty + qty };
      else cart.push({ id: uid("line"), productId: action.productId, size, qty });
      return { ...state, cart };
    }
    case "qty": {
      const cart = state.cart
        .map((line) => (line.id === action.id ? { ...line, qty: line.qty + action.delta } : line))
        .filter((line) => line.qty > 0);
      return { ...state, cart };
    }
    case "checkout": {
      const spent = Math.max(0, action.spentCoins || 0);
      const bonus = Math.max(0, action.bonus || 0);
      if (spent > state.coins) return state;
      const order = {
        id: uid("o"),
        items: action.lines,
        total: action.total,
        bonus,
        status: "Placed",
        at: Date.now(),
      };
      const ledger = [];
      if (spent) ledger.push({ id: uid("l"), label: "Shop checkout", delta: -spent, at: Date.now() });
      ledger.push({ id: uid("l"), label: "Order bonus", delta: bonus, at: Date.now() });
      return {
        ...state,
        cart: [],
        coins: state.coins - spent + bonus,
        orders: [order, ...state.orders],
        orderFlash: order,
        sheet: null,
        earned: { ...state.earned, order: true },
        ledger: [...ledger, ...state.ledger].slice(0, 24),
      };
    }
    case "credit":
      return {
        ...state,
        coins: state.coins + action.amount,
        ledger: [
          { id: uid("l"), label: action.label, delta: action.amount, at: Date.now() },
          ...state.ledger,
        ].slice(0, 24),
      };
    case "earn": {
      if (state.earned[action.kind]) return state;
      return {
        ...state,
        coins: state.coins + action.amount,
        earned: { ...state.earned, [action.kind]: true },
        ledger: [
          { id: uid("l"), label: action.label, delta: action.amount, at: Date.now() },
          ...state.ledger,
        ].slice(0, 24),
      };
    }
    case "gift": {
      const gift = GIFTS.find((item) => item.id === action.giftId);
      if (!gift || state.coins < gift.coins) return state;
      const name = creatorMap[action.creatorId]?.name ?? "a host";
      return {
        ...state,
        coins: state.coins - gift.coins,
        lastGift: { ...gift, nonce: uid("g"), creatorId: action.creatorId, to: name },
        ledger: [
          { id: uid("l"), label: `Gifted ${gift.name} to ${name}`, delta: -gift.coins, at: Date.now() },
          ...state.ledger,
        ].slice(0, 24),
      };
    }
    case "read":
      return { ...state, readNotes: { ...state.readNotes, [action.id]: true } };
    case "address":
      return { ...state, addressId: action.id };
    case "clear-flash":
      return { ...state, orderFlash: null };
    case "pressure":
      return {
        ...state,
        pressure: { ...state.pressure, [action.id]: (state.pressure[action.id] ?? 0) + action.n },
      };
    case "live-sale": {
      const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const buyer = BUYERS[Math.floor(Math.random() * BUYERS.length)];
      const sale = { id: uid("s"), buyer, item: product.name, amount: product.price, at: Date.now() };
      const week = state.studio.week.slice();
      week[6] += product.price;
      return {
        ...state,
        studio: {
          ...state.studio,
          today: state.studio.today + product.price,
          orders: state.studio.orders + 1,
          week,
          recent: [sale, ...state.studio.recent].slice(0, 12),
        },
      };
    }
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitial);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: "boot" }), 1050);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    if (!window.location.hash) window.history.replaceState(null, "", "#/feed");
    const onPop = () => {
      const route = readRoute();
      dispatch({ type: "route", ...route });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "live-sale" }), 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const slice = {
      coins: state.coins,
      liked: state.liked,
      savedClips: state.savedClips,
      following: state.following,
      cart: state.cart,
      orders: state.orders,
      ledger: state.ledger,
      earned: state.earned,
      readNotes: state.readNotes,
      addressId: state.addressId,
      comments: state.comments,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(slice));
    } catch {
      /* ignore quota errors in the demo */
    }
  }, [
    state.coins,
    state.liked,
    state.savedClips,
    state.following,
    state.cart,
    state.orders,
    state.ledger,
    state.earned,
    state.readNotes,
    state.addressId,
    state.comments,
  ]);

  const pushToast = (message) => {
    const id = uid("t");
    dispatch({ type: "toast", toast: { id, message } });
    setTimeout(() => dispatch({ type: "dismiss-toast", id }), 2500);
  };

  const go = (view, param = null) => {
    const hash = param ? `#/${view}/${encodeURIComponent(param)}` : `#/${view}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    dispatch({ type: "route", view, param });
  };

  const back = (fallback = "feed") => {
    const before = window.location.hash;
    window.history.back();
    window.setTimeout(() => {
      if (window.location.hash === before) {
        window.history.replaceState(null, "", `#/${fallback}`);
        dispatch({ type: "route", view: fallback, param: null });
      }
    }, 0);
  };

  const openSheet = (sheet) => dispatch({ type: "sheet", sheet });
  const closeSheet = () => dispatch({ type: "sheet", sheet: null });

  const toggleLike = (id) => dispatch({ type: "like", id });
  const toggleSave = (id) => dispatch({ type: "save", id });
  const toggleFollow = (id) => dispatch({ type: "follow", id });

  const addComment = (clipId, text) => {
    const clean = text.trim();
    if (!clean) return;
    dispatch({ type: "comment", clipId, text: clean.slice(0, 180) });
  };

  const addToCart = (productId, size, qty = 1, options = {}) => {
    const product = productMap[productId];
    if (!product) return;
    dispatch({ type: "add-cart", productId, size: size || null, qty });
    if (!options.quiet) pushToast(`${product.name} added to bag`);
  };

  const changeQty = (id, delta) => dispatch({ type: "qty", id, delta });

  const checkout = (payload) => {
    if (!payload.lines?.length) return;
    if ((payload.spentCoins || 0) > stateRef.current.coins) {
      pushToast("Not enough coins");
      return;
    }
    dispatch({ type: "checkout", ...payload });
  };

  const credit = (amount, label) => dispatch({ type: "credit", amount, label });

  const earn = (kind, amount, label) => {
    if (stateRef.current.earned[kind]) return false;
    dispatch({ type: "earn", kind, amount, label });
    pushToast(`+${amount} coins · ${label}`);
    return true;
  };

  const buyPack = (pack) => {
    credit(pack.coins, `${pack.coins.toLocaleString("en-US")} coin pack`);
    closeSheet();
    pushToast(`Added ${pack.coins.toLocaleString("en-US")} coins`);
  };

  const sendGift = (giftId, creatorId) => {
    const gift = GIFTS.find((item) => item.id === giftId);
    if (!gift) return;
    if (stateRef.current.coins < gift.coins) {
      pushToast("Not enough coins");
      closeSheet();
      go("wallet");
      return;
    }
    dispatch({ type: "gift", giftId, creatorId });
    closeSheet();
  };

  const share = (clipId, label = "Link copied") => {
    const link = `https://speedy.app/v/${clipId}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    if (!stateRef.current.earned.share) {
      dispatch({ type: "earn", kind: "share", amount: 5, label: "Shared a clip" });
      pushToast(`${label} · +5 coins`);
    } else {
      pushToast(label);
    }
  };

  const markRead = (id) => dispatch({ type: "read", id });
  const setAddress = (id) => dispatch({ type: "address", id });
  const bumpPressure = (id, n = 1) => dispatch({ type: "pressure", id, n });

  const dismissFlash = (view, param = null) => {
    dispatch({ type: "clear-flash" });
    if (view) go(view, param);
  };

  const skipBoot = () => dispatch({ type: "boot" });

  const resetDemo = () => {
    localStorage.removeItem(SAVE_KEY);
    window.location.hash = "#/feed";
    window.location.reload();
  };

  const value = {
    state,
    go,
    back,
    openSheet,
    closeSheet,
    toggleLike,
    toggleSave,
    toggleFollow,
    addComment,
    addToCart,
    changeQty,
    checkout,
    buyPack,
    sendGift,
    share,
    earn,
    credit,
    markRead,
    setAddress,
    bumpPressure,
    dismissFlash,
    skipBoot,
    resetDemo,
    pushToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
