import React from "react";
import ReactDOM from "react-dom/client";
import Portal from "./Portal";
import "./styles.css";
import { CommunityProvider } from "./phase2/store";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CommunityProvider>
      <Portal />
    </CommunityProvider>
  </React.StrictMode>,
);
