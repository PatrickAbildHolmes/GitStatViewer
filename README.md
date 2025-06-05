# GitStatViewer
## Description
GitStatViewer allows you to view and analyse commits made to a repository in realtime through polling. <br>
Created for the "Softwareteknologi i Cyber-fysiske Systemer" course.

## Tech-stack
This project is built as a fullstack application that acts as a client-server web application following a three-layer model consisting of
1. Presentation layer (clientside frontend)
2. Business Logic layer (server backend)
3. Data layer (serverside SQLite database)
from which data is requested by the user, where the server then retrieves it from the public GitHub API and presents it to the user.

### Frontend
* **React (Vite)**, to handle UI.

### Backend
* **NodeJS Express**. Main server framework.
* **Prisma**. Handles requests to-and-from the database.
* **SQLite3**. Lightweight database.
* **axios**. Handles requests between frontend and backend.
* **cors**. Middleware to enable frontend and backend hosting on same PC.

## How to install from fresh
* npm install
* cd backend
* npx prisma generate
* npx prisma db push

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
