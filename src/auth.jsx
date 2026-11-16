import { createContext, useContext, useEffect, useState } from "react";
import { cleanHandle, handleAvailable } from "./account";
import { logoUrl } from "./config";
import { BoltMark } from "./icons";
import { supabase } from "./supabase";

const Context = createContext(null);

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (ignore) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => {
      ignore = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  return (
    <Context.Provider value={{ ready, configured: Boolean(supabase), session, recovery, setRecovery, signOut }}>
      {children}
    </Context.Provider>
  );
}

export function SetupScreen() {
  return (
    <div className="auth">
      <Brand />
      <h2>Connect Supabase</h2>
      <p className="note">
        Run <b>supabase/schema.sql</b> in the Supabase SQL editor. Then add the project URL and anon key to <b>.env.local</b> and restart the app.
      </p>
      <pre className="env-sample">{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key`}</pre>
      <p className="note">Use the anon key from Project Settings → API. Leave the service role key on the server.</p>
    </div>
  );
}

const LOGIN_STEPS = ["email", "password"];
const SIGNUP_STEPS = ["name", "email", "password"];

export function AuthScreen() {
  const { recovery, setRecovery } = useAuth();
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [switchToLogin, setSwitchToLogin] = useState(false);

  const steps = recovery ? ["password"] : mode === "signup" ? SIGNUP_STEPS : mode === "forgot" ? ["email"] : LOGIN_STEPS;
  const current = steps[Math.min(step, steps.length - 1)];

  const go = (nextMode, nextStep = 0) => {
    setMode(nextMode);
    setStep(nextStep);
    setError("");
    setInfo("");
    setSwitchToLogin(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setSwitchToLogin(false);
    if (current === "name" && name.trim().length < 1) {
      setError("Enter your name");
      return;
    }
    if (current === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email, like name@example.com");
      return;
    }
    if (current === "password" && password.length < 6) {
      setError("Use 6 or more characters");
      return;
    }
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }

    setBusy(true);
    try {
      if (recovery) {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPassword("");
        setRecovery(false);
        return;
      }
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setInfo("Check your email for the reset link.");
        return;
      }
      if (mode === "signup") {
        const handle = await pickHandle(name);
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), handle } },
        });
        if (signError) throw signError;
        if (!data.session) setInfo("Check your email, then log in.");
        return;
      }
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;
    } catch (err) {
      const message = authMessage(err?.message);
      setError(message);
      if (mode === "signup" && /already has an account/.test(message)) setSwitchToLogin(true);
    } finally {
      setBusy(false);
    }
  };

  const title = recovery
    ? "New password"
    : mode === "forgot"
      ? "Reset password"
      : current === "name"
        ? "What's your name?"
        : current === "email"
          ? mode === "signup"
            ? "Your email"
            : "Log in"
          : mode === "signup"
            ? "Create a password"
            : "Enter your password";
  const action = busy
    ? "Please wait"
    : step < steps.length - 1
      ? "Continue"
      : mode === "signup"
        ? "Create account"
        : mode === "forgot"
          ? "Send link"
          : recovery
            ? "Save password"
            : "Log in";

  return (
    <div className="auth">
      <Brand />
      <Progress step={step + 1} total={steps.length} />
      <h2>{title}</h2>
      <form className="auth-form" onSubmit={submit}>
        {current === "name" && (
          <input
            key="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            autoFocus
            maxLength={40}
            placeholder="Name"
            aria-label="Name"
          />
        )}
        {current === "email" && (
          <input
            key="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            placeholder="Email"
            aria-label="Email"
          />
        )}
        {current === "password" && (
          <span className="pw-wrap">
            <input
              key="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" || recovery ? "new-password" : "current-password"}
              autoFocus
              placeholder={mode === "signup" || recovery ? "6+ characters" : "Password"}
              aria-label="Password"
            />
            <button type="button" className="pw-toggle" onClick={() => setShow((value) => !value)}>
              {show ? "Hide" : "Show"}
            </button>
          </span>
        )}
        {current === "password" && mode === "login" && !recovery && email && <p className="note">{email.trim()}</p>}
        {error && <p className="auth-error">{error}</p>}
        {switchToLogin && (
          <button type="button" className="btn ghost block" onClick={() => go("login", 1)}>
            Log in instead
          </button>
        )}
        {info && <p className="note">{info}</p>}
        <button type="submit" className="btn block" disabled={busy}>
          {action}
        </button>
      </form>
      <div className="auth-links">
        {step > 0 && !info && (
          <button type="button" onClick={() => { setStep((value) => value - 1); setError(""); }}>
            Back
          </button>
        )}
        {!recovery && mode === "login" && current === "password" && (
          <button type="button" onClick={() => go("forgot")}>
            Forgot password
          </button>
        )}
        {!recovery && mode !== "forgot" && (
          <button type="button" onClick={() => go(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "I have an account" : "Create account"}
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => go("login")}>
            Back to log in
          </button>
        )}
      </div>
      {mode === "login" && current === "email" && !recovery && <InstallButton />}
    </div>
  );
}

const AUTH_ERRORS = [
  [/invalid login credentials/i, "Wrong email or password. Try again."],
  [/already registered|already been registered|user already exists/i, "That email already has an account."],
  [/email not confirmed/i, "Confirm your email first. Check your inbox for the link."],
  [/rate limit|security purposes|too many/i, "Too many tries. Wait a minute and try again."],
  [/invalid format|unable to validate email/i, "That email doesn't look right."],
  [/weak|password should/i, "Pick a stronger password with 6 or more characters."],
  [/failed to fetch|network/i, "No connection. Check your internet and try again."],
  [/same.*password|different from the old/i, "Use a password you haven't used before."],
];

function authMessage(message = "") {
  const hit = AUTH_ERRORS.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : message || "Something went wrong. Try again.";
}

function Progress({ step, total }) {
  return (
    <div className="auth-progress" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < step ? "on" : ""} />
      ))}
    </div>
  );
}

async function pickHandle(name) {
  const base = cleanHandle(name);
  const stem = (base.length >= 3 ? base : "user").slice(0, 16);
  for (let n = 0; n < 30; n += 1) {
    const handle = n === 0 ? stem : `${stem.slice(0, 16)}${n}`;
    if (await handleAvailable(handle)) return handle;
  }
  throw new Error("Try a different name");
}

function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [help, setHelp] = useState("");
  const installed =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) return null;

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHelp(
      ios
        ? "Tap Share, then Add to Home Screen."
        : "Open the browser menu, then tap Install app or Add to Home screen.",
    );
  };

  return (
    <div className="install-block">
      <button type="button" className="btn ghost block" onClick={install}>
        Add to Home Screen
      </button>
      {help && <p className="note">{help}</p>}
    </div>
  );
}

function Brand() {
  const [ok, setOk] = useState(true);
  return (
    <div className="auth-brand">
      {ok ? <img src={logoUrl} alt="" onError={() => setOk(false)} /> : <BoltMark size={64} />}
      <span className="wordmark">Speedy</span>
    </div>
  );
}
