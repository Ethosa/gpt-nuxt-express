// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    baseURL: '/gpt-nuxt-express'
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxt/scripts',
    '@nuxtjs/tailwindcss'
  ],

  runtimeConfig: {
    public: {
      apiUrl: 'http://localhost:3003'
    }
  }
})
