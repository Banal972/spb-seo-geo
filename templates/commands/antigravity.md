# /spbseo — audit search and AI visibility

Follow the instructions in `{{SKILL_DIR}}/SKILL.md`. Do not read the raw site yourself; use only the script's output.

// turbo
```
node {{SKILL_DIR}}/scripts/scan.mjs
```

It needs no arguments — the site address is read out of the project. Append whatever the user typed after `/spbseo` (`seo`, `geo`, or an address), and ask for an address only if the scan says it found none.

`scan` is read-only, so auto-running it is fine. **Never put `// turbo` on `apply --write`** — anything that writes files needs human approval.
If the script is missing, tell the user to reinstall with `npx spb-seo-geo`.
