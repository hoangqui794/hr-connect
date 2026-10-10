# GitNexus Engineering Plan

> Task: Redesign the complete Candidate frontend experience into a coherent, friendly, responsive workspace while preserving MF02 business rules and using only production-backed data.
> Evidence verified at commit `dc1de10e7c284161df2a6163bf42b30eb6a5637c`; GitNexus index fresh at the same commit with PDG available (GitNexus 1.6.12).
> Evidence provenance schema 2 is embedded in §11; exact generated plan path excluded from the repository-wide dirty digest.

## 1. Objective

Build one persistent Candidate workspace that feels simple to navigate on desktop and mobile and covers every current Candidate route: dashboard, job discovery and detail, apply, applications, CV management, Affiliate-uploaded CV control, profile, linked-email identity claims, and submission consent.

The redesign must meet these outcomes:

- [verified] A logged-in Candidate stays inside the Candidate shell while browsing jobs, opening a job, applying, and returning to their applications. Public `/jobs` URLs remain available to guests and shared links.
- [verified] The primary navigation reflects four common goals: **Tổng quan**, **Tìm việc**, **Đơn ứng tuyển**, and **Hồ sơ & CV**. Identity recovery and account details move to a secondary account area.
- [verified] All displayed and editable data comes from existing backend APIs. The production UI must not create fake CVs, invent unsupported profile fields, or report success after the backend rejects a save.
- [inferred] Candidate-facing language, hierarchy, empty states, and mobile controls should let a first-time user complete the main flows without knowing internal terms such as `AFFILIATE_UPLOAD`, `PROCESSING`, or identity claim.
- [verified] MF02 rules remain unchanged: exactly one CV source when applying, ownership and reuse constraints, consent before an Affiliate submission advances, and MF03 status visibility without Candidate retry authority.
- [assumed] Implementation will use a new branch named `feature/candidate-ui-redesign`; each independently testable page group will be committed and pushed separately, with no merge to `dev` or `main` until manual approval.

## 2. Current Behaviour

### 2.1 Navigation and routing

- [verified] `CandidateShell` exposes six equal-priority navigation items: dashboard, applications, personal CVs, Affiliate CVs, linked emails, and profile (`HRConnect-FE/src/features/portal/CandidateShell.tsx:37-170`). Its “Tìm việc” action navigates to `/jobs`.
- [verified] `/jobs` and `/jobs/:id` are public routes rendered with `PublicFrame`, while Candidate routes are rendered inside `CandidateShell` (`HRConnect-FE/src/app/router.tsx:80-220`, `HRConnect-FE/src/features/jobs-mf01/PublicJobPages.tsx:39-74`). Therefore the Candidate loses their workspace header and context when they search for work.
- [verified] `getDashboardRouteForRole` and `ROLE_DASHBOARD_ROUTES` route Candidates to `/`, and `LoginPage` separately special-cases Candidate login to `/` (`HRConnect-FE/src/routes/AppRoutes.tsx:307-325`, `HRConnect-FE/src/features/auth/LoginPage.tsx:173-260`). This makes the public landing page the Candidate’s effective home.
- [verified] `JobDiscoveryPage` already accepts `detailBasePath`; cards can point to a Candidate-owned detail route without cloning job-search business logic (`HRConnect-FE/src/features/jobs-mf01/JobDiscoveryPage.tsx`).

### 2.2 Candidate pages

- [verified] `CandidatePages.tsx` combines dashboard, application list, application detail, and personal CV vault in one large module (`HRConnect-FE/src/features/portal/CandidatePages.tsx:115-650`). This makes route-level ownership and incremental testing difficult.
- [verified] The dashboard retrieves real applications and CVs but sends its main CTA to `/jobs`; its hierarchy does not guide the user through profile readiness → job search → application tracking.
- [verified] The application detail page renders raw or weakly explained AI state. Missing scores can appear as a dash even when MF03 is pending, unavailable, or exhausted; Candidates have no manual retry permission.
- [verified] Personal CV management uses real APIs for upload, view, rename, primary selection, and delete. `JobApplyActions` also uses the real Candidate CV vault or one uploaded file and preserves the one-source rule (`HRConnect-FE/src/features/portal/JobApplyActions.tsx`).
- [verified] Affiliate CV list/detail pages already support real download URLs, usage history, reuse permission with concurrency control, and adoption into the Candidate’s personal vault (`HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx`).
- [verified] Linked-email identity recovery has real start, resend, verify, and state-restoration behavior, including `sessionStorage` for an in-progress claim (`HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx`). It is a secondary account/security task but currently appears in the primary navigation.
- [verified] Authenticated and public consent flows are separate. The public flow supports a one-time email token and must continue clearing token material from the visible URL (`HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx`, `HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx`).

### 2.3 Profile correctness gap

- [verified] `CandidateProfilePage` is more than 1,300 lines and mixes API data, local Zustand state, `localStorage`, unsupported profile fields, mock CV-builder modes, and template-created CV objects (`HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx:95-1398`).
- [verified] `handleSaveProfile` updates local state before awaiting the backend. Its backend failure branch continues into local persistence and can still show success. It also writes authentication-shaped local data, including editable email and a fallback password value. This violates backend-as-source-of-truth behavior.
- [verified] Existing backend endpoints support profile read/update, visibility, and Candidate skill CRUD (`HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs`, `HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateSkillEndpoints.cs`). Supported profile fields are `fullName`, `phone`, `dateOfBirth`, `gender`, `currentAddress`, `highestEducation`, `yearsOfExperience`, and `summary`; email must be read-only here and managed through identity flows.

## 3. Relevant Architecture

- [verified] Route registration is split between the router and route-access helpers in `HRConnect-FE/src/app/router.tsx` and `HRConnect-FE/src/routes/AppRoutes.tsx`. Login, generic dashboard redirect, and protected-route behavior consume the role-home helper.
- [graph] GitNexus `impact(target=getDashboardRouteForRole, direction=upstream, maxDepth=3)` found three direct consumers: `LoginPage.handleFormSubmit`, `Dashboard`, and `ProtectedRoute`. All three must be accounted for when changing the Candidate landing route.
- [verified] Public job pages wrap reusable discovery/detail components in `PublicFrame`. Candidate job routes should reuse the inner job components under `CandidateShell`, leaving public guest routes unchanged.
- [verified] MF02 client code already has dedicated API/query modules for applications, personal CVs, Affiliate CVs, consent, and identity. The remaining legacy profile access lives in `candidateService.ts` plus `useCandidateProfile.ts`; it should be brought into the same typed API/query pattern.
- [verified] Candidate presentation currently imports `Surface`, `PageHero`, and related primitives from the admin-console module and uses admin-console CSS. Candidate-specific tokens and composition components should be introduced without changing shared Admin behavior.
- [verified] Vitest/Testing Library coverage exists for personal CVs, application detail, Affiliate CV list/detail, identity, both consent flows, apply actions, and route access. There is no focused test for `CandidateShell`, Candidate dashboard, Candidate applications list, Candidate profile, or Candidate-owned job routes.
- [verified] Available verification scripts are `npm run test:run`, `npm run lint`, and `npm run build` (`HRConnect-FE/package.json`).

