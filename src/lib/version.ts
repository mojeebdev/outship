// The release the site is running, read from package.json so the label in
// the nav can't fall behind the real version. Server-only: package.json isn't
// shipped to the browser, only this string.
import pkg from "../../package.json";

export const OUTSHIP_VERSION: string = pkg.version;
