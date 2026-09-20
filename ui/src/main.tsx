import {
	markCompanionAppRoot,
	subscribeCompanionTheme,
} from "@ryu/app-host/companion-theme";
import { RyuAppShell } from "@ryu/blocks/companion/app-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./studio.css";

subscribeCompanionTheme();
const root = document.getElementById("root");
if (!root) {
	throw new Error("Studio root element is missing.");
}

markCompanionAppRoot(root, { surface: "standard" });

createRoot(root).render(
	<StrictMode>
		<RyuAppShell>
			<App />
		</RyuAppShell>
	</StrictMode>
);
