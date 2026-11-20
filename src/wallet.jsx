import { useState } from "react";
import { COIN_PACKS, GIFTS, TASKS } from "./config";
import { coinLabel, cx, moneyExact, timeAgo } from "./format";
import { CoinMark } from "./icons";
import { useStore } from "./store";
import { Header } from "./ui";

const MAIN_PACKS = new Set([10, 30, 60, 139, 210, 350, 490, 630, 3080, 5250, 7000, 11900, 17500]);

export function Wallet() {
  const { state, go, openSheet, earn, pushToast } = useStore();
  const [showAll, setShowAll] = useState(false);
  const packs = showAll ? COIN_PACKS : COIN_PACKS.filter((pack) => MAIN_PACKS.has(pack.coins));

  const onTask = (task) => {
    if (state.earned[task.id]) return;
    if (task.id === "checkin") earn("checkin", task.coins, "Daily check-in");
    if (task.id === "watch") {
      const first = state.lives.find((live) => live.creatorId !== state.profile?.id);
      if (first) go("room", first.id);
      else {
        go("live");
        pushToast("Nobody else is live right now. Check back soon.");
      }
    }
    if (task.id === "share") {
      go("feed");
      pushToast("Tap Share on any post");
    }
    if (task.id === "order") go("shop");
  };

  return (
    <section className="page sub">
      <Header title="Wallet" fallback="profile" />
      <section className="balance-card">
        <span className="row gap">
          <CoinMark size={22} />
          <span className="note">Speedy Coins</span>
        </span>
        <strong className="num">{coinLabel(state.coins)}</strong>
        <div className="gift-strip" aria-hidden="true">
          {GIFTS.map((gift) => (
            <span key={gift.id}>{gift.mark}</span>
          ))}
        </div>
        <p>Buy a gift pack, then send it during a LIVE.</p>
      </section>

      <div className="section">
        <h2>Buy coins</h2>
      </div>
      <div className="pack-grid">
        {packs.map((pack) => {
          const gift = GIFTS.find((item) => item.coins === pack.coins);
          return (
            <button type="button" key={pack.coins} className="coin-pack" onClick={() => openSheet({ type: "buy-coins", coins: pack.coins })}>
              <span className="gift-avatar">{gift?.mark}</span>
              <b>{gift?.name}</b>
              <span className="gift-cost">
                <CoinMark size={12} /> {coinLabel(pack.coins)}
              </span>
              <strong>{moneyExact(pack.price)}</strong>
            </button>
          );
        })}
      </div>
      <button type="button" className="text-link pack-more" onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Show fewer" : `See all ${COIN_PACKS.length} options`}
      </button>
      <p className="note pack-note">Tap a pack, check the price, then pay.</p>

      <div className="section">
        <h2>Earn</h2>
      </div>
      <div className="pad-x">
        {TASKS.map((task) => {
          const done = !!state.earned[task.id];
          return (
            <button type="button" key={task.id} className={cx("task", done && "done")} onClick={() => onTask(task)} disabled={done}>
              <span className="grow">
                <b>{task.label}</b>
                <span className="note">{task.detail}</span>
              </span>
              <em>{done ? "Done" : `+${task.coins}`}</em>
            </button>
          );
        })}
      </div>

      <div className="section">
        <h2>Activity</h2>
      </div>
      <div className="pad-x">
        {state.ledger.length === 0 && <p className="note">Coins you earn and spend show up here.</p>}
        {state.ledger.map((entry) => (
          <div className="list-row static" key={entry.id}>
            <CoinMark />
            <span className="grow">
              <b>{entry.label}</b>
              <span className="note">{timeAgo(entry.at)} ago</span>
            </span>
            <b className={entry.delta > 0 ? "up" : "down"}>
              {entry.delta > 0 ? "+" : ""}
              {coinLabel(entry.delta)}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