## 4. GitNexus Findings

### Primary symbols

1. **`CandidateShell`** — [graph] `context(name=CandidateShell, file_path=HRConnect-FE/src/features/portal/CandidateShell.tsx)` identified the app router as its direct caller. `impact(..., direction=upstream, maxDepth=3)` reports low blast radius: router at depth 1, then app/main bootstrapping.
2. **`router`** — [graph] `query(search_query="Candidate portal navigation job routes", task_context="redesign Candidate UX")` located the route boundary that separates public job search from Candidate workspace routes.
3. **`getDashboardRouteForRole`** — [graph] `context` plus upstream `impact(maxDepth=3)` found the login, dashboard, and protected-route dependents. The change is small but cross-cutting because role entry behavior depends on it.
4. **`CandidateProfilePage`** — [graph] `context(name=CandidateProfilePage)` found dynamic route loading but no statically resolved callers. Targeted source verification therefore carries more weight than caller counts.
5. **`CandidateHomePage`** — [graph] `context(name=CandidateHomePage)` associated it with Candidate applications/CVs and shared presentation components; lazy imports prevented a complete caller resolution, so the route source was verified directly.

### Architecture and process findings

- [graph] `gitnexus://repo/hr-connect/clusters` places Candidate behavior in the high-cohesion Candidates/Portal areas, while public jobs are in the Jobs-MF01 area. The redesign should compose those modules through routes rather than move MF01 business logic into MF02.
- [graph] `gitnexus://repo/hr-connect/processes` shows public job detail as a cross-community flow. Adding a Candidate wrapper is safer than changing the public process for all users.
- [graph] GitNexus impact for `CandidateShell` is low, while role-home routing has three direct consumers. The highest regression risk is routing/redirect behavior, not the shell’s visual CSS.
- [verified] Existing tests cover sensitive MF02 actions. The redesign can keep those actions intact and add presentation/routing tests around them rather than rewrite their business handlers.

## 5. Statement-Level PDG Findings

### `CandidateShell`

- [graph] PDG control dependencies show `menuOpen` guards the mobile overlay and drawer, controls `aria-expanded`, and gates Escape-key registration and cleanup.
- **Constraint:** preserve one source of truth for drawer state, Escape close, overlay click close, route-change close, focus return, and scroll locking. A new mobile bottom navigation can coexist with one account drawer, but must not introduce parallel booleans for the same surface.

### `getDashboardRouteForRole`

- [graph] PDG control flow maps the `CANDIDATE` role branch directly to `/`; other roles map to owned dashboard paths.
- **Constraint:** change the Candidate branch to `/candidate/dashboard`, then update or remove the independent Candidate special-case in `LoginPage`. Tests must verify direct login, generic `/dashboard`, and `ProtectedRoute` fallback resolve consistently.

### `CandidateProfilePage.handleSaveProfile`

- [graph] PDG data flow shows form values reach local Candidate state, the backend update call, local user/auth storage, and success UI. Backend failure is caught inside the save sequence rather than terminating it.
- [verified] Source confirms the catch path continues into local persistence and success feedback.
- **Constraint:** replace the sequence with validate → call API → on success update query cache/auth display data → show success. On error, preserve form values, show the API message, and perform no success mutation. Never store a password or write an editable profile email into auth state.

### Profile CV modes

- [graph] PDG/source flow shows builder, template, and upload modes can construct local `CandidateCV` values without the production CV API.
- **Constraint:** remove the mock CV center from the profile route. Route the user to the real CV Hub and reuse existing upload/business actions. Do not migrate fake local CV objects into server data.

## 6. Proposed Changes

### 6.1 Candidate information architecture and visual system

**Files:** `HRConnect-FE/src/features/portal/CandidateShell.tsx`; new `HRConnect-FE/src/features/portal/candidate/candidate.css`; new focused components under `HRConnect-FE/src/features/portal/candidate/components/`.

- [verified] Replace the six-item primary menu with four task-oriented entries: Tổng quan, Tìm việc, Đơn ứng tuyển, Hồ sơ & CV.
- Move Hồ sơ cá nhân, CV do Affiliate gửi, Email liên kết/khôi phục dữ liệu, and Đăng xuất into an account menu. Preserve direct routes and deep links.
- Add a mobile bottom navigation for the four primary tasks and a single accessible account sheet/drawer. Maintain desktop header, active route state, keyboard focus, Escape handling, `aria-current`, and minimum 44px targets.
- Add Candidate-owned presentation primitives (`CandidatePageHeader`, `CandidateEmptyState`, `CandidateStatusBadge`, `CandidateSection`, skeletons) and Candidate design tokens. Do not change shared admin primitives or other roles.
- Visual direction: HR Connect blue/teal accents, warm neutral backgrounds, clear white surfaces, one primary CTA per page, restrained shadows, high contrast, and plain Vietnamese copy.

### 6.2 Candidate route ownership and entry behavior

**Files/symbols:** `HRConnect-FE/src/app/router.tsx::router`; `HRConnect-FE/src/routes/AppRoutes.tsx::getDashboardRouteForRole`, `ROLE_DASHBOARD_ROUTES`, route access; `HRConnect-FE/src/features/auth/LoginPage.tsx::handleFormSubmit`; `HRConnect-FE/src/features/dashboard/Dashboard.tsx`; route tests.

- Add protected routes `/candidate/jobs` and `/candidate/jobs/:jobId` inside `CandidateShell`.
- Point Candidate login, `/dashboard`, protected fallback, dashboard CTAs, saved-jobs compatibility redirect, and Candidate job links to Candidate-owned routes.
- Keep `/jobs` and `/jobs/:id` public for anonymous browsing and external links.
- Add compatibility redirects only where a current Candidate-only route is replaced; do not break consent email URLs, application details, or Affiliate CV deep links.

