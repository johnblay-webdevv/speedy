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

export function AuthScreen() {
  const { recovery, setRecovery } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (recovery) {
        if (nextPassword.length < 6) throw new Error("Use at least 6 characters");
        const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
        if (updateError) throw updateError;
        setRecovery(false);
        setInfo("Password updated.");
        return;
      }
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setInfo("Reset link sent. Open it on this device, then choose a new password.");
        return;
      }
      if (mode === "signup") {
        const displayName = name.trim();
        const nextHandle = cleanHandle(handle);
        if (displayName.length < 1) throw new Error("Add your name");
        if (!/^[a-z0-9_]{3,20}$/.test(nextHandle)) {
          throw new Error("Handle must be 3 to 20 letters, numbers, or underscores");
        }
        if (password.length < 6) throw new Error("Use at least 6 characters");
        const open = await handleAvailable(nextHandle);
        if (!open) throw new Error("That handle is taken");
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName, handle: nextHandle } },
        });
        if (signError) throw signError;
        if (!data.session) {
          setInfo("Account created. Confirm the email, then log in. You can turn off Confirm email in Supabase if you want to skip that.");
        }
        return;
      }
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const title = recovery ? "New password" : mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Log in";

  return (
    <div className="auth">
      <Brand />
      <h2>{title}</h2>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && !recovery && (
          <>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={40} required />
            </label>
            <label>
              Handle
              <input
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                autoComplete="username"
                maxLength={20}
                placeholder="yourname"
                required
              />
            </label>
          </>
        )}
        {!recovery && (
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}
        {mode !== "forgot" && !recovery && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
        )}
        {recovery && (
          <label>
            New password
            <input
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
        )}
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="note">{info}</p>}
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Please wait" : title}
        </button>
      </form>
      {!recovery && mode === "login" && (
        <p className="auth-switch">
          <button type="button" onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}>
            Forgot password
          </button>
        </p>
      )}
      {!recovery && (
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
              setInfo("");
            }}
          >
            {mode === "signup" ? "Log in" : "Create account"}
          </button>
        </p>
      )}
      {mode === "login" && !recovery && <InstallButton />}
    </div>
  );
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
