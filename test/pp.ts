import { GLOBAL_PREFIX } from "../src/constant/global-prefix";

/*
 * Prefix path with configured global prefix.
 */
export function pp(url: string): string {
  return `${GLOBAL_PREFIX}${url}`
}

