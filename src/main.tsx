console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL);
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
