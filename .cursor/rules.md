- Use the defined tools to query or mutate Scrum data via `DatabaseManager`.
- Inputs must be JSON via stdin. Outputs are JSON.
- Tools:
  - `list-projects`: no input. Returns `{ ok, projects }`.
  - `create-project`: `{ name, description?, status? }`. Returns `{ ok, project }`.
  - `list-issues`: `{ project_id }`. Returns `{ ok, issues }`.
- These tools run against the same database config the Electron app uses.

