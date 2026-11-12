import { TASKS } from "./config";
import { coinLabel, cx, moneyExact, timeAgo } from "./format";
import { CoinMark } from "./icons";
import { useStore } from "./store";
import { Header } from "./ui";

export function Wallet() {
  const { state, go, openSheet, earn, pushToast } = useStore();

  const onTask = (task) => {
    if (state.earned[task.id]) return;
    if (task.id === "checkin") earn("checkin", task.coins, "Daily check-in");
    if (task.id === "watch") {
      go("live");
      pushToast("Open a live and stay a few seconds");
    }
    if (task.id === "share") {
      go("feed");
      pushToast("Tap share on any clip");
    }
    if (task.id === "order") go("shop");
  };

  return (
    <section className="page sub">
      <Header title="Coins" />
      <section className="balance-card">
        <span className="row gap">
          <CoinMark size={22} />
          <span className="note">Speedy Coins</span>
        </span>
        <strong className="num">{coinLabel(state.coins)}</strong>
        <p>100 coins = $1 at checkout, up to 30% of the bag.</p>
      </section>

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
        {state.ledger.map((entry) => (
          <div className="list-row static" key={entry.id}>
            <CoinMark />
            <span className="grow">
              <b>{entry.label}</b>
              <span className="note">{timeAgo(entry.at)}</span>
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
