import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

const navigation = createNavigation(routing);

export const { Link, redirect, usePathname, getPathname } = navigation;
export type LocaleRouter = ReturnType<typeof navigation.useRouter>;
