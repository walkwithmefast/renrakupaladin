import { render } from 'preact';
import './theme.js'; // sets <html data-theme data-mode> from Settings -> Appearance before the first paint
import './rulebook.js'; // merges descriptions read from the user's PDFs + their edits into window.SR5TEXT etc.
import { App } from './ui/App.jsx';
import './styles.css';

render(<App />, document.getElementById('root'));
