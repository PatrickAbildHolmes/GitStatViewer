import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * Frontend
 * @returns {JSX.Element}
 * @constructor
 */
function App() {
    const [repoInput, setRepoInput] = useState('');
    const [repoTracked, setRepoTracked] = useState(false);
    const [commits, setCommits] = useState([]);
    const pollingInterval = useRef(null);

    // Requests the backend to do the API call
    // First fetches the existing commits from DB (if any exist) to immediately present to user
    // Meanwhile the backend corresponds with GitHub API to retrieve new commits,
    // which are then immediately added to/replace the list of five most recent commits.
    const startTrackingRepo = async () => {
        const [owner, repo] = repoInput.split('/');
        if (!owner || !repo) {
            alert('Please enter repo in format owner/repo');
            return;
        }
        await pollCommits(owner, repo); // Show current data right away
        setRepoTracked(true); // Show the UI section even if empty

        try {
            await axios.post('http://localhost:4000/track-repo', { owner, repo });
            startPolling(owner, repo);
        } catch (err) {
            console.error('Tracking error:', err);
            alert('Error starting tracking. Check console.');
        }
    };


    const pollCommits = async (owner, repo) => {
        try {
            const response = await axios.get(`http://localhost:4000/commits/${owner}/${repo}`);
            setCommits(response.data);
        } catch (err) {
            console.error('Polling error:', err);
        }
    };

    const startPolling = (owner, repo) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(() => {
            pollCommits(owner, repo);
        }, 5000);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h1>GitStatViewer</h1>
            <input
                type="text"
                placeholder="owner/repo"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                style={{ marginRight: '1rem' }}
            />
            <button onClick={startTrackingRepo}>Track Repository</button>

            {repoTracked && (
                <div style={{ marginTop: '2rem' }}>
                    <h2>Recent Commits</h2>
                    {commits.length === 0 ? (
                        <p>No commits found yet.</p>
                    ) : (
                        <ul>
                            {commits.map((commit) => (
                                <li key={commit.sha} style={{marginBottom: '1rem'}}>
                                    <strong>Author:</strong> {commit.author}<br/>
                                    <strong>Date:</strong> {new Date(commit.timestamp).toLocaleString()}<br/>
                                    <strong>SHA:</strong> {commit.sha}<br/>
                                    <strong style={{color: 'green'}}>+{commit.additions}</strong>
                                    <span> / </span>
                                    <strong style={{color: 'red'}}>-{commit.deletions}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