### 6.3 Job discovery and job detail inside Candidate workspace

**Files:** new `CandidateJobsPage.tsx` and `CandidateJobDetailPage.tsx` under the Candidate feature; reuse `JobDiscoveryPage`, job detail components, and `JobApplyActions`.

- Render the existing job search with `detailBasePath="/candidate/jobs"` inside the Candidate shell.
- Preserve URL query parameters for search/filter/back navigation. On mobile, present filters in a labelled drawer or sheet and keep active-filter chips visible.
- Render job detail with a clear back-to-results action, readable content hierarchy, service-type eligibility text, and a sticky apply CTA on small screens.
- Keep `JobApplyActions` business behavior intact: real CV vault/upload, one CV source, API errors, duplicate conflict, and successful navigation to the created application.

### 6.4 Candidate dashboard

**File:** split `CandidateHomePage` out of `CandidatePages.tsx` into `CandidateDashboardPage.tsx`.

- Lead with “Tìm việc phù hợp” and “Theo dõi đơn ứng tuyển”, not CV administration.
- Show real profile completeness using only backend-supported profile fields, existence of a primary/active CV, and optional skills. Link missing items to the exact completion page.
- Show compact application counts and recent applications with human-readable statuses.
- Show a small cached list of active jobs from the existing job query as “Việc làm mới”, not “AI đề xuất”. Avoid claiming personalization that the backend does not provide.
- Define complete loading, empty, partial-error, and retry states; one failed widget must not blank the whole dashboard.

### 6.5 Applications list and detail

**Files:** split list/detail from `CandidatePages.tsx`; add `CandidateApplicationsPage.tsx`, `CandidateApplicationDetailPage.tsx`, and shared status/timeline mapping.

- Keep existing filtering but present Candidate-friendly stage tabs and responsive cards/table rather than dense technical filters.
- Map application and AI statuses to Vietnamese labels with explanation:
  - no AI request yet: “Chưa gửi chấm điểm”;
  - `PENDING`: “Đang chờ hệ thống AI”;
  - `PROCESSING`: “AI đang phân tích”;
  - `COMPLETED`: show score/tier when present;
  - `FAILED`: “Chấm điểm chưa thành công” and advise waiting/contacting support.
- Never render a dash as the sole AI explanation. Do not show a Candidate retry button because retry authority is an operational/authorized backend action.
- Keep source attribution, CV link, dates, and application timeline visible without exposing raw enum codes.

### 6.6 Unified CV Hub

**Files:** new `CandidateCvHubPage.tsx`; refactor personal CV section from `CandidatePages.tsx`; retain/refactor `CandidateAffiliateCvsPage.tsx` and its detail route.

- Present two clear sections/tabs: **CV của tôi** and **CV do Affiliate gửi**.
- Personal CVs retain upload, view/download, rename, set primary, delete, file validation, and API error handling.
- Affiliate CVs retain reuse status, job usage history, temporary download URL, concurrency token, revoke/enable reuse, and adopt-to-personal-vault behavior.
- Explain “Adopt” in Vietnamese as “Lưu vào kho CV của tôi”; explain that historical applications remain unchanged if reuse is later revoked.
- Remove all fake profile-page CV builder/template behavior and link profile completion to this real Hub.

### 6.7 Production-safe Candidate profile and skills

**Files:** replace/refactor `HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx`; consolidate `candidateService.ts` and `useCandidateProfile.ts` into typed MF02 profile/skills API and query hooks; add profile tests.

- Organize the page into Thông tin cá nhân, Kinh nghiệm & giới thiệu, Kỹ năng, and Quyền riêng tư.
- Edit only backend-supported fields. Display account email as read-only with a link to Email liên kết/khôi phục dữ liệu.
- Integrate real skill catalog and Candidate skill CRUD endpoints, including proficiency/years only when the contract supports them.
- Integrate real profile visibility and explain its effect.
- Use backend/query cache as the source of truth. No local-only success, fake password, fake profile fields, or local CV creation.
- Warn about unsaved changes on navigation and keep entered data after a failed request.

### 6.8 Identity claim and consent experiences

**Files:** `CandidateIdentityPage.tsx`, `CandidateSubmissionConsentPage.tsx`, `PublicSubmissionConsentPage.tsx`, related tests/styles.

- Move identity claim under Tài khoản & quyền riêng tư and explain it as “Khôi phục hồ sơ đã được Affiliate gửi bằng email khác”. Keep OTP cooldown, resend, concurrency, and post-claim data refresh behavior.
- Authenticated consent stays in CandidateShell and clearly shows Candidate, job, company, Affiliate source, CV preview, expiry, and consequences of Đồng ý/Từ chối.
- Public no-account consent remains a standalone trusted page reached from email. Preserve one-time token handling, URL-fragment cleanup, expiry, and existing security behavior.
- Use consistent success/error/expired states and make destructive “Từ chối” visually secondary but explicit.

### 6.9 Loading, empty, error, accessibility, and responsiveness

- Every route must define skeleton/loading, empty, recoverable error with retry, forbidden/expired where relevant, and success feedback.
- Use semantic headings, labelled form controls, visible focus, keyboard-operable menus/dialogs, screen-reader status announcements, and contrast meeting WCAG AA.
- Verify layouts at 360, 768, 1024, and 1440px. Avoid horizontal table scrolling for core Candidate tasks; switch to cards on small screens.
- Respect reduced motion and avoid animation that delays actions.

## 7. Implementation Sequence

Each step ends with focused tests, one commit, and one push to `feature/candidate-ui-redesign`. The tree must remain runnable after every step.

1. **Foundation: route home + Candidate shell.** Add Candidate-owned job routes, update all three direct role-home consumers, implement primary/account navigation and mobile shell, then add route/shell tests. Commit: `feat(candidate-ui): establish candidate workspace navigation`.
2. **Job discovery and detail.** Wrap existing job discovery/detail under Candidate routes, preserve public routes, query parameters, and apply behavior. Add route and interaction tests. Commit: `feat(candidate-ui): add in-workspace job discovery`.
3. **Dashboard.** Extract the dashboard, add profile/application/CV readiness and bounded job widgets, with independent error states. Commit: `feat(candidate-ui): redesign candidate dashboard`.
4. **Applications.** Extract list/detail, add responsive presentation and explicit AI-state mapping without retry control. Commit: `feat(candidate-ui): improve application tracking`.
5. **CV Hub.** Unify personal and Affiliate CV entry points while retaining all existing business actions and deep links. Commit: `feat(candidate-ui): unify candidate cv management`.
6. **Profile and skills.** Replace the legacy local-first page with API-backed supported fields, visibility, and skill CRUD; remove mock CV modes and unsafe local auth writes. Commit: `feat(candidate-ui): rebuild candidate profile on api data`.
7. **Identity and consent polish.** Reorganize account recovery and align authenticated/public consent visuals without changing token/security rules. Commit: `feat(candidate-ui): clarify identity and consent flows`.
8. **Cross-page accessibility and responsive hardening.** Complete manual viewport/keyboard checks, fix shared state visuals, remove only source-proven obsolete Candidate imports/routes, run the full suite, lint, and build. Commit: `chore(candidate-ui): complete accessibility and regression pass`.

