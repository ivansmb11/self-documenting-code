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

Claude makes each decision itself and applies it with a follow-up edit. It never asks you, so automated and auto-mode runs don't stop for approval. If every comment is justified, nothing happens.

Comments that already existed are never flagged, so the plugin doesn't keep asking about the same ones. Tooling directives are ignored, including `eslint-disable`, `@ts-expect-error`, `noqa`, `type: ignore`, `//go:`, `#region`, license headers and shebangs.

## Example

This came from a real session with the plugin installed. Claude first wrote:

```ts
// calculate the total
export function calc(items: { p: number; q: number }[]) {
  let t = 0 // total
  // loop over items
  for (const i of items) {
    t += i.p * i.q // multiply price by quantity
  }
  // Prices are stored in cents to avoid float rounding errors in sums.
  return t
}
```

Right after the write, Claude received this note (the user does not see it):

```
[self-documenting-code] This edit added 5 comment(s) to cart.ts (line numbers relative to the edited text):
  - L1: calculate the total
  - L3: total
  - L4: loop over items
  - L6: multiply price by quantity
  - L8: Prices are stored in cents to avoid float rounding errors in sums.

Before continuing, review each comment under the self-documenting code convention. Decide on your own: do not ask the user, do not pause for approval, and do not narrate the review.
- KEEP it if it states a WHY, a warning, a public contract, a reference, or a ticketed TODO. Tighten its wording if needed.
- REPLACE it if a clearer name, an extracted function or a named constant would carry the meaning. Make that change and delete the comment.
- DELETE it if it restates what the code does or narrates the change.
Apply the fixes with a follow-up edit. If every comment is worth keeping, do nothing.
```

Claude's follow-up edit:

```ts
type LineItem = { priceInCents: number; quantity: number }

// Prices are kept in cents so sums don't pick up float rounding errors.
export function cartTotalInCents(items: LineItem[]): number {
  return items.reduce((total, item) => total + item.priceInCents * item.quantity, 0)
}
```

| Comment | Decision |
| --- | --- |
| `calculate the total` | Replaced by the name `cartTotalInCents` |
| `total` | Replaced by the name `total` in the reducer |
| `loop over items` | Deleted; `reduce` says it |
| `multiply price by quantity` | Replaced by `priceInCents` and `quantity` |
| `Prices are stored in cents…` | Kept: it explains why |

The follow-up edit triggered one more check, which flagged only the reworded cents comment. It explains a reason, so Claude left it, and the loop ended there.

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
