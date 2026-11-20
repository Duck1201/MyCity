import '../styles.css';
import { createRoot } from 'react-dom/client';
import { PrototypeConsole } from './console';
import './console.css';

createRoot(document.getElementById('root')!).render(<PrototypeConsole />);
