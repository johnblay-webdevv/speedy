import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
  addAddress as insertAddress,
  addComment as insertComment,
  changeCoins,
  createClip,
  createLive,
  createProduct,
  deleteCart,
  deleteClip,
  deleteProduct,
  endLive,
  insertCart,
  loadAccount,
  loadCatalog,
  loadComments,
  loadNotes,
  loadShareTargets,
  shareClipWith,
  markNoteRead,
  placeOrder,
  selectAddress as saveSelectedAddress,
  sendGift as giftCoins,
  setFollow,
  setLike,
  setSave,
  updateCart,
  updateProfile,
} from "./account";
import { GIFTS } from "./config";
import { uid } from "./format";

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

const REFRESH_MS = 45000;

const StoreContext = createContext(null);

function readRoute() {
  const match = window.location.hash.match(/^#\/([a-z]+)(?:\/([^/?#]+))?/);
  const view = match && VIEWS.has(match[1]) ? match[1] : "feed";
  const param = match?.[2] ? decodeURIComponent(match[2]) : null;
  return { view, param };
}

function depth() {
  return window.history.state?.depth || 0;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function buildInitial() {
  const route = readRoute();
  return {
    booting: true,
    accountReady: false,
    accountError: "",
    view: route.view,
    param: route.param,
    sheet: null,
    toasts: [],
    orderFlash: null,
    lastGift: null,
    feedTick: 0,
    profile: null,
    people: [],
    products: [],
    clips: [],
    lives: [],
    coins: 0,
    liked: {},
    savedClips: {},
    following: {},
    cart: [],
    orders: [],
    ledger: [],
    earned: { checkin: false, watch: false, share: false, order: false },
    addresses: [],
    addressId: null,
    notes: [],
    sales: [],
    studio: { today: 0, orders: 0, week: [0, 0, 0, 0, 0, 0, 0], recent: [] },
    comments: {},
  };
}

function bumpCount(list, id, key, delta) {
  return list.map((item) => (item.id === id ? { ...item, [key]: Math.max(0, item[key] + delta) } : item));
}

function reducer(state, action) {
  switch (action.type) {
    case "boot":
      return state.accountReady ? { ...state, booting: false } : state;
    case "hydrate":
      return { ...state, ...action.data, booting: false, accountReady: true, accountError: "" };
    case "hydrate-error":
      return { ...state, booting: false, accountError: action.message };
    case "catalog":
      return { ...state, ...action.catalog };
    case "notes":
      return { ...state, notes: action.notes };
    case "route":
      return { ...state, view: action.view, param: action.param ?? null, sheet: null };
    case "feed-tick":
      return { ...state, feedTick: state.feedTick + 1 };
    case "sheet":
      return { ...state, sheet: action.sheet };
    case "toast":
      return { ...state, toasts: [...state.toasts.slice(-2), action.toast] };
    case "dismiss-toast":
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
    case "like": {
      const on = !state.liked[action.id];
      return {
        ...state,
        liked: { ...state.liked, [action.id]: on },
        clips: bumpCount(state.clips, action.id, "likes", on ? 1 : -1),
      };
    }
    case "save": {
      const on = !state.savedClips[action.id];
      return {
        ...state,
        savedClips: { ...state.savedClips, [action.id]: on },
        clips: bumpCount(state.clips, action.id, "saves", on ? 1 : -1),
      };
    }
    case "follow": {
      const on = !state.following[action.id];
      return {
        ...state,
        following: { ...state.following, [action.id]: on },
        people: state.people.map((person) =>
          person.id === action.id ? { ...person, followers: Math.max(0, person.followers + (on ? 1 : -1)) } : person,
        ),
      };
    }
    case "set-comments":
      return { ...state, comments: { ...state.comments, [action.clipId]: action.list } };
    case "comment":
      return {
        ...state,
        clips: bumpCount(state.clips, action.clipId, "comments", 1),
        comments: {
          ...state.comments,
          [action.clipId]: [action.comment, ...(state.comments[action.clipId] ?? [])].slice(0, 40),
        },
      };
    case "add-cart": {
      const size = action.size || null;
      const index = state.cart.findIndex((line) => line.productId === action.productId && line.size === size);
      const cart = state.cart.slice();
      if (index >= 0) cart[index] = { ...cart[index], qty: cart[index].qty + action.qty };
      else cart.push({ id: action.id, productId: action.productId, size, qty: action.qty });
      return { ...state, cart };
    }
    case "set-qty":
      return {
        ...state,
        cart: state.cart.map((line) => (line.id === action.id ? { ...line, qty: action.qty } : line)).filter((line) => line.qty > 0),
      };
    case "drop-line":
      return { ...state, cart: state.cart.filter((line) => line.id !== action.id) };
    case "restore-line":
      return state.cart.some((line) => line.id === action.line.id) ? state : { ...state, cart: [...state.cart, action.line] };
    case "retarget-line":
      return { ...state, cart: state.cart.map((line) => (line.id === action.from ? { ...line, id: action.to } : line)) };
    case "checkout-sync":
      return {
        ...state,
        ...action.catalog,
        cart: [],
        coins: action.coins,
        orders: [action.order, ...state.orders],
        orderFlash: action.order,
        sheet: null,
        earned: { ...state.earned, order: true },
        ledger: [...action.ledger, ...state.ledger].slice(0, 24),
      };
    case "wallet-sync":
      return {
        ...state,
        coins: action.coins,
        earned: action.kind ? { ...state.earned, [action.kind]: true } : state.earned,
        ledger: action.entry ? [action.entry, ...state.ledger].slice(0, 24) : state.ledger,
        lastGift: action.gift ?? state.lastGift,
      };
    case "read":
      return { ...state, notes: state.notes.map((note) => (note.id === action.id ? { ...note, read: true } : note)) };
    case "address":
      return { ...state, addressId: action.id };
    case "add-address":
      return {
        ...state,
        addresses: [...state.addresses, action.address],
        addressId: action.address.id,
      };
    case "patch-profile": {
      const profile = { ...state.profile, ...action.profile };
      return {
        ...state,
        profile,
        people: state.people.map((person) =>
          person.id === profile.id ? { ...person, name: profile.name, handle: profile.handle, bio: profile.bio, avatar: profile.avatar } : person,
        ),
        products: state.products.map((product) => (product.creatorId === profile.id ? { ...product, brand: profile.name } : product)),
      };
    }
    case "remove-clip":
      return { ...state, clips: state.clips.filter((clip) => clip.id !== action.id) };
    case "remove-product":
      return {
        ...state,
        products: state.products.filter((product) => product.id !== action.id),
        cart: state.cart.filter((line) => line.productId !== action.id),
        clips: state.clips.map((clip) => (clip.productId === action.id ? { ...clip, productId: null } : clip)),
      };
    case "viewers":
      return { ...state, lives: state.lives.map((live) => (live.id === action.id ? { ...live, viewers: action.count } : live)) };
    case "end-live":
      return { ...state, lives: state.lives.filter((live) => live.id !== action.id) };
    case "clear-flash":
      return { ...state, orderFlash: null };
    default:
      return state;
  }
}

export function StoreProvider({ onSignOut, children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pending = useRef(false);
  const pendingLines = useRef({});
  const writes = useRef({ open: 0, seq: 0 });

  const write = async (task) => {
    writes.current.open += 1;
    try {
      return await task();
    } finally {
      writes.current.open -= 1;
      writes.current.seq += 1;
    }
  };

  useEffect(() => {
    let cancel = false;
    const started = Date.now();
    loadAccount()
      .then(async (data) => {
        const wait = 600 - (Date.now() - started);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        if (!cancel) dispatch({ type: "hydrate", data });
      })
      .catch((error) => {
        if (!cancel) dispatch({ type: "hydrate-error", message: error.message || "Couldn't load your account" });
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    if (!window.history.state || typeof window.history.state.depth !== "number") {
      window.history.replaceState({ depth: 0 }, "", window.location.hash || "#/feed");
    }
    const onPop = () => {
      const route = readRoute();
      dispatch({ type: "route", ...route });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const pushToast = (message) => {
    const id = uid("t");
    dispatch({ type: "toast", toast: { id, message } });
    setTimeout(() => dispatch({ type: "dismiss-toast", id }), 2600);
  };

  const go = (view, param = null, options = {}) => {
    const hash = param ? `#/${view}/${encodeURIComponent(param)}` : `#/${view}`;
    if (window.location.hash !== hash) {
      if (options.replace) window.history.replaceState({ depth: depth() }, "", hash);
      else window.history.pushState({ depth: depth() + 1 }, "", hash);
    }
    dispatch({ type: "route", view, param });
  };

  const back = (fallback = "feed") => {
    if (depth() > 0) window.history.back();
    else go(fallback, null, { replace: true });
  };

  const tab = (view) => {
    if (view === "feed" && stateRef.current.view === "feed") {
      dispatch({ type: "feed-tick" });
      refresh();
      return;
    }
    go(view);
  };

  const refreshCatalog = async () => {
    const catalog = await loadCatalog();
    dispatch({ type: "catalog", catalog });
    return catalog;
  };

  const refresh = async () => {
    if (!stateRef.current.accountReady) return;
    const seq = writes.current.seq;
    try {
      const [catalog, notes] = await Promise.all([loadCatalog(), loadNotes()]);
      if (writes.current.open || writes.current.seq !== seq) {
        setTimeout(refresh, 1500);
        return;
      }
      dispatch({ type: "catalog", catalog });
      dispatch({ type: "notes", notes });
    } catch {
      // A missed background refresh is retried on the next tick.
    }
  };

  const openSheet = (sheet) => {
    dispatch({ type: "sheet", sheet });
    if (sheet?.type === "comments" && sheet.clipId) {
      loadComments(sheet.clipId)
        .then((list) => dispatch({ type: "set-comments", clipId: sheet.clipId, list }))
        .catch(() => pushToast("Couldn't load comments"));
    }
  };
  const closeSheet = () => dispatch({ type: "sheet", sheet: null });

  const toggleLike = async (id) => {
    const on = !stateRef.current.liked[id];
    dispatch({ type: "like", id });
    try {
      await write(() => setLike(id, on));
    } catch (error) {
      dispatch({ type: "like", id });
      pushToast(error.message);
    }
  };

  const toggleSave = async (id) => {
    const on = !stateRef.current.savedClips[id];
    dispatch({ type: "save", id });
    try {
      await write(() => setSave(id, on));
      if (on) pushToast("Saved to your profile");
    } catch (error) {
      dispatch({ type: "save", id });
      pushToast(error.message);
    }
  };

  const toggleFollow = async (id) => {
    if (!id || id === stateRef.current.profile?.id) return;
    const on = !stateRef.current.following[id];
    dispatch({ type: "follow", id });
    try {
      await write(() => setFollow(id, on));
    } catch (error) {
      dispatch({ type: "follow", id });
      pushToast(error.message);
    }
  };

  const addComment = async (clipId, text) => {
    const clean = text.trim().slice(0, 180);
    if (!clean) return false;
    try {
      const row = await write(() => insertComment(clipId, clean));
      const me = stateRef.current.profile;
      dispatch({
        type: "comment",
        clipId,
        comment: { id: row.id, user: me?.name || "You", avatar: me?.avatar || "", text: clean, at: Date.now() },
      });
      return true;
    } catch (error) {
      pushToast(error.message);
      return false;
    }
  };

  const lineId = async (id) => (pendingLines.current[id] ? pendingLines.current[id] : id);

  const inBag = (productId) =>
    stateRef.current.cart.filter((line) => line.productId === productId).reduce((sum, line) => sum + line.qty, 0);

  const addToCart = async (productId, size, qty = 1, options = {}) => {
    const product = stateRef.current.products.find((item) => item.id === productId);
    if (!product) return false;
    const cleanSize = size || null;
    const addQty = Math.max(1, qty);
    if (product.stock <= 0) {
      pushToast("Sold out");
      return false;
    }
    if (inBag(productId) + addQty > product.stock) {
      pushToast(inBag(productId) > 0 ? `Only ${product.stock} in stock, and your bag already has ${inBag(productId)}` : `Only ${product.stock} available`);
      return Boolean(options.quiet && inBag(productId) > 0);
    }
    const existing = stateRef.current.cart.find((line) => line.productId === productId && line.size === cleanSize);
    try {
      if (existing) {
        const next = existing.qty + addQty;
        dispatch({ type: "set-qty", id: existing.id, qty: next });
        await updateCart(await lineId(existing.id), next);
      } else {
        const temp = uid("line");
        dispatch({ type: "add-cart", id: temp, productId, size: cleanSize, qty: addQty });
        const request = insertCart({ productId, size: cleanSize, qty: addQty });
        pendingLines.current[temp] = request;
        try {
          const id = await request;
          dispatch({ type: "retarget-line", from: temp, to: id });
        } finally {
          delete pendingLines.current[temp];
        }
      }
      if (!options.quiet) pushToast(`${product.name} added to bag`);
      return true;
    } catch (error) {
      pushToast(error.message);
      const fresh = await loadAccount().catch(() => null);
      if (fresh) dispatch({ type: "hydrate", data: { ...stateRef.current, ...fresh, booting: false } });
      return false;
    }
  };

  const changeQty = async (id, delta) => {
    const line = stateRef.current.cart.find((item) => item.id === id);
    if (!line) return;
    const product = stateRef.current.products.find((item) => item.id === line.productId);
    if (delta > 0 && product && inBag(line.productId) + delta > product.stock) {
      pushToast(`Only ${product.stock} available`);
      return;
    }
    const next = line.qty + delta;
    if (next <= 0) dispatch({ type: "drop-line", id });
    else dispatch({ type: "set-qty", id, qty: next });
    try {
      const realId = await lineId(id);
      if (next <= 0) await deleteCart(realId);
      else await updateCart(realId, next);
    } catch (error) {
      if (next <= 0) dispatch({ type: "restore-line", line });
      else dispatch({ type: "set-qty", id, qty: line.qty });
      pushToast(error.message);
    }
  };

  const checkout = async (payload) => {
    if (pending.current) return false;
    if (!payload.lines?.length) return false;
    if (!stateRef.current.addressId) {
      pushToast("Add a delivery address");
      return false;
    }
    if ((payload.spentCoins || 0) > stateRef.current.coins) {
      pushToast("Not enough coins");
      return false;
    }
    pending.current = true;
    try {
      const result = await placeOrder(payload.lines, payload.spentCoins || 0, stateRef.current.addressId, payload.liveId);
      const catalog = await loadCatalog();
      dispatch({ type: "checkout-sync", ...result, catalog });
      return true;
    } catch (error) {
      pushToast(error.message);
      return false;
    } finally {
      pending.current = false;
    }
  };

  const earn = async (kind, amount, label) => {
    if (stateRef.current.earned[kind]) return false;
    try {
      const result = await changeCoins(amount, label, kind);
      dispatch({ type: "wallet-sync", coins: result.coins, kind, entry: result.entry });
      if (result.applied) pushToast(`+${amount} coins · ${label}`);
      return result.applied;
    } catch (error) {
      pushToast(error.message);
      return false;
    }
  };

  const sendGift = async (giftId, creatorId) => {
    const gift = GIFTS.find((item) => item.id === giftId);
    if (!gift) return;
    if (stateRef.current.coins < gift.coins) {
      pushToast("Not enough coins. Earn more in your wallet.");
      return;
    }
    const host = stateRef.current.people.find((person) => person.id === creatorId);
    try {
      const result = await giftCoins(creatorId, gift);
      dispatch({
        type: "wallet-sync",
        coins: result.coins,
        entry: { ...result.entry, label: `Gifted ${gift.name} to ${host?.name || "a host"}` },
        gift: { ...gift, nonce: uid("g"), creatorId, to: host?.name || "a host" },
      });
      closeSheet();
    } catch (error) {
      pushToast(error.message);
    }
  };

  const clipLink = (clipId) => `${window.location.origin}${window.location.pathname}#/feed/${clipId}`;

  const shareTo = async (clipId, userId) => {
    const person = stateRef.current.people.find((item) => item.id === userId);
    try {
      await shareClipWith(userId, clipId);
    } catch (error) {
      pushToast(error.message || "Couldn't send that");
      throw error;
    }
    const applied = stateRef.current.earned.share ? false : await earn("share", 5, "Shared a clip");
    if (!applied) pushToast(`Sent to ${person?.name || "them"}`);
  };

  const share = async (clipId, method = "copy") => {
    const link = clipLink(clipId);
    let done = false;
    if (method === "native" && navigator.share) {
      try {
        await navigator.share({ title: "Speedy", text: "Check this out on Speedy", url: link });
        done = true;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    if (!done && !(await copyText(link))) return { manual: link };
    closeSheet();
    const applied = stateRef.current.earned.share ? false : await earn("share", 5, "Shared a clip");
    if (!applied) pushToast(done ? "Shared" : "Link copied");
  };

  const markRead = async (id) => {
    dispatch({ type: "read", id });
    try {
      await markNoteRead(id);
    } catch (error) {
      pushToast(error.message);
    }
  };

  const setAddress = async (id) => {
    dispatch({ type: "address", id });
    try {
      await saveSelectedAddress(id);
    } catch (error) {
      pushToast(error.message);
    }
  };

  const addAddress = async (label, line) => {
    const cleanLabel = (label.trim() || "Home").slice(0, 40);
    const cleanLine = line.trim().slice(0, 160);
    if (!cleanLine) {
      pushToast("Enter your street address");
      return null;
    }
    try {
      const address = await insertAddress(cleanLabel, cleanLine, true);
      if (stateRef.current.addresses.length > 0) await saveSelectedAddress(address.id).catch(() => {});
      dispatch({ type: "add-address", address });
      return address;
    } catch (error) {
      pushToast(error.message);
      return null;
    }
  };

  const saveProfile = async (patch) => {
    try {
      const profile = await updateProfile(patch);
      dispatch({ type: "patch-profile", profile: { ...profile, followers: stateRef.current.profile?.followers || 0 } });
      pushToast("Profile saved");
      return true;
    } catch (error) {
      pushToast(error.message);
      return false;
    }
  };

  const publishProduct = async (input) => {
    const id = await createProduct(input);
    await refreshCatalog();
    pushToast("Your product is live in the shop");
    return id;
  };

  const publishClip = async (input) => {
    const id = await createClip(input);
    await refreshCatalog();
    pushToast("Posted");
    return id;
  };

  const removeClip = async (id) => {
    try {
      await deleteClip(id);
      dispatch({ type: "remove-clip", id });
      closeSheet();
      pushToast("Post deleted");
      return true;
    } catch (error) {
      pushToast(error.message);
      return false;
    }
  };

  const removeProduct = async (id) => {
    try {
      await deleteProduct(id);
      dispatch({ type: "remove-product", id });
      pushToast("Listing removed");
      return true;
    } catch (error) {
      pushToast(error.message);
      return false;
    }
  };

  const publishLive = async (input) => {
    const id = await createLive(input);
    await refreshCatalog();
    return id;
  };

  const stopLive = async (id) => {
    await endLive(id);
    dispatch({ type: "end-live", id });
  };

  const dropLive = (id) => dispatch({ type: "end-live", id });

  const setViewers = (id, count) => dispatch({ type: "viewers", id, count });

  const dismissFlash = (view, param = null) => {
    dispatch({ type: "clear-flash" });
    if (view) go(view, param, { replace: true });
  };

  const skipBoot = () => dispatch({ type: "boot" });
  const signOut = () => {
    window.history.replaceState({ depth: 0 }, "", "#/feed");
    onSignOut?.();
  };

  const value = useMemo(() => {
    const person = (id) => state.people.find((item) => item.id === id) || null;
    const product = (id) => state.products.find((item) => item.id === id) || null;
    const live = (id) => state.lives.find((item) => item.id === id) || null;
    return {
      state,
      person,
      product,
      live,
      isLive: (id) => state.lives.some((item) => item.creatorId === id),
      liveFor: (id) => state.lives.find((item) => item.creatorId === id) || null,
      go,
      back,
      tab,
      refresh,
      refreshCatalog,
      openSheet,
      closeSheet,
      toggleLike,
      toggleSave,
      toggleFollow,
      addComment,
      addToCart,
      changeQty,
      checkout,
      sendGift,
      share,
      shareTo,
      earn,
      markRead,
      setAddress,
      addAddress,
      saveProfile,
      publishProduct,
      publishClip,
      removeClip,
      removeProduct,
      publishLive,
      stopLive,
      dropLive,
      setViewers,
      dismissFlash,
      skipBoot,
      signOut,
      pushToast,
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
