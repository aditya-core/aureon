import './assistant.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Assistant } from './Assistant'
createRoot(document.getElementById('root')!).render(<StrictMode><Assistant/></StrictMode>)
