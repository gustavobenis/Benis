/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: {
            DEFAULT: '#264027',
            50: '#E8EDE9',
            100: '#D1DBD3',
            200: '#A3B7A7',
            300: '#75937B',
            400: '#476F4F',
            500: '#264027',
            600: '#1E3220',
            700: '#162518',
            800: '#0E1810',
            900: '#060C08',
          },
          orange: {
            DEFAULT: '#F7931E',
            50: '#FEF2E4',
            100: '#FDE4C9',
            200: '#FBC993',
            300: '#FAAE5D',
            400: '#F89327',
            500: '#F7931E',
            600: '#D47908',
            700: '#9E5A06',
            800: '#683B04',
            900: '#321C02',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};