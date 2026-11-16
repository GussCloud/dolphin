import { PolicyDocumentPage, policyDocumentMetadata } from '@/components/policy-document-page'
import { supportPageEn } from '@/content/support-page'

export const metadata = policyDocumentMetadata(supportPageEn, '/support')

export default function SupportPage() {
  return <PolicyDocumentPage document={supportPageEn} />
}
