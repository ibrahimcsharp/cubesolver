// Adds a function that min2phase.js exports but leaves out of its own types.
export {}

declare module 'min2phase.js' {
  /** Facelet string of the cube after the scramble (needs a trailing space). */
  export function fromScramble(scramble: string): string
}
