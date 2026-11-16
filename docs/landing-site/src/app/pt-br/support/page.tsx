import { PolicyDocumentPage, policyDocumentMetadata } from '@/components/policy-document-page'
import { supportPagePtBr } from '@/content/support-page'

export const metadata = policyDocumentMetadata(supportPagePtBr, '/pt-br/support')

export default function SupportPagePtBr() {
  return <PolicyDocumentPage document={supportPagePtBr} />
}
