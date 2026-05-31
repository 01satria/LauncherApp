# Changelog

All notable changes to this project will be documented in this file.

## [2.0] - 2026-05-31
### Added
- Rebranded the launcher application name from "Flow Launcher" to "Cirro" across all system strings and onboarding views.
- Re-architected update check framework to use Google Apps Script Web App integrated with the Google Spreadsheet backend, avoiding raw CSV 401 authorization issues.
- Implemented manual redirect tracking (HTTP 302/307) in the update check network engine to robustly support Apps Script redirect structures.
- Added browser redirection support for non-APK update URLs (such as release tag pages) inside the manual update settings and the home page briefing update card.
- Re-enabled automated daily update checking on launcher startup.
- Configured native adaptive icon configuration (`ic_launcher.xml` and `ic_launcher_round.xml`) using a solid black background layer to prevent launchers from wrapping legacy PNG assets in white circle borders.
- Renamed release workflow output APK files inside the GitHub Actions pipeline to `Cirro-${VERSION}-${architecture}.apk`.

### Changed
- Refactored dock and home app drawer labels to dynamically sync their text colors with the active theme's palette instead of using hardcoded white text.
- Re-engineered the liquid glass effect on the dock and home tray using canvas displacement shaders to prevent UI crashes across all Android versions.
- Removed touch ripple feedback effects from the Money Manager and Exchange Rate widget stack layouts to preserve clean minimalist interfaces.

### Fixed
- Fixed a compilation-breaking XML parse error caused by duplicate `android:focusable` attributes in `layout_widget_money_currency.xml`.

## [1.9] - 2026-05-19
### Added
- Engineered an edge-to-edge album cover art frame on the left of the expanded music pill, with a dynamic horizontal transparent-to-surface gradient overlay that fades the art smoothly into the card background.
- Re-architected `ButtonHelper` to support automatic proportional padding, center-gravity text alignment, and dynamic theme-based 3D micro-borders using background luminance calculations.
- Replaced raw text emojis in the widget gallery chips with clean, programmatically tinted Lucide vector drawables (`calendar`, `wallet`, `hourglass`, etc.) that support recursive custom typography styling.
- Coupled Pill Island queue processing directly with briefing feed widget visibility, saving background processing power when a card is disabled or deleted.
- Enabled dynamic alpha opacity syncing on all tool backgrounds (Habits, Currency, Money, Pomodoro, etc.) to elegantly reveal the system wallpaper.
- Implemented deliberate high-fidelity gesture physics for minimized Card Pill swipe-up gestures, incorporating real-time velocity (speed and distance) calculations to prevent accidental triggers.
- Fully synchronized card pill shadow layers in perfect lockstep during swipe dragging and pop transitions to eliminate lag, stutters, and stuck visual states.
- Optimized card pill GPU and RAM memory consumption by removing redundant hardware-layer allocations during animations.
- Engineered springy, high-fidelity rubber-band physics for minimized Card Pill swipe-up gestures.
- Designed complete launcher OS process restart/kill sequence for absolute RAM reclamation and background task termination upon force refresh.
- Resolved a critical feed widget logic bug where deleted or deactivated widgets were forcibly restored on launcher updates.
- Redesigned the AI thinking progress state with a smooth, 3-dot organic circular bouncing wave animation using the active theme's accent color.
- Added an in-place verification loading spinner and database check progress state in the Premium License Key modal.
- Engineered softened, premium background blending to prevent harsh pure-white or pitch-black BottomSheet dialogs.
- Added smooth clock fade transitions when opening and closing the app search overlay.
- Unified the background transparency and colors of all briefing feed cards.
- Configured the Prayer widget to dynamically show the current active prayer name and time instead of future ones.
- Implemented a complete background thread lifecycle manager to stop background tasks automatically when widgets are hidden, saving RAM and battery.
- Polished the Music Pill swipe-up animation to make it highly dynamic, physics-driven, and expressive.
- Engineered stable AI connections by implementing multi-model POST fallbacks and a direct backup route.
- Secured Base64 decoded endpoints by stripping whitespace anomalies to prevent URL connection errors.
- Built a fair-token consumption check where daily limits are only decremented upon successful AI replies.
- Optimized briefing feed energy consumption by pausing background tick countdowns when the feed page is out of focus.
- Refined back-press navigation to gracefully close widget edit mode and save custom layouts.
- Integrated a premium custom-themed RSS News Card widget with automatic top headline rendering.
- Created RSS News Activity detailing feed listings with pull-to-refresh, notch camera protection, and custom bottom sheet dialogs to add custom URLs.
- Added relative time display for RSS news items.
- Added "Last updated" timestamps in the RSS News header.
- Enabled lazy-loaded news thumbnails with downsampled bitmap formats for 50% RAM savings.
- Integrated Swipe-to-Refresh gesture in Currency Converter.
- Appended dynamic cache-busting timestamping to ensure up-to-date real-time market data.
- Built a verified real-time check visual badge at the bottom of the Currency Converter.
- Added safe status bar top margin offset inside Chat Activity to prevent overlapping physical camera notch cutouts.
- Designed premium auto-separator text formatter for license key inputs.
- Restructured onboarding flow so "Try Free" routing configures the visual styles setup.
- Restricted premium custom color palettes and fonts for unlicensed free users during onboarding.
- Built a dynamic drag-and-drop reordering system for briefing feed widgets with live layout flow updates.
- Added programmatically inflated glassmorphic overlays in widget edit mode with dedicated drag handles and delete buttons.
- Engineered an inactive widgets gallery card at the bottom to quickly restore disabled widgets.
- Added dynamic scrolling padding compensation to prevent widgets from being covered by the control gallery.
- Added saved widget order persistence synced with Shared Preferences.
- Optimized performance by disabling background checks on invisible briefing widgets.
- Disabled home page swiping during briefing widget edit mode.
- Ensured background widget processes stop immediately upon card deletion to free RAM.
- Added real-time expanded music metadata updates when song changes while card is active.
- Upgraded dialog confirm/save buttons to adopt the active theme accent color with high-contrast text.
- Fully custom-themed all screens inside the Currency Converter.
- Migrated Habit edit and delete action menus from standard alerts to bottom sheets.
- Dynamically themed habit editor dialog input elements.
- Added accent theme color compatibility to the Pomodoro timer launcher button and Currency Converter button.
- Added automatic exit and save mechanism for widget edit mode when transitioning to the homepage.

