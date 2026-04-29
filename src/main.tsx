import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";  // ✅ ADD THIS
import App from "./App.tsx";
import "./index.css";

console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL);

createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <App />
  </HashRouter>
);