# self-documenting-code

A Claude Code plugin that keeps Claude from filling your code with comments that only repeat what the code does.

After every `Edit` or `Write`, it finds the comments that edit introduced and has Claude decide, one by one, whether each should stay. Comments that only restate the code are removed, or replaced by a clearer name. Comments that explain a reason, a warning or a contract stay.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install self-documenting-code --marketplace ivansmb11/self-documenting-code
```

Answer `y` to add the marketplace, then pick a scope (user scope applies to every project).

From a shell:

```
claude plugin install self-documenting-code --marketplace ivansmb11/self-documenting-code
```

In the desktop app: click **+** next to the prompt box, then **Plugins**. Choose **Add marketplace**, enter `ivansmb11/self-documenting-code`, then **Add plugin**.

## How it works

The plugin registers two hooks.

**`prompt.compose`** adds a short convention to the system prompt, so Claude writes fewer comments in the first place. A comment is kept only when it carries something the code cannot:

| Keep | Example |
| --- | --- |
| Why | `// Stripe retries webhooks for 3 days, so this must be idempotent` |
| Warning | `// Must run before initAuth(): it reads the session cookie` |
| Contract | JSDoc or docstrings on exported API |
| Reference | `// See RFC 7231 §6.5.1` |
| Ticketed TODO | `// TODO(#412): drop once v1 clients are gone` |

Everything else goes: comments that say *what* the code does, comments that make up for a vague name, notes about the change being made, and commented-out code.

**`tool.call` on `Edit` and `Write`** runs after the tool succeeds. It compares comments before and after the edit and collects only the ones that are new. If there are any, it attaches a note to the tool result. Claude reads the note; the user does not see it. The note lists each new comment and asks Claude to:

- **Keep** it if it fits the table above,
- **Replace** it by renaming, extracting a function or naming a constant, then delete it, or
- **Delete** it.

Claude applies the decision with a follow-up edit. If every comment is justified, nothing happens.

Comments that already existed are never flagged, so the plugin doesn't keep asking about the same ones. Tooling directives are ignored, including `eslint-disable`, `@ts-expect-error`, `noqa`, `type: ignore`, `//go:`, `#region`, license headers and shebangs.

## Supported files

| Syntax | Extensions |
| --- | --- |
| `//`, `/* */` | js, jsx, ts, tsx, mjs, cjs, java, kt, swift, go, rs, c, cpp, h, cs, scala, dart, php, groovy, zig |
| `#` | py, rb, sh, bash, zsh, yml, yaml, toml, r, pl, ex, tf, ps1, Dockerfile, Makefile |
| `--` | sql, hs, lua |
| `<!-- -->`, `//`, `/* */` | html, vue, svelte, astro |
| `/* */` | css (scss and less also take `//`) |

Markdown, JSON and other non-code files are skipped.

## Limitations

- Comment detection works line by line, not with a parser. A `//` or `#` inside a multi-line string can be misread as a comment.
- Python docstrings are not checked; only `#` comments are.
- For `Edit`, the line numbers in the note count from the start of the edited snippet, not the file.
- A comment that is edited counts as new, so rewording an old comment puts it up for review again.

## Customizing

The convention text is the `CONVENTION` constant in [`hooks/register.ts`](hooks/register.ts). The ignored directives are the `DIRECTIVE` pattern in [`hooks/comments.ts`](hooks/comments.ts). To run a local copy:

```
git clone https://github.com/ivansmb11/self-documenting-code
claude --plugin-dir ./self-documenting-code
```

## Development

```
claude plugin validate .
claude plugin test .
```

Tests live in [`hooks/register.test.ts`](hooks/register.test.ts).

## License

[MIT](LICENSE)
