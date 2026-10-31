import { installConditionalMediationGuard } from './azure-devops-sign-in-window-installation'
import type { ContextBridge } from 'electron'

// Why: raw require keeps the sandboxed preload standalone in the main-process CJS build.
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a sandboxed preload's `require('electron')` always exposes contextBridge.
const { contextBridge } = require('electron') as { contextBridge: ContextBridge }

contextBridge.executeInMainWorld({ func: installConditionalMediationGuard })
