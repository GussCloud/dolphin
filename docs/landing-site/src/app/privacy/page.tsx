import { PolicyDocumentPage, policyDocumentMetadata } from '@/components/policy-document-page'
import { privacyPolicyEn } from '@/content/privacy-policy'

export const metadata = policyDocumentMetadata(privacyPolicyEn, '/privacy')

export default function PrivacyPage() {
  return <PolicyDocumentPage document={privacyPolicyEn} />
}
