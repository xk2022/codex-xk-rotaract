import React from "react";
import ReactDOM from "react-dom/client";
import Portal from "./Portal";
import "./styles.css";
import { CouponProvider } from "./phase4/couponStore";
import { BusinessProvider } from "./phase3/businessStore";
import { CommunityProvider } from "./phase2/store";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CommunityProvider>
      <BusinessProvider><CouponProvider><Portal /></CouponProvider></BusinessProvider>
    </CommunityProvider>
  </React.StrictMode>,
);
