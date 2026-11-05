import { getPreferences, savePreferences, getNotes, saveNotes, getFocusState, saveFocusState } from '../lib/storage'
import { normalizeFocus } from '../lib/focus'
import { getSessions } from '../command/storage'
import { restoreSaved } from '../command/api'
import { duplicateKey, safeUrl } from '../command/model'
import { supportedPage } from '../ai/context'
import { getPages, putPage, getCollections, putCollection } from '../research/db'
import type { Execution, WorkflowAction } from './model'

/** Called only after validation; all actions are a fixed allowlist. */
export async function executeAction(action: WorkflowAction, run: Execution): Promise<void> {
  const c=action.config
  switch(action.type) {
    case 'openUrl': { const url=safeUrl(c.url);if(!url)throw new Error('Invalid URL.');const window=await chrome.windows.getLastFocused();if(window.incognito||window.id===undefined)throw new Error('Open a normal browser window first.');await chrome.tabs.create({windowId:window.id,url,active:false});return }
    case 'session': { const sessions=await getSessions(), found=sessions.find(s=>s.id===c.sessionId);if(!found)throw new Error('Saved workspace no longer exists.');if(found.tabs.length>10&&!run.approvedForNext)throw new Error('Add a confirmation step immediately before restoring a workspace with more than 10 tabs.');const r=await restoreSaved(found.tabs);if(r.failed)throw new Error(`Workspace restore partially failed (${r.failed} errors). Review open tabs before retrying.`);return }
    case 'theme': case 'layout': { const raw=(await chrome.storage.local.get('preferences')).preferences;if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw new Error('Preferences could not be read; existing data was not changed.');const prefs=await getPreferences();if(action.type==='theme')prefs.theme=c.theme as typeof prefs.theme;else prefs.layout=c.layout as typeof prefs.layout;await savePreferences(prefs);return }
    case 'focus': { const existing=normalizeFocus(await getFocusState());const minutes=c.minutes as number;await saveFocusState({...existing,mode:'focus',durations:{...existing.durations,focus:minutes},remainingMs:minutes*60000,endsAt:Date.now()+minutes*60000,completed:false});return }
    case 'note': { const raw=(await chrome.storage.local.get('notes')).notes;if(raw!==undefined && !Array.isArray(raw))throw new Error('Notes could not be read; existing data was not changed.');const notes=await getNotes();if(Array.isArray(raw)&&notes.length!==raw.length)throw new Error('Notes contain invalid data; existing data was not changed.');const now=new Date().toISOString();await saveNotes([{id:crypto.randomUUID(),title:c.title as string,content:c.content as string,createdAt:now,updatedAt:now},...notes]);return }
    case 'collection': { const name=(c.name as string).trim();if(!(await getCollections()).some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))await putCollection({id:crypto.randomUUID(),name,description:'',createdAt:Date.now()});return }
    case 'researchHub': { const window=await chrome.windows.getLastFocused();if(window.incognito||window.id===undefined)throw new Error('Open a normal browser window first.');await chrome.tabs.create({windowId:window.id,url:chrome.runtime.getURL('research.html')});return }
    case 'savePage': { if(run.sourceTabId===undefined||!run.sourceUrl)throw new Error('Choose a source page from the NOVA toolbar before running this workflow.');const tab=await chrome.tabs.get(run.sourceTabId);if(tab.url!==run.sourceUrl||supportedPage(tab))throw new Error('The source page changed, closed, or is not supported.');const url=safeUrl(tab.url);if(!url)throw new Error('Invalid source page.');const key=duplicateKey(url)!;if((await getPages()).some(p=>p.urlKey===key))return;const now=Date.now();await putPage({id:crypto.randomUUID(),url,urlKey:key,title:tab.title||new URL(url).hostname,description:'',tags:[],notes:'',collectionId:null,relatedIds:[],createdAt:now,updatedAt:now});return }
    case 'notification': { if(!await chrome.permissions.contains({permissions:['notifications']}))throw new Error('Enable notification permission in Automations first.');await chrome.notifications.create({type:'basic',iconUrl:chrome.runtime.getURL('automation-icon.png'),title:'NOVA Automations',message:c.message as string});return }
    case 'wait': case 'confirm': throw new Error('This action must be handled by the workflow runner.')
  }
}
