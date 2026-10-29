import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Fontlar siteyle birlikte kendi sunucundan gelir (Google'a istek gitmez). latin-ext: Türkçe ğ ş İ ı için.
import "@fontsource/poppins/latin-300.css";
import "@fontsource/poppins/latin-ext-300.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-ext-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-ext-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-ext-700.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-ext-700.css";
import "./styles/main.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);