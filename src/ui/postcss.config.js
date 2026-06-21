/**
 * PostCSS pipeline: Tailwind v4 + Autoprefixer.
 *
 * Tailwind v4 ships its own PostCSS plugin (`@tailwindcss/postcss`)
 * which replaces the legacy `tailwindcss` PostCSS plugin.
 */
export default {
	plugins: {
		"@tailwindcss/postcss": {},
		autoprefixer: {},
	},
};
