## 2024-05-23 - [Accessible Modals]
**Learning:** Modals require `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to be correctly announced by screen readers. Icon-only buttons inside them must have `aria-label`.
**Action:** Always verify modals have these attributes and proper focus management.


## 2025-12-12 - [Native TWA UX]
**Learning:** In Telegram Mini Apps, use `telegramUtils.showToast` instead of `alert()`, and `triggerHaptic` for interactions to mimic native app feel.
**Action:** Replace all browser-native interactions with TWA-native ones during refactoring.
