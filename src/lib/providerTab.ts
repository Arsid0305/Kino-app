// Кнопка выбора провайдера. Выбранная — как .chip.active из дизайн-системы
// (kino-design-system/kino-app/preview/component-chips.html): янтарная рамка и фон.
// Прежний bg-card на тёмном фоне почти не отличался от невыбранной.
export const providerTabClass = (active: boolean) =>
  `flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
    active
      ? 'border-primary bg-primary/15 text-primary shadow-[0_0_30px_-5px_hsl(var(--primary)/0.2)]'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`;
