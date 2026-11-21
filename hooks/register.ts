import type { Register } from 'claude-code'
import { addedComments, syntaxFor, type FoundComment } from './comments'

const CONVENTION = `# Self-documenting code

Code explains itself through names, types, small functions and structure. A comment has to earn its place.

A comment is worth keeping only when it says something the code can't:
- WHY: a non-obvious reason, a trade-off, or a business rule ("Stripe retries webhooks for 3 days, so this must be idempotent").
- WARNING: a trap, an ordering constraint, or a known bug in a dependency, with a link to the issue.
- CONTRACT: public API docs (JSDoc, docstrings) on exported symbols that other modules or users read.
- REFERENCE: a link to a spec, RFC, ticket or algorithm source.
- TODO/FIXME: only with an owner or ticket.

Remove or replace a comment when it:
- restates WHAT the code does ("// increment counter", "# loop over users");
- stands in for a better name. Rename the variable or function, or extract a well-named function or constant;
- narrates the change you are making, leaves commented-out code behind, or is a section divider that adds nothing.

Write code that needs no comment first. Add a comment only when one of the reasons above applies.

When a comment's fate is unclear, decide yourself; never ask the user whether to keep a comment.`

const MAX_LISTED = 25

function steer(path: string, comments: readonly FoundComment[]): string {
  const listed = comments
    .slice(0, MAX_LISTED)
    .map(c => `  - L${c.line}: ${c.text.length > 160 ? `${c.text.slice(0, 157)}...` : c.text}`)
    .join('\n')
  const more = comments.length > MAX_LISTED ? `\n  ...and ${comments.length - MAX_LISTED} more` : ''

  return `[self-documenting-code] This edit added ${comments.length} comment(s) to ${path} (line numbers relative to the edited text):
${listed}${more}

Before continuing, review each comment under the self-documenting code convention. Decide on your own: do not ask the user, do not pause for approval, and do not narrate the review.
- KEEP it if it states a WHY, a warning, a public contract, a reference, or a ticketed TODO. Tighten its wording if needed.
- REPLACE it if a clearer name, an extracted function or a named constant would carry the meaning. Make that change and delete the comment.
- DELETE it if it restates what the code does or narrates the change.
Apply the fixes with a follow-up edit. If every comment is worth keeping, do nothing.`
}

function stringField(value: unknown, key: string): string | undefined {
  if (value && typeof value === 'object' && key in value) {
    const field = (value as Record<string, unknown>)[key]
    return typeof field === 'string' ? field : undefined
  }
  return undefined
}

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return {
      sections: [
        ...composed.sections,
        { id: `${$.plugin.name}:convention`, text: CONVENTION, scope: 'session' },
      ],
    }
  })

  on('tool.call', { tool: 'Edit' }, async (_$, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran

    const syntax = syntaxFor(e.file_path)
    if (!syntax) return ran

    const added = addedComments(e.old_string, e.new_string, syntax)
    if (added.length === 0) return ran

    return { ...ran, context: [...(ran.context ?? []), steer(e.file_path, added)] }
  }).catch((_$, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async (_$, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran

    const syntax = syntaxFor(e.file_path)
    if (!syntax) return ran

    const before = stringField(ran.result, 'originalFile') ?? ''
    const added = addedComments(before, e.content, syntax)
    if (added.length === 0) return ran

    return { ...ran, context: [...(ran.context ?? []), steer(e.file_path, added)] }
  }).catch((_$, e, next) => next(e))
}
