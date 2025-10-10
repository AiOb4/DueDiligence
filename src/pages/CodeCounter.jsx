import { useState } from 'react';
import Table from '../components/SccTable.jsx'

export default function CodeCounter() {
  const [dir, setDir] = useState('');         // user-chosen directory
  const [result, setResult] = useState(null); // scc output
  const [error, setError] = useState('');

  // Opens a folder picker (through main process)
  const chooseFolder = async () => {
    const selectedDir = await window.api.selectDirectory();
    if (selectedDir) setDir(selectedDir);
  };

  // Calls existing IPC method to run scc
  const runSCC = async () => {
    if (!dir) {
      setError('Please select a directory first.');
      return;
    }

    setError('');
    setResult(null);

    const res = await window.api.runCodeCounter(dir);

    if (res.success) {
      setResult(res.data);
    } else {
      setError(res.error || 'Unknown error.');
    }
  };

  return (
    <div>
      <h1>Code Counter</h1>

      <button onClick={chooseFolder}>Choose Folder</button>
      {dir && <p><b>Selected:</b> {dir}</p>}

      <button onClick={runSCC} disabled={!dir}>Run Code Counter</button>

      {error && <p>{error}</p>}

      {result && <Table data={result}/>}
    </div>
  );
}