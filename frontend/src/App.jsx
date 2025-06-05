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
    const [repoInput, setRepoInput] = useState(''); // Used for keeping track of repo name
    const [repoStats, setRepoStats] = useState(null);
    const [repoTracked, setRepoTracked] = useState(false); // Boolean to control whether to show repo info
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
            const stats = computeStats(sorted);
            setRepoStats(stats);
        } catch (err) {
            console.error('Polling error:', err);
        }
    };

    const computeStats = (commits) => {
        const totalCommits = commits.length;
        const authorStats = {};
        for (const commit of commits) {
            const { author, additions, deletions } = commit;
            if (!authorStats[author]) {
                authorStats[author] = {
                    commits: 0,
                    additions: 0,
                    deletions: 0,
                };
            }
            authorStats[author].commits += 1;
            authorStats[author].additions += additions;
            authorStats[author].deletions += deletions;
        }

        const authors = Object.entries(authorStats).map(([author, stats]) => ({
            author,
            commits: stats.commits,
            additions: stats.additions,
            deletions: stats.deletions,
            avgLinesChanged: ((stats.additions + stats.deletions) / stats.commits).toFixed(2),
        })).sort((a, b) => b.commits - a.commits);

        return { totalCommits, authors };
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
        if (pollingInterval.current) return;

        pollingInterval.current = setInterval(() => {
            pollCommits(owner, repo);
        }, 5000);
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            height: '100vh',
            width: '100vw',
            boxSizing: 'border-box',
            padding: '1rem',
            overflow: 'hidden'
        }}>
            {/*Left side block: Header, input-field and list of recent commits*/}
            <div style={{flex: 2}}>
                <h1>GitStatViewer</h1>
                <input
                    type="text"
                    placeholder="owner/repo"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    style={{marginRight: '1rem', padding: '0.5rem'}}
                />
                <button onClick={startTrackingRepo}>Track Repository</button>
                <div style={{marginTop: '2rem'}}>
                    {repoTracked && (
                        <div>
                            {commits.length === 0 ? (
                                <p>No commits found yet.</p>
                            ) : (
                                <ul>
                                    {[...commits].reverse().map((commit) => (
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
            </div>

            {/*Center block: Codebase chart*/}
            <div style={{flex: 2, marginTop: '6rem'}}>
                <h2>Codebase Size</h2>
                {chartData.length === 0 ? (
                    <p>Loading chart...</p>
                ) : (
                    <ResponsiveContainer width="100%" height={600}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="name"/>
                            <YAxis label={{value: 'Lines of Code', angle: -90, position: 'insideLeft'}}/>
                            <Tooltip/>
                            <Line type="monotone" dataKey="lines" stroke="#8884d8" strokeWidth={2}/>
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Right side block: Author stats */}
            {repoStats && (
                <div style={{flex: 1, marginLeft: '8rem', overflowY: 'auto'}}>
                    <h2>Repository Summary</h2>
                    <p><strong>Total Commits:</strong> {repoStats.totalCommits}</p>
                    <h3>Author Contributions:</h3>
                    <ul style={{listStyleType: 'none', paddingLeft: 0}}>
                        {repoStats.authors.map((a) => (
                            <li key={a.author}
                                style={{marginBottom: '1.5rem', padding: '0.5rem 0', borderBottom: '1px solid #ccc'}}>
                                <div><strong>Author: </strong> {a.author}</div>
                                <div><strong>Commits: </strong> {a.commits}</div>
                                <div><strong>Additions: </strong><strong
                                    style={{color: 'green'}}>+{a.additions}</strong></div>
                                <div><strong>Deletions: </strong><strong style={{color: 'red'}}>-{a.deletions}</strong>
                                </div>
                                <div><strong>Avg change: </strong> {a.avgLinesChanged} lines/commit</div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;
