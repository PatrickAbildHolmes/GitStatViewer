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
    const [totalLines, setTotalLines] = useState();
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
            // if (sorted.length === 0) return; // Guard against empty commits, to protect percentage numbers

            setCommits(sorted);
            generateChartData(sorted);
            // const stats = computeStats(sorted);
            // setRepoStats(stats);
            setRepoStats(computeStats(sorted));
        } catch (err) {
            console.error('Polling error:', err);
        }
    };

    const computeStats = (commits) => {
        if (!commits || commits.length === 0) { // Guard against empty commits (which happens whenever a poll doesn't return a commit)
            return { totalCommits: 0, authors: [] }; // Needed to not reset percentage numbers
        }
        const totalCommits = commits.length;
        const authorStats = {};
        let totalLinesChanged = 0;
        const normalizeName = (name) => name.replace(/\s+/g, '').toLowerCase();// Helper-function to normalize name.
        // Without it, you end up with both "Patrick Holmes" and "PatrickHolmes" as separate authors, which is hilarious

        for (const commit of commits) {
            const rawName = commit.author;
            const normalized = normalizeName(rawName);
            const { additions, deletions } = commit;
            if (!authorStats[normalized]) {
                authorStats[normalized] = {
                    author: rawName,
                    commits: 0,
                    additions: 0,
                    deletions: 0,
                };
            }
            authorStats[normalized].commits += 1;
            authorStats[normalized].additions += additions;
            authorStats[normalized].deletions += deletions;
            totalLinesChanged += additions + deletions;
        }

        const authors = Object.values(authorStats).map((stats) => {
            const linesChanged = stats.additions + stats.deletions;
            return {
                author: stats.author,
                commits: stats.commits,
                additions: stats.additions,
                deletions: stats.deletions,
                avgLinesChanged: (linesChanged / stats.commits).toFixed(2),
                commitPercent: ((stats.commits / totalCommits) * 100).toFixed(1),
                changePercent: totalLinesChanged > 0
                    ? ((linesChanged / totalLinesChanged) * 100).toFixed(1)
                    : '0.0',
            };
        });

        authors.sort((a, b) => b.commits - a.commits);

        return { totalCommits, authors };
    };


    const generateChartData = (commitList) => {
        let totalLines = 0;
        const sortedCommits = [...commitList].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        if (sortedCommits.length === 0) {
            setChartData([]);
            return 0;
        }

        // Create date => totalLines map (as of the last commit that day)
        const linesPerDay = new Map();

        sortedCommits.forEach((commit) => {
            const commitDate = new Date(commit.timestamp);
            const dateKey = commitDate.toISOString().split('T')[0]; // yyyy-mm-dd
            totalLines += commit.additions - commit.deletions;
            linesPerDay.set(dateKey, totalLines); // overwrite ensures last commit of day wins
        });

        // Generate full date range for chart
        const data = [];
        const allDates = Array.from(linesPerDay.keys()).sort(); // all commit days
        const firstDate = new Date(allDates[0]);
        const lastDate = new Date(allDates[allDates.length - 1]);

        const cursor = new Date(firstDate);
        let lastValue = 0;

        while (cursor <= lastDate) {
            const dateKey = cursor.toISOString().split('T')[0];
            const displayDate = cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

            if (linesPerDay.has(dateKey)) {
                lastValue = linesPerDay.get(dateKey);
            }

            data.push({ name: displayDate, lines: lastValue });

            cursor.setDate(cursor.getDate() + 1);
        }

        setChartData(data);
        setTotalLines(totalLines);
        return totalLines; // allow this to be passed back to computeStats
    };


    const startPolling = (owner, repo) => {
        if (pollingInterval.current) return;

        pollingInterval.current = setInterval(() => {
            pollCommits(owner, repo);
        }, 5000);
    };

    // Hook to update the repo stats from historical data, even though no new commits have come in

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
                                    {[...commits].slice(-5).reverse().map((commit) => (
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
                {repoTracked && (
                    <div>
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
                )}
            </div>

            {/* Right side block: Author stats */}
            {repoStats && (
                <div style={{flex: 1, marginLeft: '8rem', overflowY: 'auto'}}>
                    <h2>Repository Summary</h2>
                    <p><strong>Total Commits:</strong> {repoStats.totalCommits}</p>
                    <p><strong>Approximate repo size:</strong> {totalLines} lines</p>
                    <h3>Author Contributions:</h3>
                    <ul style={{listStyleType: 'none', paddingLeft: 0}}>
                        {repoStats.authors.map((a) => (
                            <li key={a.author}
                                style={{marginBottom: '1.5rem', padding: '0.5rem 0', borderBottom: '1px solid #ccc'}}>
                                <div><strong>Author:</strong> {a.author}</div>
                                <div><strong>Commits:</strong> {a.commits} ({a.commitPercent ?? '0.0'}%)</div>
                                <div>
                                    <strong style={{color: 'green'}}>+{a.additions}</strong>
                                    <span> / </span>
                                    <strong style={{color: 'red'}}>-{a.deletions}</strong>
                                    <span> ({a.changePercent ?? '0.0'}% of code changes)</span>
                                </div>
                                <div><strong>Avg change:</strong> {a.avgLinesChanged} lines/commit</div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;
