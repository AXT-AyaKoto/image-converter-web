import { render } from "preact";
import { App } from "./app.tsx";
import "./style.css";

const root = document.querySelector("#app");
if (!root) throw new Error("#app was not found");
render(<App />, root);
