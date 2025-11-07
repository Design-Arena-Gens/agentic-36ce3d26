/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          primary: '#00d4ff',
          secondary: '#0096ff',
          dark: '#001220',
          darker: '#000810',
        }
      }
    },
  },
  plugins: [],
}
