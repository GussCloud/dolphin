// Shape shared by the privacy policy and support pages, one copy per language.
export type PolicyLanguage = 'en' | 'pt-BR'

export type PolicyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'links'; items: readonly { label: string; href: string }[] }

export type PolicySection = {
  heading: string
  blocks: readonly PolicyBlock[]
}

export type PolicyDocument = {
  language: PolicyLanguage
  title: string
  description: string
  updatedLabel: string
  intro: string
  sections: readonly PolicySection[]
  // The same page in the other language.
  alternate: { label: string; href: string }
}

export const CONTACT_EMAIL = 'contato@metyxa.com.br'
export const POLICY_UPDATED_ON = '2026-11-16'
