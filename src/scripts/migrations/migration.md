Every migration must export these things:

- id — the sortable id matching the filename prefix

- description — human text

- up(db) — apply migration

- down(db) — rollback migration