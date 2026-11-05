import { newAction, newWorkflow } from './model'
import type { ActionType, Workflow } from './model'
function step(type:ActionType,config:Record<string,string|number>={}){const a=newAction(type);return {...a,config:{...a.config,...config}}}
export const templates: {name:string;description:string;create:()=>Workflow}[] = [
 {name:'Developer Launchpad',description:'Open your development resources.',create:()=>({...newWorkflow(),name:'Developer Launchpad',description:'Make room for a productive build.',actions:[step('openUrl',{url:'https://github.com/'}),step('openUrl',{url:'https://developer.mozilla.org/'}),step('openUrl',{url:'https://stackoverflow.com/'}),step('openUrl',{url:'https://github.com/dashboard'})]})},
 {name:'Deep Study',description:'Settle in with a focus timer and learning resources.',create:()=>({...newWorkflow(),name:'Deep Study',description:'A little more room to learn.',actions:[step('layout',{layout:'focus'}),step('openUrl',{url:'https://developer.mozilla.org/'}),step('focus',{minutes:25})]})},
 {name:'Research Sprint',description:'Prepare a collection and open your library.',create:()=>({...newWorkflow(),name:'Research Sprint',description:'Gather sources and connect ideas.',actions:[step('openUrl',{url:'https://scholar.google.com/'}),step('collection',{name:'Research Sprint'}),step('researchHub')]})},
 {name:'Workday Start',description:'Open your work tools and workspace.',create:()=>({...newWorkflow(),name:'Workday Start',description:'A calmer start to the day.',actions:[step('theme',{theme:'midnight'}),step('layout',{layout:'workspace'}),step('openUrl',{url:'https://mail.google.com/'}),step('openUrl',{url:'https://calendar.google.com/'})]})},
]
