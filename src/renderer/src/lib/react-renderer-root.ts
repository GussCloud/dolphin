import { createRoot, type Root } from 'react-dom/client'

type RendererRootHotData = {
  dolphinRendererRoot?: Root
}

export function getOrCreateRendererRoot(
  container: HTMLElement,
  hotData?: RendererRootHotData
): Root {
  const existingRoot = hotData?.dolphinRendererRoot
  if (existingRoot) {
    return existingRoot
  }
  const root = createRoot(container)
  if (hotData) {
    hotData.dolphinRendererRoot = root
  }
  return root
}
