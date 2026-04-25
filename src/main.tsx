import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force dark-only mode (premium SaaS design)
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
