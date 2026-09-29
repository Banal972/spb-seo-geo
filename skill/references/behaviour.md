# How the audit behaves

Things the tool already handles, so you do not have to reason about them or work around
them. Read this only if a result looks wrong.

## Things already handled

- **If a plugin generates `robots.txt`**, `apply` prints the snippet for *that tool's config* rather than writing a file the next build overwrites. Relay the snippet.
- **Already in the repo but not deployed** reads "exists locally, deploy it", not missing.
- **If the site could not be reached**, everything live is unchecked — never report that as failures.

## Optional engines

Console work for Naver and Yahoo is the only optional part; `todo` prints it under "Optional engines", with both always listed. **Never infer an engine from the site's language** — content says what language it is in, not which markets its owner wants, and a `.kr` site may be going after Japan. Yahoo's answer is "nothing to register"; relay what `todo` prints.

## GEO is measured, not assumed

With an access log the report prints an **AI crawler activity** block: which citation bots fetched the site, and whether a real person arrived through an AI product. Relay it — it is the hardest data in the report. `citation none` means nothing can cite the site however good its content is.


## Auditing versus configuring

`scan` needs nothing but a URL and runs every rule. The intake exists only because this
tool writes files; every question maps to something it writes. Other skills in this space
take a URL and nothing else because they cannot read or write your project at all.
