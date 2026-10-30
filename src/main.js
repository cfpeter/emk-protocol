import { startUI } from "./lib/ui.js";

startUI();
const pages = {
  index: () => import("./pages/home.js"),
  series: () => import("./pages/series.js"),
  protocol: () => import("./pages/protocol.js"),
  minds: () => import("./pages/minds.js"),
  lookbook: () => import("./pages/lookbook.js"),
  order: () => import("./pages/order.js"),
  404: () => import("./pages/lost.js"),
};
pages[document.body.dataset.page]?.().then((m) => m.default?.()).catch((e) => console.error(e));
