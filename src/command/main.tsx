import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Command } from './Command'
import '../motion.css'
import './command.css'
createRoot(document.getElementById('root')!).render(<StrictMode><Command/></StrictMode>)
