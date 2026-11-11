import '@testing-library/jest-dom/vitest'

// jsdom has no scrollTo; the router calls it on navigation
window.scrollTo = () => undefined
