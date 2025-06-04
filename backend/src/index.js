const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
/**
 * Two endpoints:
 *  A) User statistics. How many commits they've made in the month etc. <br>
 *  B) Repository statistics. How many commit have been made in the last month.<br>
 *  For now, just User endpoint <br>
 *  Test with: PatrickAbildHolmes/i4-simulated-lab
 * */


const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());
const interval = 5000; // Polling interval
const trackedRepos = new Set(); // Set of 'owner/repo'
// Starts the application
const PORT = 4000; // Backend runs on port 4000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startPolling();
});


// ------ Routes ------
// This one handles querying the GitHub API, to store data into the database
app.post('/track-repo', async (req, res) => {
    const { owner, repo } = req.body;
    if (!owner || !repo) return res.status(400).json({ error: 'Owner and repo required' });

    const fullRepo = `${owner}/${repo}`;
    trackedRepos.add(fullRepo); // Register for polling

    res.json({ message: `Started tracking ${fullRepo}` });
});

// This one handles getting the data from the database, to present it to the client
app.get('/commits/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    const fullRepo = `${owner}/${repo}`;

    const commits = await prisma.repoCommit.findMany({
        where: { repo: fullRepo },
        orderBy: { timestamp: 'desc' },
    });

    res.json(commits);
});

/**
 * Continuously polls GitHub for (new) commits made to the requested repository.
 */
function startPolling() {
    setInterval(async () => {
        for (const repoName of trackedRepos) {
            try {
                const [owner, repo] = repoName.split('/');
                const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
                    headers: { 'User-Agent': 'GitStatViewer' },
                    params: {
                        per_page: 5, // Fetch latest 5
                    },
                });

                for (const commit of response.data) {
                    const sha = commit.sha;

                    const exists = await prisma.repoCommit.findUnique({ where: { sha } });
                    if (exists) continue;

                    // Fetch commit details (with stats)
                    const detail = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`);
                    const stats = detail.data.stats;

                    await prisma.repoCommit.create({
                        data: {
                            sha,
                            repo: repoName,
                            author: commit.commit.author.name,
                            timestamp: new Date(commit.commit.author.date),
                            additions: stats?.additions || 0,
                            deletions: stats?.deletions || 0,
                        },
                    });
                    console.log(`Saved commit ${sha} from ${repoName}`);
                }
            } catch (err) {
                console.error(`Polling error for ${repoName}:`, err.response?.data?.message || err.message);
            }
        }
    }, interval);
}