### Changed
- Standardized cancel buttons within `DialogHelper` using `ButtonHelper` to share identical heights, touch feedback, and responsive ripples.
- Modified all custom BottomSheet dialogs to respect layout adjustment flags (`fitsSystemWindows`, `SOFT_INPUT_ADJUST_RESIZE`) and dynamically match navigation bar backgrounds to theme surface colors.
- Replaced legacy background tints on permission controls and FAB buttons with standard unified Pill Button configurations.
- Refactored Onboarding license key formatting and Settings license modals to leverage the unified formatter.
- Removed the old static Settings widget and layout from the feed.
- Simplified Weather widget layout: removed redundant descriptions, only keeping the sunset time.
- Simplified Prayer widget layout: replaced the 3-column list with a single centered active prayer name and time.
- Simplified Habits widget layout: removed energy score labels and horizontal separators.
- Simplified Money widget layout: removed managing budget hints.
- Simplified AI Chat widget layout: removed right chevron arrows and empty areas.
- Simplified RSS widget layout: renamed card title to News and removed chevron arrows.
- Reduced Event card height to 140dp for a compact appearance.
- Redesigned the Event card layout to prevent text clipping.
- Removed translucent background boxes and borders from all widgets, making them clean and borderless.
- Removed translucent background boxes and borders from edit mode widget overlays.
- Redesigned Chat Activity input text area with a clean transparent background and circular send button.
- Upgraded pill swipe-up animation to follow finger gestures with damped physics.
- Improved drag-and-drop widget reorder transitions using smooth animation frameworks instead of sudden jumps.
- Prevented scroll view conflicts during active widget dragging.

### Fixed
- Removed colliding widthAnimators in `HomeFragment.kt` to let the liquid-bounce spring animation system govern card morphs exclusively.
- Resolved vertical typography cutoff and off-center alignment in styled buttons by setting `includeFontPadding = false` recursively on all Styled Text Views.
- Fixed a layout bug in the Tasks widget where list items collapsed or cropped.
- Fixed critical AI connection failures by removing deprecated model parameters and migrating endpoint connections to model-less routes.

