import { supabase } from "./supabase";

function fail(error) {
  if (error) throw new Error(error.message || "Request failed");
}

function stamp(value) {
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : Date.now();
}

export function cleanHandle(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function studioFrom(sales) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayStart = start.getTime();
  const weekStart = todayStart - 6 * 86400000;
  const week = [0, 0, 0, 0, 0, 0, 0];
  let today = 0;
  let orders = 0;
  sales.forEach((sale) => {
    if (sale.at >= todayStart) {
      today += sale.amount;
      orders += 1;
    }
    if (sale.at >= weekStart) {
      const day = Math.floor((sale.at - weekStart) / 86400000);
      if (day >= 0 && day < 7) week[day] += sale.amount;
    }
  });
  return { today, orders, week, recent: sales.slice(0, 12) };
}

function normalizeCatalog(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const people = (Array.isArray(data.people) ? data.people : []).map((person) => ({
    id: person.id,
    name: person.name || "Member",
    handle: person.handle || "member",
    bio: person.bio || "",
    avatar: person.avatar || "",
    followers: Number(person.followers) || 0,
    verified: false,
  }));
  const names = Object.fromEntries(people.map((person) => [person.id, person.name]));
  const products = (Array.isArray(data.products) ? data.products : []).map((product) => ({
    id: product.id,
    creatorId: product.creatorId,
    name: product.name,
    brand: names[product.creatorId] || "",
    price: Number(product.price) || 0,
    was: product.was == null ? null : Number(product.was),
    sold: Number(product.sold) || 0,
    rating: 0,
    reviews: 0,
    stock: Number(product.stock) || 0,
    category: product.category,
    flash: Boolean(product.flash),
    sizes: Array.isArray(product.sizes) && product.sizes.length ? product.sizes : null,
    image: product.image,
    description: product.description || "",
  }));
  const clips = (Array.isArray(data.clips) ? data.clips : []).map((clip) => ({
    id: clip.id,
    creatorId: clip.creatorId,
    productId: clip.productId || null,
    caption: clip.caption || "",
    tags: [],
    audio: "",
    image: clip.image,
    focus: "center",
    word: "",
    gradient: "#070708",
    tint: "transparent",
    likes: Number(clip.likes) || 0,
    comments: Number(clip.comments) || 0,
    saves: Number(clip.saves) || 0,
    shares: 0,
    thread: [],
  }));
  const lives = (Array.isArray(data.lives) ? data.lives : []).map((live) => ({
    id: live.id,
    creatorId: live.creatorId,
    title: live.title,
    viewers: Number(live.viewers) || 0,
    sold: Number(live.sold) || 0,
    cover: live.cover,
    focus: "center",
    productIds: Array.isArray(live.productIds) ? live.productIds : [],
    gradient: "#070708",
  }));
  return { people, products, clips, lives };
}

function mapOrder(row) {
  return {
    id: row.id,
    status: row.status,
    total: Number(row.total) || 0,
    bonus: Number(row.bonus) || 0,
    at: stamp(row.created_at || row.at),
    items: (row.order_items || row.items || []).map((item) => ({
      productId: item.product_id || item.productId,
      size: item.size || null,
      qty: item.qty,
      price: Number(item.price) || 0,
      name: item.product_name || item.name || "",
    })),
  };
}

export async function uploadMedia(file) {
  if (!file) throw new Error("Choose a photo");
  if (!file.type.startsWith("image/")) throw new Error("Use a photo");
  if (file.size > 5 * 1024 * 1024) throw new Error("Photos need to be under 5 MB");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  fail(authError);
  const user = authData.user;
  if (!user) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  fail(error);
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Upload didn't return a link");
  return data.publicUrl;
}

export async function loadCatalog() {
  const { data, error } = await supabase.rpc("catalog");
  fail(error);
  return normalizeCatalog(data);
}

