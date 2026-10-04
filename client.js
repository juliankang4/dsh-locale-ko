/** Korean dictionaries per namespace: { "<namespace>": { "<key>": "<Korean text>" } }. */
const dictionaries = {}

window.__ModuleLoader__.load({
  id: 'dsh-locale-ko',
  factory: () => ({
    inject: ['locale'],
    apply(ctx) {
      ctx.effect(() => ctx.locale.addLanguage({ id: 'ko', label: '한국어', fallback: 'en' }), 'dsh-locale-ko: language')
      for (const [ns, dict] of Object.entries(dictionaries)) {
        ctx.effect(() => ctx.locale.register(ns, 'ko', dict), `dsh-locale-ko: ${ns}`)
      }
    },
  }),
})
