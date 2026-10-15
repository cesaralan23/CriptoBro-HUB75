import React, { createContext, useContext, useRef, useState } from "react";
import { Device, Settings, Quote, defaults, demoQuotes } from "./model";
import { apply, SerialQueue } from "./api";
type Session = {
  device: Device | null;
  token: string;
  settings: Settings;
  quotes: Quote[];
  demo: boolean;
  open: (d: Device | null, t: string, s: Settings, q: Quote[]) => void;
  setSettings: (s: Settings) => void;
  setQuotes: (q: Quote[]) => void;
  send: (s: Settings, save?: boolean) => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<Device | null>(null),
    [token, setToken] = useState(""),
    [settings, setSettings] = useState(defaults),
    [quotes, setQuotes] = useState(demoQuotes);
  const queue = useRef(new SerialQueue());
  function open(d: Device | null, t: string, s: Settings, q: Quote[]) {
    setDevice(d);
    setToken(t);
    setSettings(s);
    setQuotes(q);
  }
  async function send(s: Settings, save = false) {
    if (!device) return;
    const d = device,
      t = token;
    await queue.current.run(async () => {
      await apply(d.address, t, s, save);
    });
  }
  return (
    <Context.Provider
      value={{
        device,
        token,
        settings,
        quotes,
        demo: !device,
        open,
        setSettings,
        setQuotes,
        send,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const s = useContext(Context);
  if (!s) throw new Error("Missing session");
  return s;
}