export async function loadAccount() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  fail(authError);
  const user = authData.user;
  if (!user) throw new Error("Not signed in");

  const [
    profileRes,
    walletRes,
    ledgerRes,
    cartRes,
    ordersRes,
    likesRes,
    savesRes,
    followsRes,
    addressesRes,
    notesRes,
    rewardsRes,
    catalogRes,
    salesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, handle, bio, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("wallets").select("coins").eq("user_id", user.id).maybeSingle(),
    supabase.from("ledger").select("id, label, delta, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
    supabase.from("cart_items").select("id, product_id, size, qty").eq("user_id", user.id),
    supabase
      .from("orders")
      .select("id, total, bonus, status, created_at, order_items(product_id, size, qty, price, product_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("likes").select("clip_id").eq("user_id", user.id),
    supabase.from("saves").select("clip_id").eq("user_id", user.id),
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
    supabase.from("addresses").select("id, label, line, is_default").eq("user_id", user.id).order("created_at"),
    supabase
      .from("notifications")
      .select("id, title, body, view, param, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("rewards").select("kind, claimed_on").eq("user_id", user.id),
    supabase.rpc("catalog"),
    supabase
      .from("order_items")
      .select("id, product_name, price, qty, buyer_name, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  [profileRes, walletRes, ledgerRes, cartRes, ordersRes, likesRes, savesRes, followsRes, addressesRes, notesRes, rewardsRes, catalogRes, salesRes].forEach(
    (result) => fail(result.error),
  );

  if (!profileRes.data) {
    throw new Error("No profile was created. Run supabase/schema.sql in the Supabase SQL editor, then sign up again.");
  }

  const catalog = normalizeCatalog(catalogRes.data);
  const self = catalog.people.find((person) => person.id === user.id);
  const today = new Date().toISOString().slice(0, 10);
  const rewards = rewardsRes.data || [];
  const addresses = (addressesRes.data || []).map((item) => ({ id: item.id, label: item.label, line: item.line }));
  const sales = (salesRes.data || []).map((row) => ({
    id: row.id,
    buyer: row.buyer_name,
    item: row.product_name,
    amount: (Number(row.price) || 0) * (row.qty || 1),
    at: stamp(row.created_at),
  }));

  return {
    profile: {
      id: profileRes.data.id,
      name: profileRes.data.display_name,
      handle: profileRes.data.handle,
      bio: profileRes.data.bio || "",
      avatar: profileRes.data.avatar_url || "",
      followers: self?.followers || 0,
    },
    ...catalog,
    coins: walletRes.data?.coins || 0,
    liked: Object.fromEntries((likesRes.data || []).map((row) => [row.clip_id, true])),
    savedClips: Object.fromEntries((savesRes.data || []).map((row) => [row.clip_id, true])),
    following: Object.fromEntries((followsRes.data || []).map((row) => [row.following_id, true])),
    cart: (cartRes.data || []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      size: row.size || null,
      qty: row.qty,
    })),
    orders: (ordersRes.data || []).map(mapOrder),
    ledger: (ledgerRes.data || []).map((row) => ({
      id: row.id,
      label: row.label,
      delta: row.delta,
      at: stamp(row.created_at),
    })),
    earned: {
      checkin: rewards.some((row) => row.kind === "checkin" && row.claimed_on === today),
      watch: rewards.some((row) => row.kind === "watch"),
      share: rewards.some((row) => row.kind === "share"),
      order: rewards.some((row) => row.kind === "order"),
    },
    addresses,
    addressId: (addressesRes.data || []).find((item) => item.is_default)?.id || addresses[0]?.id || null,
    notes: (notesRes.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      view: row.view,
      param: row.param,
      read: Boolean(row.read_at),
      at: stamp(row.created_at),
    })),
    sales,
    studio: studioFrom(sales),
    comments: {},
  };
}

async function toggleRow(table, column, id, on) {
  if (on) {
    const { error } = await supabase.from(table).insert({ [column]: id });
    fail(error);
    return;
  }
  const { error } = await supabase.from(table).delete().eq(column, id);
  fail(error);
}

export const setLike = (clipId, on) => toggleRow("likes", "clip_id", clipId, on);
export const setSave = (clipId, on) => toggleRow("saves", "clip_id", clipId, on);

export async function setFollow(id, on) {
  if (on) {
    const { error } = await supabase.from("follows").insert({ following_id: id });
    fail(error);
    return;
  }
  const { error } = await supabase.from("follows").delete().eq("following_id", id);
  fail(error);
}

export async function addComment(clipId, body) {
  const { data, error } = await supabase.from("comments").insert({ clip_id: clipId, body }).select("id, body, created_at").single();
  fail(error);
  return data;
}

export async function insertCart({ productId, size, qty }) {
  const { data, error } = await supabase
    .from("cart_items")
    .insert({ product_id: productId, size: size || "", qty })
    .select("id")
    .single();
  fail(error);
  return data.id;
}

export async function updateCart(id, qty) {
  const { error } = await supabase.from("cart_items").update({ qty }).eq("id", id);
  fail(error);
}

export async function deleteCart(id) {
  const { error } = await supabase.from("cart_items").delete().eq("id", id);
  fail(error);
}

