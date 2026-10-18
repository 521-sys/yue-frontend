# Profile Account Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old “我的” settings UI with the approved C/C3 account center, add an F2 scene-favorites flow, hide unready SMS login, and safely deploy the verified frontend to the existing production server.

**Architecture:** Keep `App` as the owner of top-level tab navigation, give `ProfileScreen` its own profile/favorites subview, and let `SceneDialogueScreen` consume a requested official scene ID. Add small focused modules for feature flags and observable sync status; extend the existing scene API mapper for authenticated favorites instead of duplicating scene models.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest, Testing Library, Tailwind CSS utility classes, existing Spring Boot scene APIs, Nginx static hosting.

**Spec:** `docs/superpowers/specs/2026-10-18-profile-account-center-design.md`

## Global Constraints

- The production UI must not expose SMS login unless `VITE_SMS_LOGIN_ENABLED=true`; this rollout leaves it disabled.
- Remove the complete “基础设置” UI, including daily goal and reset progress, but keep the stored `dailyGoal` field for compatibility.
- Favorites cover official scene dialogues only; do not add AI-voice or movie favorites.
- “关于与帮助” is out of scope.
- Work only in the isolated `feat/profile-account-center` worktree; do not include the original checkout’s uncommitted voice files or `dist.tgz`.
- Do not change the production database schema, SMS configuration, backend JAR, admin site, or ASR budget during this rollout; reversible temporary acceptance rows must be removed before completion.

## Review Focus

- SMS-disabled builds must omit the SMS tab from both visible UI and the accessibility tree; Task 1 pins this.
- A late profile or favorites response after logout/unmount must not restore authenticated UI or stale data; Tasks 3 and 4 pin this.
- A failed unfavorite request must leave the item visible and actionable; Task 3 pins this.
- Opening the same favorite twice across separate visits must still navigate and reload current scene data; Task 5 pins request consumption and reset.
- Sync failures must not block local learning or claim success, while logout must clear the displayed status; Task 2 pins this.

---

### Task 1: SMS Feature Flag and Minimal Logged-Out Login

**Files:**
- Create: `src/lib/feature-flags.ts`
- Modify: `src/components/auth/LoginPanel.tsx`
- Modify: `src/screens/ProfileScreen.tsx`
- Modify: `src/__tests__/profile-auth.test.tsx`

**Interfaces:**
- Produces: `SMS_LOGIN_ENABLED: boolean` from `import.meta.env.VITE_SMS_LOGIN_ENABLED === "true"`.
- Preserves: `AuthFlow({ onAuthenticated })` and the current password/registration APIs.

- [ ] **Step 1: Write failing logged-out UI tests**

Add assertions that the page shows the C-layout heading/copy, password fields, and quick registration; that the SMS tab is absent with the default environment; and that “基础设置”, “每日学习目标”, and “重置学习进度” are absent.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/__tests__/profile-auth.test.tsx`

Expected: FAIL because the existing login panel still renders the SMS tab and the approved C copy/layout is absent.

- [ ] **Step 3: Add the feature flag and implement the minimal C logged-out layout**

Create `SMS_LOGIN_ENABLED`; render the tab selector and SMS form only when true. Redesign only presentation and keep password validation, password visibility, Enter submission, and quick registration behavior unchanged. Remove unused settings imports from `ProfileScreen` only when the logged-in redesign lands in Task 4.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/__tests__/profile-auth.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feature-flags.ts src/components/auth/LoginPanel.tsx src/screens/ProfileScreen.tsx src/__tests__/profile-auth.test.tsx
git commit -m "feat: add minimal profile login"
```

### Task 2: Observable Cloud Sync Status

**Files:**
- Create: `src/lib/sync-status.ts`
- Create: `src/__tests__/sync-status.test.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/__tests__/store.test.ts`

**Interfaces:**
- Produces: `type SyncStatus = "idle" | "syncing" | "synced" | "error"`.
- Produces: `getSyncStatus(): SyncStatus`, `subscribeSyncStatus(listener): () => void`, `useSyncStatus(): SyncStatus`, `setSyncStatus(status): void`, `clearSyncStatus(): void`.
- Consumes: existing `fetchState`, `pushState`, debounced `scheduleUpload`, and `logout` flows.

- [ ] **Step 1: Write failing sync-status tests**

Test state subscription and deduplication, local-save transition to `syncing`, successful upload to `synced`, rejected upload to `error` without reverting local state, login fetch success/failure, and logout cancelling a pending upload and resetting to `idle`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/__tests__/sync-status.test.ts src/__tests__/store.test.ts`

Expected: FAIL because the sync-status module and observable transitions do not exist.

- [ ] **Step 3: Implement the status module and wire real request outcomes**

Keep the 1.5-second debounce. Set `syncing` when a logged-in save schedules an upload, `synced` only after successful pull/push, and `error` on rejection. `logout()` cancels the pending upload timer and clears display state; local learning data remains intact.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/__tests__/sync-status.test.ts src/__tests__/store.test.ts`

