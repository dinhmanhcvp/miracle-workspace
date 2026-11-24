/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './guide.html', './assets/*.js'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            colors: {
                dark: { 900: '#121212', 800: '#1e1e1e', 700: '#2d2d2d', 600: '#3d3d3d' },
                brand: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
            },
        },
    },
    plugins: [],
};
