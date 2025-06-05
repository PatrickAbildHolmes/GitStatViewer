# GitStatViewer
## Description
GitStatViewer allows you to view and analyse commits made to a repository in realtime through polling. <br>
Created for the "Softwareteknologi i Cyber-fysiske Systemer" course. <br>
It summarizes and presents data about the number of commits **made to the main branch**, with information about: <br>
* Latest commits (incl. Author, timestamp and lines added/removed)
* Chart summarizing the growth and size of the codebase
* Summary of repository codebase, number of commits, and contribution statistics from each contributor.

## Tech-stack
This project is built as a fullstack application that acts as a client-server web application following a three-layer model consisting of
1. Presentation layer (client-side frontend)
2. Business Logic layer (server backend)
3. Data layer (serverside SQLite database) <br>

...from which data is requested by the user, where the server then retrieves it from the public GitHub API and presents it to the user.

### Frontend
* **React (Vite)**, to handle UI and clientside polling to server backend.

### Backend
* **Node.js Express**. Main server framework.
* **Prisma**. Handles requests to-and-from the database.
* **SQLite3**. Lightweight database.
* **axios**. Handles requests between frontend and backend.
* **cors**. Middleware to enable frontend and backend hosting on same PC.

## How to install from fresh
Important: The project needs a database file and .env-file (with personal GitHub API token) to run, 
which must be generated on a fresh install.<br>
From root directory:
* Installs dependencies and creates (empty) database
    ```bash
    npm install
    cd backend
    npx prisma db push
    ```
Remember to insert personal GitHub API token into .env -file. <br>
If no db-connection is made, try generating a new prisma folder + .env-file with ´npx prisma generate´

## How to run it
1. Make sure to have all external libraries installed
2. ensure /backend/ has a .env file (used for prisma)
3. Start backend by
    ```bash
    cd backend
   node src/index.js
    ```
4. Start frontend by
    ```bash
    cd frontend
   npm run dev
    ```
5. Visit frontend at http://localhost:5173/

6. Test with ```PatrickAbildHolmes/i4-simulated-lab```
