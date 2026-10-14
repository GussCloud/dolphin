import { z } from 'zod'

export const AzureDevOpsSetAuthMethod = z.object({
  method: z.enum(['token', 'azure-cli'])
})

export const AzureDevOpsSetCliAutoRenew = z.object({
  enabled: z.boolean()
})

export const AzureDevOpsConfigureCliDefaults = z.object({
  organization: z.string().min(1),
  project: z.string().nullable().optional()
})

export const AzureDevOpsPullRequestComments = z.object({
  project: z.string().min(1),
  repositoryId: z.string().min(1),
  pullRequestId: z.number().int().positive()
})

export const AzureDevOpsReviewerAvatar = z.object({
  url: z.string().min(1)
})
