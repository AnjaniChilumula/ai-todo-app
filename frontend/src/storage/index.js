import { IS_DEMO } from '../config.js'
import { apiStore } from './apiStore.js'
import { createLocalStore } from './localStore.js'

// The store the app uses by default: the browser in demo mode, the backend otherwise.
export const defaultStore = IS_DEMO ? createLocalStore() : apiStore
