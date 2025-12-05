// @see https://vite.dev/guide/env-and-mode
// Make sure to prefix with VITE_ if you want it to be accessible from the client side
export class AppConfig {
    public static apiUrl = import.meta.env.VITE_API_URL;
    public static isLocal = import.meta.env.VITE_IS_LOCAL === 'true';
}