Do not merge `dev` or `main` during implementation. Manual user acceptance follows the final push.

## 8. Test Strategy

### Routing and shell

- Update `HRConnect-FE/src/routes/AppRoutes.test.tsx`: Candidate login destination, `/dashboard` redirect, protected fallback, Candidate job routes, guest public routes, and direct deep-link refresh.
- Add `CandidateShell.test.tsx`: active item, mobile bottom navigation, account drawer, Escape/overlay close, focus return, route-change close, and correct Candidate route preservation.

### Jobs and apply

- Extend `JobApplyActions.test.tsx`: personal CV, uploaded file, both sources rejected, no source/default behavior according to current contract, duplicate conflict, upload failure, and success navigation.
- Add Candidate job-route tests: filter/query persistence, detail path generation, back-to-results, loading/not-found/forbidden, and responsive apply CTA.

### Dashboard and applications

- Add `CandidateDashboardPage.test.tsx`: full data, no CV, incomplete profile, no applications, widget API error, retry, and active-job empty state.
- Add applications-list tests for filters, empty/error/loading, status labels, and mobile rendering.
- Update `CandidateApplicationDetailPage.test.tsx` for null/PENDING/PROCESSING/COMPLETED/FAILED AI states, score/tier presence/absence, and no Candidate retry control.

### CV Hub

- Update `CandidateCvsPage.test.tsx`: upload validation, rename, primary, delete guards, temporary download, API failures, and no fake CV objects.
- Update Affiliate CV list/detail tests for usage history, reuse concurrency conflict, adopt success/failure, revoked state, and preserved Application links.

### Profile and identity

- Add `CandidateProfilePage.test.tsx`: supported field mapping, read-only email, validation, successful save, failed save with no false success/local mutation, visibility, skill add/edit/delete, unsaved-change warning, and CV Hub link.
- Update `CandidateIdentityPage.test.tsx`: plain-language states, claim start/resend/verify, cooldown, concurrency conflict, restored in-progress claim, and post-success refresh.

### Consent

- Update authenticated consent tests for confirm/decline/expired/forbidden and Candidate shell context.
- Preserve and extend public consent tests for URL-fragment token removal, no token leakage, one-time decisions, expiry, retryable network error, and no-account display.

### Verification commands

Run focused Vitest files after each step, then at the final step from `HRConnect-FE`:

```powershell
npm run test:run
npm run lint
npm run build
```

Manual acceptance matrix: Chrome desktop and responsive widths 360/768/1024/1440; keyboard-only traversal; refresh every deep link; Candidate login/logout; search → detail → apply → application detail; CV upload/manage; Affiliate CV reuse/adopt; identity claim; both consent paths.

## 9. Risk and Impact Analysis

- **High — role-home routing:** [graph] `LoginPage.handleFormSubmit`, `Dashboard`, and `ProtectedRoute` are direct dependents of the route helper. Missing one creates inconsistent redirects or loops. Update and test them in the same first commit.
- **High — profile data integrity:** [verified] current local-first save can hide backend errors. The new flow must not retain the old success path or write passwords/auth email into storage.
- **High — consent token security:** [verified] visual refactoring must preserve fragment-token cleanup and one-time decisions. Avoid generic URL/query helpers that reinsert the token.
- **Medium — public job compatibility:** External/shared `/jobs/:id` links must remain valid. Candidate-owned routes are additive wrappers, not replacements.
- **Medium — CV action regressions:** Existing permission, concurrency, ownership, and file-source behavior must remain in current API hooks. Redesign containers; do not reimplement mutations in visual components.
- **Medium — query duplication/performance:** Dashboard and shell must not issue unbounded duplicate application/CV/job calls. Reuse stable query keys, bounded page sizes, sensible stale time, and independent widget states.
- **Medium — legacy Candidate code:** Duplicate older Candidate headers/pages may still exist. Remove only imports and files proven unused after route migration; otherwise defer cleanup.
- **Low — shared Admin UI:** Candidate-specific CSS/components avoid changing shared admin primitives and reduce risk to Admin/Client/Affiliate pages.
- **No database/API migration:** [verified] required profile, skill, CV, application, identity, consent, and job contracts already exist. Unsupported “saved jobs”, true notifications, and AI recommendations are excluded.

## 10. Files Expected to Change

| File | Symbols | Reason |
| --- | --- | --- |
| `HRConnect-FE/src/app/router.tsx` | Candidate route tree | Add Candidate-owned jobs/detail and keep public routes |
| `HRConnect-FE/src/routes/AppRoutes.tsx` | `getDashboardRouteForRole`, route access | Make Candidate dashboard the consistent role home |
| `HRConnect-FE/src/features/auth/LoginPage.tsx` | `handleFormSubmit` | Remove Candidate `/` special-case |
| `HRConnect-FE/src/features/dashboard/Dashboard.tsx` | role redirect | Align generic dashboard routing |
| `HRConnect-FE/src/features/portal/CandidateShell.tsx` | shell/nav/drawer | Persistent, task-oriented responsive workspace |
| `HRConnect-FE/src/features/portal/CandidatePages.tsx` | current four pages | Split route pages; retire only after imports migrate |
| `HRConnect-FE/src/features/portal/candidate/*` | new pages/components/styles | Candidate-owned presentation and route modules |
| `HRConnect-FE/src/features/jobs-mf01/JobDiscoveryPage.tsx` | reusable route/path props | Only small compatibility additions if source verification during implementation requires them |
| `HRConnect-FE/src/features/jobs-mf01/PublicJobPages.tsx` | reusable inner detail export | Expose composition point without changing public behavior |
| `HRConnect-FE/src/features/portal/JobApplyActions.tsx` | Candidate apply UI | Presentation/accessibility only; preserve API rules |
| `HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx` | list/detail | Integrate into CV Hub and improve Candidate copy |
| `HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx` | full page/save flow | Replace local/mock behavior with production APIs |
| `HRConnect-FE/src/services/candidateService.ts` | profile API | Consolidate typed profile/visibility support |
| `HRConnect-FE/src/hooks/useCandidateProfile.ts` | profile state | Move to backend/query-cache source of truth |
| `HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx` | identity claim UI | Secondary account placement and plain-language UX |
| `HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx` | authenticated consent | Candidate-shell visual alignment |
| `HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx` | public consent | Trusted standalone visual alignment, token behavior intact |
| Existing and new Candidate `*.test.tsx` files | route/page scenarios | Protect business, routing, accessibility, and error states |

