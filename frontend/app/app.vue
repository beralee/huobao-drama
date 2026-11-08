<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster position="top-right" :duration="3000" :theme="resolvedTheme" />

</template>

<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { useTheme } from '~/composables/useTheme'
const { t } = useI18n()
const { resolvedTheme } = useTheme()
useHead(() => ({ title: t('app.title') }))
</script>

<style>
@import url('./assets/studio.css');

/* === 应用内引导（driver.js）主题覆写 — 跟随设计 token === */
.huobao-tour-popover {
  background: var(--surface-raised) !important;
  color: var(--text-1) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-elevated) !important;
  max-width: 340px;
}
.huobao-tour-popover .driver-popover-title {
  color: var(--text-0) !important;
  font: 700 14px/1.3 var(--font-body) !important;
  letter-spacing: -0.01em;
}
.huobao-tour-popover .driver-popover-description {
  color: var(--text-2) !important;
  font: 400 12.5px/1.65 var(--font-body) !important;
}
.huobao-tour-popover .driver-popover-progress-text {
  color: var(--text-3) !important;
  font-size: 10.5px !important;
}
.huobao-tour-popover .driver-popover-close-btn {
  color: var(--text-3) !important;
}
.huobao-tour-popover .driver-popover-navigation-btns {
  gap: 6px;
}
.huobao-tour-popover .driver-popover-navigation-btns button {
  background: var(--button-bg) !important;
  color: var(--button-text) !important;
  border: none !important;
  border-radius: var(--radius-pill) !important;
  padding: 5px 14px !important;
  font: 600 12px var(--font-body) !important;
  text-shadow: none !important;
  cursor: pointer;
}
.huobao-tour-popover .driver-popover-navigation-btns button.driver-popover-next-btn,
.huobao-tour-popover .driver-popover-navigation-btns button.driver-popover-done-btn {
  background: var(--accent-gradient) !important;
  color: var(--on-accent) !important;
}
.driver-overlay {
  background: var(--scrim) !important;
  backdrop-filter: blur(2px);
}
/* 高亮框描边用品牌橙 */
.driver-active-element .driver-popover-arrow svg path,
.driver-active-element .driver-popover-arrow svg polygon {
  fill: var(--accent) !important;
}
</style>