Expected: all focused tests PASS with fake timers drained.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-status.ts src/lib/store.ts src/__tests__/sync-status.test.ts src/__tests__/store.test.ts
git commit -m "feat: expose learning sync status"
```

### Task 3: Authenticated Favorites Data and F2 View

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/scene-api.ts`
- Create: `src/components/profile/FavoritesView.tsx`
- Modify: `src/__tests__/scene-api.test.ts`
- Create: `src/__tests__/profile-favorites.test.tsx`

**Interfaces:**
- Produces: `listFavoriteScenes(): Promise<Dialogue[]>`.
- Produces: `unfavoriteScene(id: number): Promise<void>`; rejects invalid IDs before fetch.
- Produces: `FavoritesView({ onBack, onOpenScene }: { onBack: () => void; onOpenScene: (id: number) => void })`.
- Consumes: exported authenticated request helper from `src/lib/api.ts` so 401 keeps the existing token-clear behavior.

- [ ] **Step 1: Write failing API tests**

Assert `GET /api/scenes/favorites` uses the bearer token and the existing scene mapper, DELETE targets `/api/scenes/7/favorite`, invalid IDs do not fetch, and server errors preserve the API message.

- [ ] **Step 2: Run API tests and verify RED**

Run: `npm test -- src/__tests__/scene-api.test.ts`

Expected: FAIL because the favorite functions do not exist.

- [ ] **Step 3: Implement the focused favorites API**

Export the existing authenticated request helper without changing its 401 behavior. Reuse `mapScene` for favorite results; do not introduce a second scene DTO.

- [ ] **Step 4: Verify API tests GREEN**

Run: `npm test -- src/__tests__/scene-api.test.ts`

Expected: all scene API tests PASS.

- [ ] **Step 5: Write failing F2 view tests**

Cover loading, three mapped items, empty guidance, failed load plus retry, row click calling `onOpenScene(7)`, heart click cancelling propagation, successful removal, failed removal keeping the item, and a late response after unmount causing no state update warning.

- [ ] **Step 6: Run view tests and verify RED**

Run: `npm test -- src/__tests__/profile-favorites.test.tsx`

Expected: FAIL because `FavoritesView` does not exist.

- [ ] **Step 7: Implement `FavoritesView`**

Use the approved compact F2 list. Disable only the item whose removal is pending, retain it on error, and use an effect cancellation guard for stale loads.

- [ ] **Step 8: Verify view tests GREEN**

Run: `npm test -- src/__tests__/profile-favorites.test.tsx`

Expected: all favorites view tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/api.ts src/lib/scene-api.ts src/components/profile/FavoritesView.tsx src/__tests__/scene-api.test.ts src/__tests__/profile-favorites.test.tsx
git commit -m "feat: add scene favorites view"
```

### Task 4: C3 Logged-In Account Center

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`
- Modify: `src/__tests__/profile-auth.test.tsx`

**Interfaces:**
- Produces: `ProfileScreen({ onOpenScene }: { onOpenScene?: (id: number) => void })`.
- Consumes: `useSyncStatus`, `FavoritesView`, existing profile get/update methods, and existing auth-change event.

- [ ] **Step 1: Write failing authenticated profile tests**

Seed a valid token and mock profile data. Assert C3 profile content, edit action, exact sync labels for all states, favorites navigation/back, and logout. Assert all legacy settings remain absent. Resolve `getProfile` after logout/unmount and assert it does not restore the old user.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/__tests__/profile-auth.test.tsx`

Expected: FAIL because the current logged-in card still renders legacy settings and has no favorites subview or sync row.

- [ ] **Step 3: Implement the C3 account center**

Remove settings/reset imports and markup. Add the approved compact profile card, read-only sync row, favorites row, bottom logout action, and internal profile/favorites view state. Guard asynchronous profile updates after auth changes and unmount.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/__tests__/profile-auth.test.tsx src/__tests__/profile-favorites.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProfileScreen.tsx src/__tests__/profile-auth.test.tsx
git commit -m "feat: redesign profile account center"
```

### Task 5: Favorite-to-Scene Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/SceneDialogueScreen.tsx`
- Modify: `src/__tests__/App.system.test.tsx`
- Modify: `src/__tests__/scene-publishing.test.tsx`

