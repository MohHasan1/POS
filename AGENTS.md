# QuickPOS Development Instructions

## Code organization

- Keep page files focused on loading data and composing the screen. Split forms, dialogs, tables, and other distinct sections into focused components with clear names.
- Reuse existing components and helpers for repeated behavior. When multiple screens need the same control or layout, extend the shared component so fixes apply everywhere.
- Keep business rules and calculations in shared services or utilities so screens, reports, and exports use the same logic.
- Split code by responsibility. Keep related code together and use clear names, small functions, and straightforward control flow.

## UI components

- Always use the existing shadcn components in `src/components/ui` for application UI.
- Before creating a control, check whether a shadcn component already exists in the project.
- Do not introduce raw HTML controls such as `<select>`, `<button>`, modal/dialog implementations, badges, tables, or dropdown menus when a shadcn equivalent exists.
- Keep shadcn behavior, spacing, focus states, accessibility, and light/dark styling consistent across pages.
- If the required shadcn component is missing, add or extend the appropriate reusable component in `src/components/ui` instead of styling a one-off control inside a feature.
- Use a native control only when a shadcn component cannot meet a documented technical requirement. Record the reason in the code and keep the native control reusable and visually consistent.

## Visual consistency

- Follow the existing QuickPOS patterns for color, typography, spacing, icons, and layout. Use shared theme tokens and component variants for recurring styles.
- Give the same action, status, or control the same visual treatment across pages. Put changes to recurring styles in the shared component or theme.
- When updating a screen, compare it with similar screens. Check light and dark themes, responsive layouts, contrast, and hover, focus, and disabled states.
