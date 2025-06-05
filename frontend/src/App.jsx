import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
/**
 * Frontend. Presents a list of 5 most recent commits, a chart showing codebase growth, and other repository statistics
 * @returns {JSX.Element}
 * @constructor
 */
function App() {
    const [repoInput, setRepoInput] = useState('');
    const [repoTracked, setRepoTracked] = useState(false);
    const [commits, setCommits] = useState([]);
    const [chartData, setChartData] = useState([]);
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
            const sorted = [...response.data].sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
            );
            setCommits(sorted);
            generateChartData(sorted);
        } catch (err) {
            console.error('Polling error:', err);
        }
    };

    const generateChartData = (commitList) => {
        let totalLines = 0;
        const sortedCommits = [...commitList].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        if (sortedCommits.length === 0) {
            setChartData([]);
            return;
        }

        const firstDate = new Date(sortedCommits[0].timestamp);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Map date (yyyy-mm-dd) => total lines
        const linesPerDay = new Map();
        sortedCommits.forEach((commit) => {
            const dateKey = new Date(commit.timestamp).toISOString().split('T')[0]; // yyyy-mm-dd
            totalLines += commit.additions - commit.deletions;
            linesPerDay.set(dateKey, totalLines);
        });

        const data = [];
        const cursor = new Date(firstDate);
        while (cursor <= today) {
            const dateKey = cursor.toISOString().split('T')[0];
            const displayDate = cursor.toLocaleDateString();

            // Use the latest totalLines up to that day
            const value = linesPerDay.has(dateKey)
                ? linesPerDay.get(dateKey)
                : (data.length > 0 ? data[data.length - 1].lines : 0);

            data.push({ name: displayDate, lines: value });

            cursor.setDate(cursor.getDate() + 1); // go to next day
        }

        setChartData(data);
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
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ flex: 1 }}>
                        {commits.length === 0 ? (
                            <p>No commits found yet.</p>
                        ) : (
                            <ul>
                                {[...commits].reverse().map((commit) => (
                                    <li key={commit.sha} style={{ marginBottom: '1rem' }}>
                                        <strong>Author:</strong> {commit.author}<br />
                                        <strong>Date:</strong> {new Date(commit.timestamp).toLocaleString()}<br />
                                        <strong>SHA:</strong> {commit.sha}<br />
                                        <strong style={{ color: 'green' }}>+{commit.additions}</strong>
                                        <span> / </span>
                                        <strong style={{ color: 'red' }}>-{commit.deletions}</strong>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div style={{ flex: 1, marginLeft: '2rem' }}>
                        <h2>Codebase Size</h2>
                        {chartData.length === 0 ? (
                            <p>Loading chart...</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={600}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis label={{ value: 'Lines of Code', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="lines" stroke="#8884d8" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
