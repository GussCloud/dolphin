export const DOLPHIN_PROJECT_FIELDS = `
  id
  slugId
  name
  description
  content
  url
  color
  icon
  health
  priority
  priorityLabel
  progress
  scope
  issueCountHistory
  completedIssueCountHistory
  startDate
  targetDate
  createdAt
  updatedAt
  completedAt
  canceledAt
  startedAt
  status {
    id
    name
    type
    color
  }
  lead {
    id
    displayName
    avatarUrl
  }
  members(first: 10) {
    nodes {
      id
      displayName
      avatarUrl
    }
  }
  teams(first: 10) {
    nodes {
      id
      name
      key
    }
  }
  labels(first: 20) {
    nodes {
      id
      name
      color
    }
  }
`

export const DOLPHIN_PROJECT_DETAIL_FIELDS = `
  ${DOLPHIN_PROJECT_FIELDS}
  projectMilestones(first: 20) {
    nodes {
      id
      name
      status
      targetDate
      progress
    }
  }
  externalLinks(first: 20) {
    nodes {
      id
      label
      url
    }
  }
  lastUpdate {
    id
    body
    health
    url
    createdAt
    updatedAt
    user {
      id
      displayName
      avatarUrl
    }
  }
`

export const DOLPHIN_ISSUE_FIELDS = `
  id
  identifier
  title
  description
  url
  priority
  estimate
  updatedAt
  labelIds
  state {
    name
    type
    color
  }
  team {
    id
    name
    key
  }
  assignee {
    id
    displayName
    avatarUrl
  }
  labels(first: 50) {
    nodes {
      id
      name
    }
  }
`

export const PROJECTS_QUERY = `
  query DolphinLinearProjects($first: Int, $filter: ProjectFilter, $orderBy: PaginationOrderBy) {
    projects(first: $first, filter: $filter, orderBy: $orderBy) {
      nodes {
        ${DOLPHIN_PROJECT_FIELDS}
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`

export const SEARCH_PROJECTS_QUERY = `
  query DolphinLinearProjectSearch($term: String!, $first: Int, $after: String) {
    searchProjects(term: $term, first: $first, after: $after) {
      nodes {
        ${DOLPHIN_PROJECT_FIELDS}
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

export const PROJECT_QUERY = `
  query DolphinLinearProject($id: String!) {
    project(id: $id) {
      ${DOLPHIN_PROJECT_DETAIL_FIELDS}
    }
  }
`

export const CREATE_PROJECT_MUTATION = `
  mutation DolphinLinearProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project {
        ${DOLPHIN_PROJECT_DETAIL_FIELDS}
      }
    }
  }
`

export const PROJECT_ISSUES_QUERY = `
  query DolphinLinearProjectIssues(
    $id: String!,
    $first: Int,
    $after: String,
    $orderBy: PaginationOrderBy
  ) {
    project(id: $id) {
      issues(first: $first, after: $after, orderBy: $orderBy) {
        nodes {
          ${DOLPHIN_ISSUE_FIELDS}
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`

export const PROJECT_TEAMS_QUERY = `
  query DolphinLinearProjectTeams($id: String!, $first: Int, $after: String) {
    project(id: $id) {
      teams(first: $first, after: $after) {
        nodes {
          id
          name
          key
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`
