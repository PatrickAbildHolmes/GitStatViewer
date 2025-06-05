require('dotenv').config({ path: __dirname + '/../.env' });
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
let trackedRepo = null; // Set at the end of /track-repo route
const APIHeader = {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'User-Agent': 'GitStatViewer' };

// Starts the application
const PORT = 4000; // Backend runs on port 4000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startPolling();
});

// ------ Routes ------
/**
 * /track-repo handles querying the GitHub API, to store data into the database <br>
 * It works by requesting the latest 5 commits from the repository <br>
 * Then compares those 5 to the database. <br>
 * If all 5 are present in database, skip to polling <br>
 * If 1-4 are present, add the remaining to database, then polling <br>
 * And if none are present (I.E. newly tracked repository) download entire history, then begin polling. <br>
 */
app.post('/track-repo', async (req, res) => {
    const { owner, repo } = req.body;
    if (!owner || !repo) return res.status(400).json({ error: 'Owner and repo required' });

    const fullRepo = `${owner}/${repo}`;
    if (trackedRepo && trackedRepo !== fullRepo) {
        return res.status(400).json({
            error: `Only one repo can be tracked. Currently tracking ${trackedRepo}.`,
        });
    }

    try {
        // Get 5 latest commits.
        // Includes `sha`, and (not guaranteed) author.name, author.login (username) & author.date
        // Details like additions, deletions and files changed are retrieved using the `sha` with helper-method `insertCommitDetails()`
        const latestResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
            headers: APIHeader,
            params: { per_page: 5 },
        });

        const latestCommits = latestResponse.data;
        let newShas = [];

        // Checking if they already are in database by comparing sha 's
        for (const commit of latestCommits) {
            const sha = commit.sha;
            const exists = await prisma.repoCommit.findUnique({ where: { sha } });
            if (!exists) newShas.push(sha);
        }
        // If all found commits were new, fetch the full history
        if (newShas.length === 5) {
            console.log(`[${fullRepo}] No overlap found. Fetching full history.`);
            await fetchFullHistory(owner, repo, fullRepo);
        }
        // Else add the new commits
        else if (newShas.length > 0) {
            console.log(`[${fullRepo}] Some new commits. Inserting.`);
            for (const sha of newShas) {
                // Helper-method that requests commit details (author, timestamp, additions/deletions)
                await insertCommitDetails(owner, repo, sha, fullRepo);
            }
        } else {
            console.log(`[${fullRepo}] No new commits.`);
        }

        // Regardless of new commits/history, start polling afterward
        trackedRepo = fullRepo;
        res.json({ message: `Tracking started for ${fullRepo}` });

    } catch (err) {
        console.error(`Error during tracking for ${fullRepo}:`, err.response?.data?.message || err.message);
        res.status(500).json({ error: 'Tracking failed' });
    }
});

// This one handles getting the data from the database, to present it to the client
app.get('/commits/:owner/:repo', async (request, response) => {
    // Formats the request parameters into format that matches the table field in prisma
    const { owner, repo } = request.params;
    const fullRepo = `${owner}/${repo}`;
    // And retrieves all commits for that repo from the database.
    // Frontend then decides what to do with it
    const commits = await prisma.repoCommit.findMany({
        where: { repo: fullRepo },
        orderBy: { timestamp: 'desc' },
    });
    response.json(commits);
});

// ----- Helper methods -----
async function fetchFullHistory(owner, repo, fullRepo) {
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    // Continuously requests 100 results (commits) per page, increasing page number by 1 every iteration
    // If the retrieved page has 100 results, `hasMore` stays true and the iteration continues
    while (hasMore) {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
            headers: APIHeader,
            params: { per_page: perPage, page },
        });
        const commits = response.data;
        if (commits.length === 0) break; // break loop if empty page returned, such as edge cases where a repo has exactly 200/300/400... commits
        // Iterate through returned commits, comparing sha to see if it is in database, and if not, add it to database
        for (const commit of commits) {
            const sha = commit.sha;
            const exists = await prisma.repoCommit.findUnique({ where: { sha } });
            if (!exists) await insertCommitDetails(owner, repo, sha, fullRepo);
        }
        hasMore = commits.length === perPage;
        page++;
    }
}
// Commits are initially retrieved with just sha, message and maybe author details.
// This method uses the ´sha` to retrieve the details used for analysis/presentation in frontend
// And actually inserts new commits into the database
async function insertCommitDetails(owner, repo, sha, fullRepo) {
    try {
        const detail = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`);
        const stats = detail.data.stats;
        const author = detail.data.commit?.author?.name || 'Unknown';
        const timestamp = new Date(detail.data.commit?.author?.date || Date.now());

        await prisma.repoCommit.create({
            data: {
                sha,
                repo: fullRepo,
                author,
                timestamp,
                additions: stats?.additions || 0,
                deletions: stats?.deletions || 0,
            },
        });

        console.log(`Inserted commit ${sha} from ${fullRepo}`);
    } catch (err) {
        console.error(`Error inserting commit ${sha}:`, err.response?.data?.message || err.message);
    }
}

/**
 * Continuously polls GitHub for (new) commits made to the requested repository.
 */
function startPolling() {
    setInterval(async () => {
        if (!trackedRepo) return;
            try {
                const [owner, repo] = trackedRepo.split('/');
                const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
                    headers: APIHeader,
                    params: {
                        per_page: 5, // Fetch latest 5
                    },
                });
                // For each commit, check if the `sha` is in database. If not, add the commit to db
                for (const commit of response.data) {
                    const sha = commit.sha;
                    const exists = await prisma.repoCommit.findUnique({ where: { sha } });
                    if (!exists) await insertCommitDetails(owner, repo, sha, trackedRepo);
                }
            } catch (err) {
                console.error(`Polling error for ${trackedRepo}:`, err.response?.data?.message || err.message);
            }
    }, interval);
}