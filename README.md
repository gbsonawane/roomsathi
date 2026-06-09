# RoomSathi

## New frontend implementation

This repository now includes a Next.js frontend application in the `frontend/` directory.

### Run frontend locally

1. Go to the new frontend folder:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` from `.env.example` and set your backend URL:
   ```bash
   cp .env.example .env.local
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

### Backend settings

The FastAPI backend remains in `backend/` and continues to use the Python environment.

- The frontend reads `NEXT_PUBLIC_FASTAPI_URL` from `frontend/.env.local`.
- Example backend URL for local development: `http://localhost:8000`

### Deployment

- Deploy the Next.js frontend from the `frontend/` directory.
- Deploy the FastAPI backend separately to a Python-friendly host.
- Keep `FASTAPI_URL` pointed at the backend endpoint.