## [1.8] - 2026-05-15
### Added
- Unified `DialogHelper` using `BottomSheetDialog` to create iOS-style modals that slide from the bottom.
- Created `dialog_modal_base.xml` as a reusable layout for all modals in the app.

### Changed
- Redesigned License Key input in Settings as a premium BottomSheet modal.
- Migrated Color Palette, Font Style, Clock Font Style, Clock Color, and Hidden Apps dialogs in Settings to the new iOS-style modal.
- Migrated App Options dialog in Drawer to the new iOS-style action sheet (edge-to-edge list in BottomSheetDialog).
- Added `showActionSheet` to `DialogHelper` for edge-to-edge bottom sheet menus.
- Migrated Add/Edit Task dialogs in Feed widget to the new iOS-style modal.
- Migrated **ADD TRANSACTION** dialog in `MoneyActivity` to the new iOS-style BottomSheet modal.
- Migrated **NEW HABIT** dialog in `HabitActivity` to the new iOS-style BottomSheet modal.
- Migrated **CUSTOM AI** (Chat Profile) dialog in `ChatActivity` to the new iOS-style BottomSheet modal.
- Optimized Pill Now Bar (Pill Island) resize animation by removing `OvershootInterpolator` and width-locking, eliminating right-side glitches and choppiness.

### Fixed
- Fixed unresolved reference `corners` in `GradientDrawable` by using `cornerRadii`.
- Fixed `BottomSheetDialog` background glitch (gray background behind rounded corners) by setting it to transparent in `DialogHelper`.

## [1.7] - 2026-05-13
### Added
- Force Refresh FeedBrief feature in Settings.
- Click listener on Habits widget to open Pomodoro.
- Click listener on Money widget to open Currency Converter.
- Premium Access License Key feature with Google Apps Script integration.
- Auto-hyphenation for License Key input field.
- Secure storage for license verification using SHA-256 and Device ID binding.
- Custom font support for Chat screen message views.
- Section visibility toggle in FeedFragment (hides full section when disabled).
- Advanced AI Pill Bar engine (`AIPillBrain`) for premium users with 15-minute background sync.
- "Check for Updates" feature in Settings that communicates with a custom Google Sheets backend via Google Apps Script.

### Changed
- Updated AI chat widget title to use the custom AI name.
- Updated Currency Live Converter icon to `lucide_coins`.
- Removed Pomodoro button from Habits page (moved to widget).
- Removed Currency Converter button from Money Manager page (moved to widget).
- Made Chat, Weather, Prayer Time, Habits, Pomodoro, and Settings screens truly fullscreen when hide status bar or immersive mode is active.
- Changed expanded music card layout in pill bar to 1/3 cover and 2/3 info.
- Improved pill selector colors in Settings to ensure high contrast with background.
- Moved Wallpaper Opacity row below "Show Wallpaper" toggle in Settings.
- Changed Chat thinking animation to a rounded rectangle instead of an oval.
- Ensured clock color selector is always visible in Settings.
- Removed unused `API_KEY` in `PrayerTimeHelper.kt`.
- Obfuscated secret salt in `Prefs.kt` to improve security.
- Updated `MoneyTransactionAdapter` and `FeedFragment` to use theme palette colors instead of hardcoded hex colors.
- Paused auto-change of card pill bar when expanded.
- Changed notification dot color to solid red for better contrast across all parts.
- Removed Grid mode for apps in drawer (Only Niagara mode remains).
- Consolidated search and drawer to use `NiagaraAppsAdapter`.
- Deleted unused `DrawerAppAdapter`, `item_drawer_app.xml`, and `item_drawer_app_grid.xml`.
- Redesigned Clock Size setting to use a standard slider with 'A' labels and added physical dividers.
- Obfuscated all API endpoint URLs (Weather, Currency, Prayer, News) using Base64 encoding to prevent reverse engineering.
- Redesigned album art transitions in the Media Pill with a smooth pop/elastic animation (scale and fade).
- Styled font selector pills in Settings to display text in their respective font faces.
- Applied current color palette and theming to the "Confirm License Key" button and input field in Settings.

