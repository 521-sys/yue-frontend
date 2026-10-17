import { AuthFlow } from "./auth/AuthFlow";
import { Sheet } from "./Sheet";

export function AuthSheet({ onClose }: { onClose: () => void }) {
  return <Sheet title="账号登录" onClose={onClose}><AuthFlow onAuthenticated={onClose}/></Sheet>;
}
