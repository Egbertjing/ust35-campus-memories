// GitHub Pages serves the site under /<repo>/, so every public file goes through this helper.
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');