export async function placeOrder(lines, spent, addressId, liveId) {
  const { data, error } = await supabase.rpc("place_order", {
    p_lines: lines.map((line) => ({
      product_id: line.productId,
      size: line.size || "",
      qty: line.qty,
    })),
    p_spent: spent,
    p_address_id: addressId,
    p_live_id: liveId || null,
  });
  fail(error);
  return {
    coins: data.coins,
    order: mapOrder({ ...data.order, created_at: data.order.at, items: data.order.items }),
    ledger: (data.ledger || []).map((row) => ({
      id: row.id,
      label: row.label,
      delta: row.delta,
      at: stamp(row.at),
    })),
  };
}

export async function changeCoins(delta, label, kind) {
  const { data, error } = await supabase.rpc("apply_coin_delta", {
    p_delta: delta,
    p_label: label,
    p_kind: kind,
  });
  fail(error);
  return {
    coins: data.coins,
    applied: Boolean(data.applied),
    entry: data.applied ? { id: data.ledger_id, label, delta, at: Date.now() } : null,
  };
}

export async function sendGift(hostId, gift) {
  const { data, error } = await supabase.rpc("send_gift", {
    p_host: hostId,
    p_amount: gift.coins,
    p_name: gift.name,
  });
  fail(error);
  return {
    coins: data.coins,
    entry: { id: crypto.randomUUID(), label: `Gifted ${gift.name}`, delta: -gift.coins, at: Date.now() },
  };
}

export async function addAddress(label, line, makeDefault) {
  const { data, error } = await supabase
    .from("addresses")
    .insert({ label, line, is_default: makeDefault })
    .select("id, label, line")
    .single();
  fail(error);
  return data;
}

export async function selectAddress(id) {
  const clear = await supabase.from("addresses").update({ is_default: false }).neq("id", id);
  fail(clear.error);
  const next = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  fail(next.error);
}

export async function markNoteRead(id) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  fail(error);
}

export async function updateProfile(patch) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  fail(authError);
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", authData.user.id)
    .select("id, display_name, handle, bio, avatar_url")
    .single();
  fail(error);
  return {
    id: data.id,
    name: data.display_name,
    handle: data.handle,
    bio: data.bio || "",
    avatar: data.avatar_url || "",
  };
}

export async function createProduct(input) {
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      description: input.description,
      price: input.price,
      compare_at: input.compareAt,
      stock: input.stock,
      category: input.category,
      flash: input.flash,
      sizes: input.sizes,
      image_url: input.imageUrl,
    })
    .select("id")
    .single();
  fail(error);
  return data.id;
}

export async function createClip(input) {
  const { data, error } = await supabase
    .from("clips")
    .insert({
      caption: input.caption,
      image_url: input.imageUrl,
      product_id: input.productId || null,
    })
    .select("id")
    .single();
  fail(error);
  return data.id;
}

export async function createLive(input) {
  const { data, error } = await supabase
    .from("lives")
    .insert({
      title: input.title,
      cover_url: input.coverUrl,
      product_ids: input.productIds,
    })
    .select("id")
    .single();
  fail(error);
  return data.id;
}

export async function endLive(id) {
  const { error } = await supabase.from("lives").update({ ended_at: new Date().toISOString() }).eq("id", id);
  fail(error);
}

export async function joinLive(id) {
  const { data, error: authError } = await supabase.auth.getUser();
  fail(authError);
  const { error } = await supabase.from("live_viewers").upsert(
    { live_id: id, user_id: data.user.id },
    { onConflict: "live_id,user_id" },
  );
  fail(error);
}

export async function leaveLive(id) {
  const { error } = await supabase.from("live_viewers").delete().eq("live_id", id);
  fail(error);
}

export async function viewerCount(id) {
  const { count, error } = await supabase.from("live_viewers").select("user_id", { count: "exact", head: true }).eq("live_id", id);
  fail(error);
  return count || 0;
}

export async function loadMessages(id) {
  const { data, error } = await supabase
    .from("live_messages")
    .select("id, body, created_at, profiles(display_name)")
    .eq("live_id", id)
    .order("created_at", { ascending: true })
    .limit(40);
  fail(error);
  return (data || []).map((row) => ({
    id: row.id,
    kind: "chat",
    user: row.profiles?.display_name || "Member",
    text: row.body,
  }));
}

export async function sendMessage(id, body) {
  const { error } = await supabase.from("live_messages").insert({ live_id: id, body });
  fail(error);
}

export async function loadComments(clipId) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, profiles(display_name)")
    .eq("clip_id", clipId)
    .order("created_at", { ascending: false })
    .limit(40);
  fail(error);
  return (data || []).map((row) => ({
    id: row.id,
    user: row.profiles?.display_name || "Member",
    text: row.body,
    mine: false,
  }));
}

export async function handleAvailable(handle) {
  const { data, error } = await supabase.rpc("handle_available", { p_handle: handle });
  fail(error);
  return Boolean(data);
}
