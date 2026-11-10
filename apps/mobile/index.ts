import { registerRootComponent } from "expo";

import App from "./src/app";
import { registerHomeReminderTask } from "./src/home-reminder";

registerHomeReminderTask();

registerRootComponent(App);