Exact new filenames may be adjusted during implementation only to match existing feature conventions; responsibilities and route boundaries above remain fixed.

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Redesign every current Candidate frontend route into one responsive, friendly workspace while preserving MF02 contracts and removing local/mock profile-CV behavior."
  acceptance_criteria:
    - "Candidate login and generic dashboard routing land at /candidate/dashboard."
    - "Candidate can search, open, and apply to jobs without leaving CandidateShell."
    - "Primary navigation has four task-oriented entries; account/security tasks are secondary."
    - "Dashboard, applications, CV Hub, profile, identity, and consent have loading/empty/error/success states and mobile layouts."
    - "Profile uses only backend-supported fields, visibility, and real skill CRUD."
    - "No false save success, fake password/auth write, mock CV builder, or local-only CV is retained."
    - "Public job URLs and public no-account consent remain compatible."
    - "Focused tests, full tests, lint, and build pass before manual acceptance."
  evidence_provenance: {"schema_version":2,"head_commit":"dc1de10e7c284161df2a6163bf42b30eb6a5637c","generated_plan_path":"docs/plans/2026-10-09-gitnexus-plan-candidate-experience-redesign.md","global_dirty_digest":{"algorithm":"sha256","canonicalization":"gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records","value":"0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"},"cited_path_manifest":[{"path":"HRConnect-FE/package.json","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:2c54b6f6536240e37afe7c3f74cb7ced564315080d5323cff8e098afe25fd83c","index_digest":"sha256:2c54b6f6536240e37afe7c3f74cb7ced564315080d5323cff8e098afe25fd83c","worktree_digest":"sha256:2b79726a60ca4624efd1221fd833efb6d018c4dfa619c0ba8652dc536ae1f8ad","untracked_digest":"absent"},{"path":"HRConnect-FE/src/app/router.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:0503ded83801a7fc672aacdc5fe086f8d19df85df6d67db80934c484d3ebe305","index_digest":"sha256:0503ded83801a7fc672aacdc5fe086f8d19df85df6d67db80934c484d3ebe305","worktree_digest":"sha256:4977432c0f6350fa6d5a48aace76947d2614801d550e367979b190477dc53f6e","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/admin-console/admin-console.css","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:ac40be97d4888e9c8fe54fbb2d1d8b7e1780d259d838c5d26b7df1693bd221c2","index_digest":"sha256:ac40be97d4888e9c8fe54fbb2d1d8b7e1780d259d838c5d26b7df1693bd221c2","worktree_digest":"sha256:36e9d021f1bfb9077d1ec70087251f519a24a3b2a46f208fd37e9c30d9f723ef","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/admin-console/ui.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:5ff86484d64403dd16cd8788de0a699677a3946b05579e519a519cde3e4574da","index_digest":"sha256:5ff86484d64403dd16cd8788de0a699677a3946b05579e519a519cde3e4574da","worktree_digest":"sha256:98e14921939e8b8aba2798f711a58e713a87ae512e13232c2a7b29c0cef8a448","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/auth/LoginPage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:72df3b098e80096820cc7d6308e81ab78b90c83955ad0e05688460cf8fad1630","index_digest":"sha256:72df3b098e80096820cc7d6308e81ab78b90c83955ad0e05688460cf8fad1630","worktree_digest":"sha256:cbc963b8accac39df79b0415189a9830237afeca40d61aea013a36b9d0c0ff3e","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:7828d4a6869891cf21b91d6f8aecce37e26a404e45b9a7a3e24b16529068f010","index_digest":"sha256:7828d4a6869891cf21b91d6f8aecce37e26a404e45b9a7a3e24b16529068f010","worktree_digest":"sha256:f9853b1f25034c3419e1a4e94df9143128a0b65b90100a80462b40e829e20bac","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/dashboard/Dashboard.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:06980885e9afea5c7c1e7ee76a68aee809a8d60541abf0266f0199e7aaf0c3b0","index_digest":"sha256:06980885e9afea5c7c1e7ee76a68aee809a8d60541abf0266f0199e7aaf0c3b0","worktree_digest":"sha256:5ef88cf1388ba55a4888853c0e36cdf9090ac1add969b40095a862bc86d3bd66","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/jobs-mf01/JobDiscoveryPage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:7dcf748957d3d171d5cda96b8181b38bb46d8be2e1cc06b227b777a19644b4c3","index_digest":"sha256:7dcf748957d3d171d5cda96b8181b38bb46d8be2e1cc06b227b777a19644b4c3","worktree_digest":"sha256:6e2f94c2b886072f82757174a6f387ca99f20b5e440da224faeb10702c91d393","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/jobs-mf01/PublicJobPages.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:90ed2f9907872c63c2bde55e1ddbab792d6bab3137c0a27e02fef87214fe21be","index_digest":"sha256:90ed2f9907872c63c2bde55e1ddbab792d6bab3137c0a27e02fef87214fe21be","worktree_digest":"sha256:305f8a22174bf4b009996d2ffb7d24356b5e2aa06b2d91a55fd1a0420a1bb3c0","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateAffiliateCvDetailPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:0b954dee526010ac47b829fdf28ddf208aac2a66727b2dba242a95ded2a66439","index_digest":"sha256:0b954dee526010ac47b829fdf28ddf208aac2a66727b2dba242a95ded2a66439","worktree_digest":"sha256:0b954dee526010ac47b829fdf28ddf208aac2a66727b2dba242a95ded2a66439","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:8384a82f051defabf7c23574e8e82e0841d18d7b6245100a9870d888e18daa9b","index_digest":"sha256:8384a82f051defabf7c23574e8e82e0841d18d7b6245100a9870d888e18daa9b","worktree_digest":"sha256:c8d431c4743a2a80a32e56f035442cf0aafa7dd75dad895a893e93990cdc7be2","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:d65640856fe292e0b553ce2ac9db7509958b64433accbbe17b037ac09ebce68a","index_digest":"sha256:d65640856fe292e0b553ce2ac9db7509958b64433accbbe17b037ac09ebce68a","worktree_digest":"sha256:a98780b18f8a2da7a5fe4d2b051d0d9f38bf125d1d079dbba8bf823d8e4676f1","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateApplicationDetailPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:4c06e9e3d35709e2c68ac8555b7fd8efd02144ed5eebcd418f7899fb38dd885d","index_digest":"sha256:4c06e9e3d35709e2c68ac8555b7fd8efd02144ed5eebcd418f7899fb38dd885d","worktree_digest":"sha256:616bd8d63b414dceee1c76f181c546dad53232631b9170448e9dea2e55e5fb37","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateCvsPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:eef0a04c7be5d99de2c4f28380940d036af444dee4f41dc71a4b1e6ca8471877","index_digest":"sha256:eef0a04c7be5d99de2c4f28380940d036af444dee4f41dc71a4b1e6ca8471877","worktree_digest":"sha256:ea7c5fb9a36f8f4feaf48a931208efbdb2455daedf7cc77f419d638eca4371db","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateIdentityPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:3b5cf1c2764e9484bb60e316ebca24c59772c329625924e1bc5494e3914d79a2","index_digest":"sha256:3b5cf1c2764e9484bb60e316ebca24c59772c329625924e1bc5494e3914d79a2","worktree_digest":"sha256:3b5cf1c2764e9484bb60e316ebca24c59772c329625924e1bc5494e3914d79a2","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:f351a41611d3fc61b1ed688ea4f5e3e696ac222f2aa06e6fdcdad0c09792f437","index_digest":"sha256:f351a41611d3fc61b1ed688ea4f5e3e696ac222f2aa06e6fdcdad0c09792f437","worktree_digest":"sha256:f351a41611d3fc61b1ed688ea4f5e3e696ac222f2aa06e6fdcdad0c09792f437","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidatePages.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:bf96d474aa66d8327b02b81146c15e09e0dcbf3ffb01123fbc10d36e155b03a2","index_digest":"sha256:bf96d474aa66d8327b02b81146c15e09e0dcbf3ffb01123fbc10d36e155b03a2","worktree_digest":"sha256:03fc3d64ca450d86d57fc083b2aa0d74a453654418f6c32e74b5a21f92b5534b","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateShell.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:176e026c3ae9f7ad23f092006de757c80b7454b2ebe4de569bea0e68b0062e60","index_digest":"sha256:176e026c3ae9f7ad23f092006de757c80b7454b2ebe4de569bea0e68b0062e60","worktree_digest":"sha256:db4da18937afb8448519c1a8a5d51d641c147f96dffe49604492a8728d4846a3","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:538396cbad43729df31fee7ea7b14b24d0d217d26dcb8f3e57e497c036bdc4c2","index_digest":"sha256:538396cbad43729df31fee7ea7b14b24d0d217d26dcb8f3e57e497c036bdc4c2","worktree_digest":"sha256:dd11797b6dbcf5bc0dda141682a89cd79bd5e6f7d1403860554b18003c459e1e","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:5324e55f26ddbc72288151fe7d327d92a04c83c6f15ff696fc1fe70e18503ec1","index_digest":"sha256:5324e55f26ddbc72288151fe7d327d92a04c83c6f15ff696fc1fe70e18503ec1","worktree_digest":"sha256:2bf466224cf85020df545a4e4a44ab0225ffd7087852df1ac50fd6cc3eee3482","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/JobApplyActions.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:c5a364bf6577cb4d1bf94f79de09ced3c745c573930547c68737807bab0f2af1","index_digest":"sha256:c5a364bf6577cb4d1bf94f79de09ced3c745c573930547c68737807bab0f2af1","worktree_digest":"sha256:feb16e0ddd0c48152e9958ed55e381838a5cb5638839d1f592891059b655562d","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/JobApplyActions.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:c37ba46444e6aa1c830ca6a9981ac59146c0da50ce600f54a31616df062fe16d","index_digest":"sha256:c37ba46444e6aa1c830ca6a9981ac59146c0da50ce600f54a31616df062fe16d","worktree_digest":"sha256:9bd16c1f29828bc9e43f725ccd594acedc5175e4253935a5f86c17c89af35170","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:c4501b8db2d82de0b1cc550e9535723cd14e71392347c784b7a669c5a05123e1","index_digest":"sha256:c4501b8db2d82de0b1cc550e9535723cd14e71392347c784b7a669c5a05123e1","worktree_digest":"sha256:702355894b066bb9e10feec1c566d86944eb34729cacf6ec32a4e27bfe7579cc","untracked_digest":"absent"},{"path":"HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:65780b10f4e6b5d4ca3ee29d843bdf1def7c8e0dc396b38d2f0cbd71f6635052","index_digest":"sha256:65780b10f4e6b5d4ca3ee29d843bdf1def7c8e0dc396b38d2f0cbd71f6635052","worktree_digest":"sha256:bdad814ead39822367c3cd7965f9d2069448a2931e41e97afdc5463a04d78c2f","untracked_digest":"absent"},{"path":"HRConnect-FE/src/hooks/useCandidateProfile.ts","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:22c3b6f80f4f26f05209f03a401fa02ea63ade38438b2bb90f7949e56b61bbf0","index_digest":"sha256:22c3b6f80f4f26f05209f03a401fa02ea63ade38438b2bb90f7949e56b61bbf0","worktree_digest":"sha256:e5a3c96d6ba6d1a6019d32d11b0a98265fccc3ef17e5753b97c324b7a3c33109","untracked_digest":"absent"},{"path":"HRConnect-FE/src/routes/AppRoutes.test.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:6894127df9e39fa5f53bf4b3cfd47e68dedee0cb0da10241872276f46a085a70","index_digest":"sha256:6894127df9e39fa5f53bf4b3cfd47e68dedee0cb0da10241872276f46a085a70","worktree_digest":"sha256:6c91a7915ef865650cf5ab1d7372279045129c3bbf7f6719a2663878006297a4","untracked_digest":"absent"},{"path":"HRConnect-FE/src/routes/AppRoutes.tsx","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:787049d5ac31ff499007bc39e89cd44a860be63f4dcaa82a23689e7272c4dd57","index_digest":"sha256:787049d5ac31ff499007bc39e89cd44a860be63f4dcaa82a23689e7272c4dd57","worktree_digest":"sha256:6012ed25205ca51c2015294cd574da9f9ab71f3c914421da0c12c18cc5ed0a9f","untracked_digest":"absent"},{"path":"HRConnect-FE/src/services/candidateService.ts","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:740f7bbf2732e236d79b48dc9abbcdf6a6b8a0d616a42294d1f1f19c0d88df8e","index_digest":"sha256:740f7bbf2732e236d79b48dc9abbcdf6a6b8a0d616a42294d1f1f19c0d88df8e","worktree_digest":"sha256:5849a69a9ba2893f88ceb02b09f5a8e73a1d04c9c34cde177da6357dcd1c5dfb","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:fcf2fe41e105029395e43dd74b561b72165c5d0dca3eb8b9ba66e9c465c8b7fa","index_digest":"sha256:fcf2fe41e105029395e43dd74b561b72165c5d0dca3eb8b9ba66e9c465c8b7fa","worktree_digest":"sha256:65c1c3798aee87efdf359b292e953ad4d4c00da9c36d3007d94efd426aa1a954","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateSkillEndpoints.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:46afc68cc82b5c7872a98e49af677fa68e380a2b1005297a1504ffece5097642","index_digest":"sha256:46afc68cc82b5c7872a98e49af677fa68e380a2b1005297a1504ffece5097642","worktree_digest":"sha256:0b4b4d5d64a180f6286d28b23bb1c5d48dd2efd415fa4ff0dcbc39138e941be1","untracked_digest":"absent"}]}
  primary_symbols:
    - symbol: "CandidateShell"
      file: "HRConnect-FE/src/features/portal/CandidateShell.tsx"
      lines: "37-170"
      role: "Persistent Candidate workspace, desktop/mobile navigation"
    - symbol: "router"
      file: "HRConnect-FE/src/app/router.tsx"
      lines: "80-220"
      role: "Public versus Candidate-owned route boundary"
    - symbol: "getDashboardRouteForRole"
      file: "HRConnect-FE/src/routes/AppRoutes.tsx"
      lines: "307-325"
      role: "Role entry destination consumed by login/dashboard/protection"
    - symbol: "CandidateProfilePage"
      file: "HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx"
      lines: "95-1398"
      role: "Legacy local-first profile and mock CV center to replace"
    - symbol: "CandidateHomePage"
      file: "HRConnect-FE/src/features/portal/CandidatePages.tsx"
      lines: "115-204"
      role: "Current dashboard to extract and redesign"
  related_symbols:
    - symbol: "LoginPage.handleFormSubmit"
      relationship: "CALLS/duplicates role-home decision"
      relevance: "Direct route-helper dependent; must not retain Candidate / special-case"
    - symbol: "Dashboard"
      relationship: "CALLS getDashboardRouteForRole"
      relevance: "Direct route-helper dependent"
    - symbol: "ProtectedRoute"
      relationship: "CALLS getDashboardRouteForRole"
      relevance: "Direct route-helper dependent and loop risk"
    - symbol: "JobDiscoveryPage"
      relationship: "REUSED_BY CandidateJobsPage"
      relevance: "Supports detailBasePath; avoids duplicating MF01 job logic"
    - symbol: "JobApplyActions"
      relationship: "USED_BY candidate job detail"
      relevance: "Existing real apply and CV-source business behavior"
    - symbol: "CandidateAffiliateCvsPage"
      relationship: "COMPOSED_IN CV Hub"
      relevance: "Existing real reuse/adopt/usage controls"
  execution_path:
    - "Candidate logs in; role routing resolves /candidate/dashboard."
    - "CandidateShell stays mounted across dashboard, jobs, applications, CV, profile, and account routes."
    - "Candidate searches at /candidate/jobs; cards link to /candidate/jobs/:jobId with query context preserved."
    - "Job detail reuses JobApplyActions; successful apply navigates to the real Candidate application."
    - "Dashboard and tracking pages read shared cached API data and translate raw states into Candidate-facing language."
    - "Profile validates and awaits backend success before cache/auth display updates; error leaves form data intact."
  pdg_constraints:
    - description: "One drawer state controls overlay, aria-expanded, Escape registration/cleanup, focus return, and route-close behavior."
      affected_statements:
        - "HRConnect-FE/src/features/portal/CandidateShell.tsx:37-170"
      implementation_consequence: "Do not introduce independent booleans for account/mobile surfaces representing the same drawer."
    - description: "Candidate role branch currently returns / and has three direct consumers."
      affected_statements:
        - "HRConnect-FE/src/routes/AppRoutes.tsx:307-325"
        - "HRConnect-FE/src/features/auth/LoginPage.tsx:173-260"
      implementation_consequence: "Update helper and direct consumers together; test loop-free consistency."
    - description: "Profile values currently flow to local state/storage even when backend update fails."
      affected_statements:
        - "HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx:211"
      implementation_consequence: "Make API success the gate for cache/auth success mutations and feedback."
  architectural_patterns:
    - pattern: "React Router nested protected routes"
      example_location: "HRConnect-FE/src/app/router.tsx"
      usage_guidance: "Nest Candidate job routes under CandidateShell; keep public job routes separate."
    - pattern: "Typed MF02 API and React Query hooks"
      example_location: "HRConnect-FE/src/services/api/mf02/"
      usage_guidance: "Consolidate profile/skills into the same server-source-of-truth pattern."
    - pattern: "Reusable MF01 job discovery with configurable detail base"
      example_location: "HRConnect-FE/src/features/jobs-mf01/JobDiscoveryPage.tsx"
      usage_guidance: "Compose under Candidate shell; do not fork job-search business logic."
  files_to_modify:
    - file: "HRConnect-FE/src/app/router.tsx"
      symbols: ["router"]
      intended_change: "Add nested Candidate job routes and compatibility redirects."
    - file: "HRConnect-FE/src/routes/AppRoutes.tsx"
      symbols: ["getDashboardRouteForRole", "ROLE_DASHBOARD_ROUTES", "ROUTE_ACCESS"]
      intended_change: "Set consistent Candidate home and route access."
    - file: "HRConnect-FE/src/features/portal/CandidateShell.tsx"
      symbols: ["CandidateShell"]
      intended_change: "Implement task-oriented desktop/mobile shell."
    - file: "HRConnect-FE/src/features/portal/CandidatePages.tsx"
      symbols: ["CandidateHomePage", "CandidateApplicationsPage", "CandidateApplicationDetailPage", "CandidateCvsPage"]
      intended_change: "Extract into focused route modules, then retire aggregate exports safely."
    - file: "HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx"
      symbols: ["CandidateProfilePage", "handleSaveProfile"]
      intended_change: "Rebuild on backend profile/visibility/skills and remove mock/local persistence."
    - file: "HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx"
      symbols: ["CandidateAffiliateCvsPage", "CandidateAffiliateCvDetailPage"]
      intended_change: "Integrate with CV Hub while preserving controls/deep links."
    - file: "HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx"
      symbols: ["CandidateIdentityPage"]
      intended_change: "Move to account context and simplify copy/states."
    - file: "HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx"
      symbols: ["CandidateSubmissionConsentPage"]
      intended_change: "Align authenticated consent UI with Candidate workspace."
    - file: "HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx"
      symbols: ["PublicSubmissionConsentPage"]
      intended_change: "Align standalone consent UI without changing token security."
  tests:
    - file: "HRConnect-FE/src/routes/AppRoutes.test.tsx"
      scenarios: ["Candidate login/dashboard/fallback -> /candidate/dashboard", "Candidate job deep links remain protected", "public job routes remain public"]
    - file: "HRConnect-FE/src/features/portal/candidate/CandidateShell.test.tsx"
      scenarios: ["desktop/mobile active navigation", "drawer keyboard/overlay close", "focus and route-change behavior"]
    - file: "HRConnect-FE/src/features/portal/candidate/CandidateDashboardPage.test.tsx"
      scenarios: ["complete/partial/empty/error data", "profile readiness", "bounded active jobs"]
    - file: "HRConnect-FE/src/features/portal/CandidateApplicationDetailPage.test.tsx"
      scenarios: ["null/PENDING/PROCESSING/COMPLETED/FAILED AI states", "no Candidate retry button"]
    - file: "HRConnect-FE/src/features/portal/CandidateCvsPage.test.tsx"
      scenarios: ["all real personal CV actions", "validation and API failures", "no mock CV state"]
    - file: "HRConnect-FE/src/features/candidates/CandidateProfilePage.test.tsx"
      scenarios: ["supported fields and read-only email", "failed save has no false success", "visibility and skill CRUD"]
    - file: "HRConnect-FE/src/features/portal/CandidateIdentityPage.test.tsx"
      scenarios: ["claim lifecycle, cooldown, restore, conflict, refresh"]
    - file: "HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.test.tsx"
      scenarios: ["fragment token removed", "confirm/decline/expired/error", "token never reappears in URL"]
  verification_commands:
    - "cd HRConnect-FE; npm run test:run"
    - "cd HRConnect-FE; npm run lint"
    - "cd HRConnect-FE; npm run build"
  risks:
    - "Redirect inconsistency or loop if one of the three direct role-home consumers is missed."
    - "Consent security regression if token handling is changed during visual refactor."
    - "CV ownership/concurrency regression if actions are reimplemented instead of reused."
    - "Duplicate/unbounded network requests if dashboard widgets do not reuse query keys and bounded page sizes."
  assumptions:
    - "Before implementation, verify the branch is created from latest dev and the evidence paths have not drifted using GitNexus detect_changes/source reads."
    - "Verify skill endpoint DTO fields before building proficiency/year controls; omit any unsupported input."
    - "Verify which legacy Candidate modules are still imported before deleting; keep them if usage is unresolved."
  open_questions:
    - "No blocking product question. Unsupported target role, expected salary, saved jobs, notification center, and personalized recommendations remain deferred until backend contracts exist."
  avoid:
    - "Do not repeat full repository discovery; start from this context pack and re-anchor only drifted files."
    - "Do not change MF02 backend business rules or database schema for this UI redesign."
    - "Do not remove public /jobs routes or public consent URLs."
    - "Do not expose a Candidate MF03 retry action."
    - "Do not persist passwords, profile success, unsupported fields, or fake CVs in localStorage."
    - "Do not modify shared Admin/Client/Affiliate UI merely to style Candidate pages."
