# QuickPOS Development Instructions

## UI components

- Always use the existing shadcn components in `src/components/ui` for application UI.
- Before creating a control, check whether a shadcn component already exists in the project.
- Do not introduce raw HTML controls such as `<select>`, `<button>`, modal/dialog implementations, badges, tables, or dropdown menus when a shadcn equivalent exists.
- Keep shadcn behavior, spacing, focus states, accessibility, and light/dark styling consistent across pages.
- If the required shadcn component is missing, add or extend the appropriate reusable component in `src/components/ui` instead of styling a one-off control inside a feature.
- Use a native control only when a shadcn component cannot meet a documented technical requirement. Record the reason in the code and keep the native control reusable and visually consistent.