### Fixed
- Fixed crash in MediaHelper when expanding music pill (bitmap recycled issue).
- Fixed crash in HomeFragment when detached from context or during window insets application.
- Fixed missing Weather card in FeedBrief (now shows fallback instead of hiding).
- Fixed white AI avatar in Feed widget (cleared white tint and optimized loading with `decodeFile`).
- Fixed prayer time widget disappearing after being disabled and re-enabled.
- Fixed notification dots not showing in Drawer and Search results by forcing refresh on update.
- Moved notification dots in dock closer to the icon for better aesthetics.
- Fixed rotation glitches in card pill bar (width morphing and button flash).
- Fixed ultra immersive mode to support full screen on all pages by allowing layout in display cutout (notch).
- Optimized notification dots in drawer list to save RAM and CPU by using diffing.
- Improved fade effect on expanded music pill cover image using a separate gradient overlay.
- Fixed missing closing tag in `fragment_home.xml` that caused build failure.
- Fixed pill color glitch in Settings where selecting a pill altered text colors of other active pills.
- Closed security loophole for notification dots (dots are now properly hidden for free users in drawer and search).
- Removed all `printStackTrace` and debug logs to prevent information leakage and harden app security.
- Eliminated all micro-glitches and lag in the card pill bar refresh process for ultra-smooth updates.
- Fixed clock font glitch when returning home where it flashed the launcher font before snapping to the clock font.
- Forced "Mode Launcher" selector pills to strictly use the default font.
- Fixed a bug where the update status button was unclickable for premium users in Settings.

## [1.6] - 2026-05-09
### Added
- Wallpaper opacity setting now correctly applies to the Chat screen background.
- Improved AI female persona with more expressive tone and emotional responses.
- Removed grey background animation (ripple) when clicking or holding apps in the drawer.
- Added liquid glass effect with 45° gradient borders to home pills, trays, and dock.
- Smart Repair section in Settings (Reset wallpaper, app list, and FeedBrief).
- Auto currency conversion based on location with live rates.
- Unified Backup & Restore system (single file for all data).
- Notification dots on app icons (Drawer and Dock) with toggle in Settings.
- Ultra Immersive Screen mode (hide status and navigation bar).
- Customizable social status for AI persona.
- Color palette and font style selector on the onboarding start page.
- Dynamic persona switching for Cloudys AI based on bot name (Male/Female modes).
- 24dp horizontal padding in Settings to prevent content from touching screen edges.
- Market update timestamps in the currency converter.

### Changed
- Refined Settings UI by removing redundant "Customize your launcher experience" text.
- Polished AI conversation style to be polite yet nonformal.
- Moved Theme toggle to the header (top right) as an icon button in Settings.
- Consolidated backup and restore into a single entry point.
- Migrated currency data to ExchangeRate-API for better real-time accuracy.
- Polished AI chat responses to sound more natural and conversational.
- Implemented 5-minute in-memory caching for exchange rates to save data/battery.
- Updated system error messages with more relatable language.

### Fixed
- Music card sticking to old info when changing songs.
- Weather temperature not updating in dynamic text.
- Money widget formatting to correctly follow user-defined currency settings.
- Activity transitions and navigation flow between Chat and Settings.

## [1.5]
### Added
- Official branding for "Cloudys AI" with a refined personality.
- Native Pomodoro Timer for productivity tracking.
- Custom bot naming via chat commands with UI synchronization.
- New icon set for the Settings menu and modernized Brief feed labels.
- Fluid activity transitions and back-button animations.

### Changed
- Optimized core layout and removed legacy "Lite Mode" code.
- Improved weather card layout with added scroll support.

### Fixed
- Various system crashes and dialog architecture bugs.

## [1.0] - [1.4]
- Internal development builds. Detailed changes undocumented.

## Free Version Limitations
Features restricted for non-verified (Free) users:
- **Chat AI**: Limited to 10 chats per day, no history saving, and no custom status/name editing.
- **Custom Color Palette**: Locked.
- **Hide Apps**: Locked.
- **Dot Notification**: Locked.
- **Custom Font Color Clock**: Locked.
- **Tray Info in Home**: Hidden/Locked.
- **Custom Fonts**: Limited to "Default" and "Pixel" options only.
- **Depth Wallpaper**: Limited to a single use/setup.
- **Pomodoro**: No custom time settings (only default 25/5/4 allowed).
- **Backup & Restore**: Locked (cannot backup or restore data).
