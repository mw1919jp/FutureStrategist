import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/markdown.css";

// Enable dark mode scope for CSS rules
document.documentElement.classList.add('dark');

createRoot(document.getElementById("root")!).render(<App />);