```

## 12. Assumptions and Open Questions

### Assumptions to re-verify at implementation start

- [assumed] Create `feature/candidate-ui-redesign` from the latest agreed integration branch after checking for new FE work since commit `dc1de10e7c284161df2a6163bf42b30eb6a5637c`.
- [assumed] Existing MF02 backend contracts remain stable throughout the UI branch. If a response changed, update types/adapters first; do not compensate with fake frontend data.
- [assumed] Candidate profile skill DTOs support only the fields verified from endpoint contracts at execution time; controls must match those DTOs exactly.

### Explicitly deferred work

- Saved jobs/favorites: the current route redirects and no production backend contract was found.
- A real notification center: no dedicated Candidate notification-list contract was found. Consent continues through email/deep link and existing pages.
- Personalized or AI-recommended jobs: active jobs may be shown, but the UI must not claim personalization.
- Adding target role, expected salary, preferred location, languages, availability date, profile photo upload, or CV builder templates: requires separately approved backend/product work.
- Retiring all duplicate legacy Candidate files: remove only files proven unused after route migration; broader cleanup is a separate refactor.
- Changes to Client/Affiliate/Admin experiences or MF03 retry policy are outside this Candidate UI plan.

## 13. Definition of Done

- Candidate login, `/dashboard`, and protected fallback consistently land on `/candidate/dashboard` without redirect loops.
- Candidate can complete search → job detail → apply → application detail without the Candidate shell/header changing.
- Desktop and mobile navigation expose four primary tasks and place account/security tools in a secondary menu.
- Every currently supported Candidate route has coherent responsive loading, empty, error, success, and permission/expiry states.
- Dashboard and application detail explain MF03 state; no unexplained dash and no Candidate retry control remain.
- Personal and Affiliate CV functions use existing production APIs, including concurrency and adoption behavior; mock/local CV creation is gone.
- Profile edits only backend-supported fields, email is read-only, skill/visibility APIs work, API failure never displays success, and no password/auth identity is written by profile code.
- Authenticated/public consent and identity claim preserve existing security and business rules.
- Public `/jobs` and `/jobs/:id`, old supported deep links, and consent email links continue to work.
- Focused tests pass after every implementation step; final `npm run test:run`, `npm run lint`, and `npm run build` pass.
- Manual checks pass at 360/768/1024/1440px and keyboard-only navigation.
- Each page group is committed and pushed separately to `feature/candidate-ui-redesign`; `dev` and `main` remain unmerged until user approval.
