export type FoundComment = { line: number; text: string }

type Syntax = { line: readonly string[]; block: readonly (readonly [string, string])[] }

const C_LIKE: Syntax = { line: ['//'], block: [['/*', '*/']] }
const HASH: Syntax = { line: ['#'], block: [] }
const DASH: Syntax = { line: ['--'], block: [['/*', '*/']] }
const MARKUP: Syntax = { line: ['//'], block: [['<!--', '-->'], ['/*', '*/']] }
const CSS: Syntax = { line: [], block: [['/*', '*/']] }
const SCSS: Syntax = { line: ['//'], block: [['/*', '*/']] }
const LUA: Syntax = { line: ['--'], block: [['--[[', ']]']] }

const SYNTAX_BY_EXTENSION: Record<string, Syntax> = {
  ...Object.fromEntries(
    'js jsx ts tsx mjs cjs mts cts java kt kts swift go rs c h cc cpp hpp cs scala dart php groovy m mm zig'
      .split(' ')
      .map(ext => [ext, C_LIKE]),
  ),
  ...Object.fromEntries(
    'py rb sh bash zsh fish yml yaml toml r pl ex exs tf hcl ps1 nim cr jl'
      .split(' ')
      .map(ext => [ext, HASH]),
  ),
  sql: DASH,
  hs: DASH,
  lua: LUA,
  vue: MARKUP,
  svelte: MARKUP,
  astro: MARKUP,
  html: MARKUP,
  css: CSS,
  scss: SCSS,
  less: SCSS,
}

const DIRECTIVE =
  /^(eslint|prettier-ignore|@ts-|tslint:|istanbul |c8 |biome-ignore|deno-lint|noqa|type:\s*ignore|pylint:|mypy:|pyright:|ruff:|fmt:|isort:|pragma|nolint|go:|\+build|swiftlint:|rubocop:|-\*-|frozen_string_literal|#region|#endregion|region\b|endregion\b|MARK:|SPDX-|Copyright|@license|@preserve|@flow|@jsx|@vitest-environment|@jest-environment|sourceMappingURL|webpackChunkName|@refresh|shellcheck|NOSONAR|coverage:|language=|@formatter:|clang-format|NOLINT|svelte-ignore|@vue-ignore|biome-|\$FlowFixMe|@generated)/i

export function syntaxFor(path: string): Syntax | undefined {
  const name = path.split('/').pop() ?? ''
  if (/^(Dockerfile|Makefile|\.?[a-z]*rc)$/i.test(name) && !name.includes('.json')) return HASH
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return SYNTAX_BY_EXTENSION[ext]
}

function isOutsideString(code: string): boolean {
  const quotes = (code.match(/(?<!\\)["'`]/g) ?? []).length
  return quotes % 2 === 0
}

function findLineCommentStart(line: string, tokens: readonly string[]): number {
  for (const token of tokens) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith(token) && !trimmed.startsWith('#!') && !trimmed.startsWith('#[')) {
      return line.length - trimmed.length
    }
    let from = 0
    while (true) {
      const at = line.indexOf(token, from)
      if (at <= 0) break
      const isTrailing = /\s/.test(line.charAt(at - 1)) && isOutsideString(line.slice(0, at))
      if (isTrailing) return at
      from = at + token.length
    }
  }
  return -1
}

function strip(raw: string, opener: string, closer?: string): string {
  let body = raw.slice(opener.length)
  if (closer && body.endsWith(closer)) body = body.slice(0, -closer.length)
  return body
    .split('\n')
    .map(l => l.replace(/^\s*\*+\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/^[*!]+\s*/, '')
    .trim()
}

export function extractComments(source: string, syntax: Syntax): FoundComment[] {
  const lines = source.split('\n')
  const found: FoundComment[] = []
  let open: { closer: string; opener: string; startLine: number; parts: string[] } | undefined

  lines.forEach((line, index) => {
    if (open) {
      const end = line.indexOf(open.closer)
      open.parts.push(end === -1 ? line : line.slice(0, end + open.closer.length))
      if (end !== -1) {
        found.push({ line: open.startLine + 1, text: strip(open.parts.join('\n'), open.opener, open.closer) })
        open = undefined
      }
      return
    }

    for (const [opener, closer] of syntax.block) {
      const start = line.indexOf(opener)
      if (start === -1 || !isOutsideString(line.slice(0, start))) continue
      const end = line.indexOf(closer, start + opener.length)
      if (end === -1) {
        open = { opener, closer, startLine: index, parts: [line.slice(start)] }
      } else {
        found.push({ line: index + 1, text: strip(line.slice(start, end + closer.length), opener, closer) })
      }
      return
    }

    const at = findLineCommentStart(line, syntax.line)
    if (at === -1) return
    const token = syntax.line.find(t => line.startsWith(t, at))!
    found.push({ line: index + 1, text: line.slice(at + token.length).trim() })
  })

  return found.filter(c => c.text.length > 0 && !DIRECTIVE.test(c.text))
}

export function addedComments(before: string, after: string, syntax: Syntax): FoundComment[] {
  const existing = new Set(extractComments(before, syntax).map(c => c.text))
  return extractComments(after, syntax).filter(c => !existing.has(c.text))
}
