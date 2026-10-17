import { useState } from "react";
import { LoginPanel } from "./LoginPanel";
import { RegisterPanel } from "./RegisterPanel";
export function AuthFlow({ onAuthenticated }: { onAuthenticated?: () => void }) { const [view, setView] = useState<"login" | "register">("login"); const [phone, setPhone] = useState(""); return view === "login" ? <LoginPanel phone={phone} onPhoneChange={setPhone} onRegister={() => setView("register")} onAuthenticated={onAuthenticated}/> : <RegisterPanel phone={phone} onPhoneChange={setPhone} onBack={() => setView("login")} onAuthenticated={onAuthenticated}/>; }
