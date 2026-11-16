import { PolicyDocumentPage, policyDocumentMetadata } from '@/components/policy-document-page'
import { privacyPolicyPtBr } from '@/content/privacy-policy'

export const metadata = policyDocumentMetadata(privacyPolicyPtBr, '/pt-br/privacy')

export default function PrivacyPagePtBr() {
  return <PolicyDocumentPage document={privacyPolicyPtBr} />
}
