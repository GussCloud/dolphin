import { z } from 'zod'

const Project = z.string().trim().min(1, 'Missing project')
const WorkItemId = z.number().int().positive()

export const AzureBoardsList = z.object({
  project: Project,
  search: z.string().optional(),
  assignedToMe: z.boolean().optional(),
  includeClosed: z.boolean().optional()
})

export const AzureBoardsGet = z.object({ project: Project, id: WorkItemId })

export const AzureBoardsProject = z.object({ project: Project })

export const AzureBoardsCreate = z.object({
  project: Project,
  workItemType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional()
})

export const AzureBoardsUpdateState = z.object({
  project: Project,
  id: WorkItemId,
  state: z.string().min(1)
})

export const AzureBoardsAddComment = z.object({
  project: Project,
  id: WorkItemId,
  text: z.string().min(1)
})
