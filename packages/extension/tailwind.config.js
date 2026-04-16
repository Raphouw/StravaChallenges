/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{ts,tsx,html}",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        strava: {
          orange: '#FC4C02',
          dark: '#1f2937',
        },
      },
      width: {
        'popup': '400px',
      },
      height: {
        'popup': '560px',
      },
    },
  },
  plugins: [],
}