**Interfaces:**
- Produces: `SceneDialogueScreen({ requestedSceneId, onRequestHandled }: { requestedSceneId?: number | null; onRequestHandled?: () => void })`.
- Consumes: `ProfileScreen.onOpenScene(id)` and existing `getPublishedScene(id)`.

- [ ] **Step 1: Write failing navigation tests**

Test that a favorite callback switches `App` to the scene tab, loads the requested ID, shows its detail, calls `onRequestHandled`, and can open the same ID again after returning to profile. Test a missing/offline scene falls back to the scene list with the existing error.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/__tests__/App.system.test.tsx src/__tests__/scene-publishing.test.tsx`

Expected: FAIL because neither component accepts the navigation contract.

- [ ] **Step 3: Implement request-based navigation**

`App` stores `requestedSceneId`, switches to `scene`, and clears the request only after `SceneDialogueScreen` consumes it. The scene screen fetches the official detail directly and reuses its existing error/list behavior.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/__tests__/App.system.test.tsx src/__tests__/scene-publishing.test.tsx`

Expected: all navigation tests PASS, including repeated same-ID navigation.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/screens/SceneDialogueScreen.tsx src/__tests__/App.system.test.tsx src/__tests__/scene-publishing.test.tsx
git commit -m "feat: open favorite scenes from profile"
```

### Task 6: Full Verification, Production Rollout, and Workspace Report

**Files:**
- Modify: `docs/VERSION_HISTORY.md`
- Modify outside repository after successful deployment: `../项目现状总结.md`
- Create outside repository: timestamped release staging and redacted acceptance record.

**Interfaces:**
- Consumes: the complete branch from Tasks 1–5.
- Produces: verified production static bundle, rollback backup path, exact deployed artifact SHA-256, pushed branch SHA, and a report on the original checkout’s uncommitted files.

- [ ] **Step 1: Run repository verification**

Run: `npm test`

Expected: all baseline and newly added test files PASS with no failed suites.

Run: `npm run build`

Expected: Vite production build exits 0 and emits `dist/index.html` plus hashed assets.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 2: Inspect the built login contract**

Verify the production bundle contains password login/registration behavior and does not render the SMS tab when `VITE_SMS_LOGIN_ENABLED` is unset. Record the bundle SHA-256 without copying secrets.

- [ ] **Step 3: Perform mobile-size browser acceptance before production**

Exercise logged-out C login, registration/back, C3 with a local mocked authenticated session, profile edit, sync states, F2 load/empty/error/removal, and favorite-to-scene navigation. Confirm no console errors.

- [ ] **Step 4: Update repository release history and commit**

Document the feature scope, tests, SMS-disabled boundary, and production target in `docs/VERSION_HISTORY.md`; rerun `git diff --check`; commit as `docs: record profile account center`.

- [ ] **Step 5: Stage and hash the release**

Archive `dist` into a timestamped directory under root `release-staging`, generate SHA-256, verify the archive can be listed, and ensure no `.env`, credential, source map, or unrelated `dist.tgz` is included.

- [ ] **Step 6: Run production preflight**

Read-only checks: trusted SSH host, free disk, active Nginx/backend/MySQL, `nginx -t`, `/var/www/yue`, current root/admin/public-scene/audio responses, and unauthenticated `/api/scenes/favorites` returning 401. Stop on any mismatch.

- [ ] **Step 7: Back up and atomically deploy only the user site**

Create a timestamped `/opt/yue/release-backup-*` copy of `/var/www/yue`; upload to a staging directory; verify remote SHA-256; extract to a new directory; switch `/var/www/yue` with an automatic rollback trap. Do not touch `/var/www/yue-admin`, `/opt/yue/app.jar`, database schema, SMS variables, or ASR files.

- [ ] **Step 8: Run production acceptance and clean temporary data**

Verify static assets, password login/registration UI, public scenes, admin site, official audio, and protected favorites 401 gate. For authenticated favorites, create a uniquely named temporary user, favorite then unfavorite one published scene, verify navigation payloads, and transactionally delete only that exact temporary user’s learning/favorite/user rows after confirming identifiers; retain the pre-deploy backup and redact credentials from logs. Roll back static files on a frontend gate failure.

- [ ] **Step 9: Push and verify remote SHA**

Push `feat/profile-account-center` without force. Compare `git rev-parse HEAD` with `git ls-remote --heads origin feat/profile-account-center`; they must match exactly.

- [ ] **Step 10: Update workspace status and report preserved dirty work**

Update root `项目现状总结.md` with the date, deployed bundle/backup, verification, branch SHA, SMS-disabled boundary, and untouched original checkout status. Inspect but do not modify the original dirty files; explain each file’s function, completion evidence, risks, and recommended next action to the user.
